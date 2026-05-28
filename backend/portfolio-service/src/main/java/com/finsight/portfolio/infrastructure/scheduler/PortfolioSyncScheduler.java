package com.finsight.portfolio.infrastructure.scheduler;

import com.finsight.portfolio.domain.model.PlaidItem;
import com.finsight.portfolio.domain.model.PortfolioSnapshot;
import com.finsight.portfolio.domain.model.User;
import com.finsight.portfolio.domain.repository.PlaidItemRepository;
import com.finsight.portfolio.domain.repository.PortfolioSnapshotRepository;
import com.finsight.portfolio.domain.repository.PositionRepository;
import com.finsight.portfolio.domain.repository.UserRepository;
import com.finsight.portfolio.domain.service.AlertService;
import com.finsight.portfolio.domain.service.BenchmarkService;
import com.finsight.portfolio.domain.service.PlaidService;
import com.finsight.portfolio.domain.service.TransactionService;
import com.finsight.portfolio.infrastructure.ai.AiInsightClient;
import com.finsight.portfolio.infrastructure.crypto.EncryptionService;
import com.finsight.portfolio.infrastructure.market.PolygonClient;
import com.finsight.portfolio.infrastructure.plaid.PlaidGateway;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Periodic background job that:
 *   1. Re-syncs all active Plaid items (accounts + holdings)
 *   2. Enriches position prices from Polygon.io (previous-day close)
 *   3. Records a daily portfolio value snapshot per user (for the performance chart)
 *   4. Invalidates the AI insights cache so the next dashboard load gets fresh analysis
 *
 * Runs every 4 hours. Polygon free tier: 5 req/min → 13s sleep between tickers.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PortfolioSyncScheduler {

    private final PlaidItemRepository        plaidItemRepository;
    private final PositionRepository         positionRepository;
    private final PortfolioSnapshotRepository snapshotRepository;
    private final UserRepository             userRepository;
    private final PlaidService               plaidService;
    private final PolygonClient              polygonClient;
    private final AiInsightClient            aiInsightClient;
    private final TransactionService         transactionService;
    private final BenchmarkService           benchmarkService;
    private final AlertService               alertService;
    private final PlaidGateway               plaidGateway;
    private final EncryptionService          encryptionService;

    /**
     * Main sync job — runs every 4 hours.
     *
     * Steps:
     *   1. Re-sync accounts + holdings from Plaid for every active item
     *   2. Sync investment transactions (last 90 days, idempotent)
     *   3. Enrich position prices from Polygon.io (previous-day close)
     *   4. Record daily portfolio value snapshots
     *   5. Refresh benchmark (SPY / QQQ) data
     *   6. Check PORTFOLIO_DROP alerts
     *   7. Invalidate AI insight caches
     */
    @Scheduled(fixedRateString = "PT4H")
    public void syncAllPortfolios() {
        List<PlaidItem> activeItems =
                plaidItemRepository.findByStatus(PlaidItem.PlaidItemStatus.ACTIVE);

        if (activeItems.isEmpty()) {
            log.debug("No active Plaid items — nothing to sync");
            return;
        }

        log.info("Scheduled sync starting for {} active Plaid items", activeItems.size());

        // ── Step 1: Plaid holdings + accounts sync ───────────────────────────
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

        // ── Step 2: Transaction sync ─────────────────────────────────────────
        for (PlaidItem item : activeItems) {
            if (item.getStatus() == PlaidItem.PlaidItemStatus.ERROR) continue;
            try {
                String accessToken = encryptionService.decrypt(item.getAccessTokenEncrypted());
                transactionService.syncTransactions(item, accessToken, plaidGateway);
            } catch (Exception e) {
                log.warn("Transaction sync failed for item={}: {}", item.getId(), e.getMessage());
            }
        }

        // ── Step 3: Polygon price enrichment ────────────────────────────────
        enrichPricesFromPolygon();

        // ── Step 4: Record daily portfolio snapshots ─────────────────────────
        recordDailySnapshots();

        // ── Step 5: Benchmark data refresh (SPY + QQQ, last 90 days) ────────
        try {
            benchmarkService.syncBenchmarks(90);
        } catch (Exception e) {
            log.warn("Benchmark sync failed: {}", e.getMessage());
        }

        // ── Step 6: Check PORTFOLIO_DROP alerts ──────────────────────────────
        try {
            alertService.checkPortfolioDropAlerts();
        } catch (Exception e) {
            log.warn("Alert check failed: {}", e.getMessage());
        }

        // ── Step 7: Invalidate AI insight caches ────────────────────────────
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
     * Weekly summary emails — fires every Monday at 08:00 UTC.
     * Sends portfolio summaries to all users with WEEKLY_SUMMARY alerts enabled.
     */
    @Scheduled(cron = "0 0 8 * * MON")
    public void sendWeeklySummaries() {
        log.info("Weekly summary job starting");
        try {
            alertService.sendWeeklySummaries();
        } catch (Exception e) {
            log.error("Weekly summary job failed: {}", e.getMessage());
        }
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

    /**
     * Records (or updates) one portfolio snapshot per user for today.
     * Called after price enrichment so values are as fresh as possible.
     * Uses UPSERT semantics via the unique constraint on (user_id, snapshot_date).
     */
    @Transactional
    public void recordDailySnapshots() {
        List<Object[]> rows = positionRepository.sumCurrentValueGroupedByUserId();
        if (rows.isEmpty()) {
            log.debug("No positions — skipping snapshot recording");
            return;
        }

        LocalDate today = LocalDate.now();
        int recorded = 0;

        for (Object[] row : rows) {
            UUID      userId     = (UUID) row[0];
            BigDecimal totalValue = (BigDecimal) row[1];
            if (totalValue == null) totalValue = BigDecimal.ZERO;

            try {
                User user = userRepository.getReferenceById(userId);
                PortfolioSnapshot snapshot = snapshotRepository
                        .findByUserIdAndSnapshotDate(userId, today)
                        .orElseGet(() -> PortfolioSnapshot.builder()
                                .user(user)
                                .snapshotDate(today)
                                .createdAt(Instant.now())
                                .build());

                snapshot.setTotalValue(totalValue);
                snapshotRepository.save(snapshot);
                recorded++;
                log.debug("Snapshot recorded for user={} date={} value={}", userId, today, totalValue);
            } catch (Exception e) {
                log.error("Failed to record snapshot for user={}: {}", userId, e.getMessage());
            }
        }

        log.info("Daily snapshot recording complete — {}/{} users recorded", recorded, rows.size());
    }
}
