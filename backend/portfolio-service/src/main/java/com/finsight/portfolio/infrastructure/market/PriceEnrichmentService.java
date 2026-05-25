package com.finsight.portfolio.infrastructure.market;

import com.finsight.portfolio.domain.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Triggers Polygon.io price enrichment independently of the 4-hour scheduler.
 *
 * Kept separate from PortfolioSyncScheduler to avoid a circular Spring dependency:
 *   PortfolioSyncScheduler → PlaidService → PriceEnrichmentService   (no cycle)
 *   PortfolioSyncScheduler → PlaidService → PortfolioSyncScheduler   (circular — avoided)
 *
 * The scheduler's enrichPricesFromPolygon() uses a 14 s sleep to respect the Polygon
 * free-tier rate limit (5 req/min). This service skips the sleep for an immediate
 * best-effort refresh — some tickers may be 429'd and will be caught by the next
 * scheduled run.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PriceEnrichmentService {

    private final PositionRepository positionRepository;
    private final PolygonClient      polygonClient;

    /**
     * Asynchronously refreshes prices for every distinct ticker in the positions table.
     * Runs on Spring's task executor — returns immediately to the caller.
     *
     * No sleep between Polygon calls → best-effort, accepts occasional 429 responses.
     * Called automatically after a user connects a new brokerage account.
     */
    @Async
    @Transactional
    public void enrichAllPricesAsync() {
        List<String> tickers = positionRepository.findAllDistinctTickers();
        if (tickers.isEmpty()) {
            log.debug("No tickers to enrich — skipping quick price refresh");
            return;
        }

        log.info("Quick price refresh starting for {} tickers via Polygon.io", tickers.size());
        int updated = 0;

        for (String ticker : tickers) {
            try {
                Optional<BigDecimal> price = polygonClient.getPreviousClose(ticker);
                if (price.isPresent()) {
                    positionRepository.updateCurrentPriceByTicker(ticker, price.get());
                    log.debug("Quick refresh: {} = {}", ticker, price.get());
                    updated++;
                }
            } catch (Exception e) {
                // Rate limit or network error — scheduler will catch this ticker in 4h
                log.warn("Quick price refresh skipped for {}: {}", ticker, e.getMessage());
            }
        }

        log.info("Quick price refresh complete — {}/{} tickers updated", updated, tickers.size());
    }
}
