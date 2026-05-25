package com.finsight.portfolio.infrastructure.scheduler;

import com.finsight.portfolio.domain.model.PlaidItem;
import com.finsight.portfolio.domain.repository.PlaidItemRepository;
import com.finsight.portfolio.domain.repository.PositionRepository;
import com.finsight.portfolio.domain.service.PlaidService;
import com.finsight.portfolio.infrastructure.ai.AiInsightClient;
import com.finsight.portfolio.infrastructure.market.PolygonClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Periodic background job that:
 *   1. Re-syncs all active Plaid items (accounts + holdings)
 *   2. Enriches position prices from Polygon.io (previous-day close)
 *   3. Invalidates the AI insights cache so the next dashboard load gets fresh analysis
 *
 * Runs every 4 hours. Polygon free tier: 5 req/min → 13s sleep between tickers.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PortfolioSyncScheduler {

    private final PlaidItemRepository plaidItemRepository;
    private final PositionRepository  positionRepository;
    private final PlaidService        plaidService;
    private final PolygonClient       polygonClient;
    private final AiInsightClient     aiInsightClient;

    /** Plaid sync + price enrichment + AI cache invalidation every 4 hours. */
    @Scheduled(fixedRateString = "PT4H")
    public void syncAllPortfolios() {
        List<PlaidItem> activeItems =
                plaidItemRepository.findByStatus(PlaidItem.PlaidItemStatus.ACTIVE);

        if (activeItems.isEmpty()) {
            log.debug("No active Plaid items — nothing to sync");
            return;
        }

        log.info("Scheduled sync starting for {} active Plaid items", activeItems.size());

        // ── Step 1: Plaid sync ───────────────────────────────────────────────
        int syncOk = 0, syncFail = 0;
        for (PlaidItem item : activeItems) {
            try {
                plaidService.syncItem(item);
                syncOk++;
            } catch (Exception e) {
                log.error("Plaid sync failed for item={} institution={}: {}",
                        item.getId(), item.getInstitutionName(), e.getMessage(), e);
                item.setStatus(PlaidItem.PlaidItemStatus.ERROR);
                plaidItemRepository.save(item);
                syncFail++;
            }
        }
        log.info("Plaid sync complete — ok={} failed={}", syncOk, syncFail);

        // ── Step 2: Polygon price enrichment ────────────────────────────────
        enrichPricesFromPolygon();

        // ── Step 3: Invalidate AI insight caches ────────────────────────────
        // Each unique user gets fresh insights on their next dashboard load
        activeItems.stream()
                .map(item -> item.getUser().getId().toString())
                .distinct()
                .forEach(userId -> {
                    aiInsightClient.invalidateCache(userId);
                    log.debug("AI cache invalidated for user={}", userId);
                });

        log.info("Scheduled sync fully complete");
    }

    /**
     * Fetches previous-day close prices from Polygon.io for every distinct ticker
     * in the positions table and updates currentPrice + currentValue in bulk.
     *
     * Rate-limited to ~4 calls/min (14s sleep) to stay within the Polygon free tier.
     */
    @Transactional
    public void enrichPricesFromPolygon() {
        List<String> tickers = positionRepository.findAllDistinctTickers();
        if (tickers.isEmpty()) {
            log.debug("No positions to price-enrich");
            return;
        }

        log.info("Enriching prices for {} unique tickers via Polygon.io", tickers.size());
        int updated = 0;

        for (String ticker : tickers) {
            Optional<BigDecimal> price = polygonClient.getPreviousClose(ticker);
            if (price.isPresent()) {
                int rows = positionRepository.updateCurrentPriceByTicker(ticker, price.get());
                log.debug("Updated price for {} = {} ({} rows)", ticker, price.get(), rows);
                updated++;
            }

            // Polygon free tier: 5 req/min → sleep 14s between calls to stay safe
            if (tickers.size() > 1) {
                try { Thread.sleep(14_000); } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    log.warn("Price enrichment interrupted");
                    break;
                }
            }
        }

        log.info("Polygon price enrichment complete — {}/{} tickers updated", updated, tickers.size());
    }
}
