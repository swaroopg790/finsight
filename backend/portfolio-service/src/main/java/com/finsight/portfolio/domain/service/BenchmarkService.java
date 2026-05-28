package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.dto.response.PerformanceResponse;
import com.finsight.portfolio.domain.model.BenchmarkSnapshot;
import com.finsight.portfolio.domain.repository.BenchmarkSnapshotRepository;
import com.finsight.portfolio.infrastructure.market.PolygonClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

/**
 * Manages benchmark (SPY / QQQ) daily close data.
 *
 * Two responsibilities:
 *   1. Sync: fetch daily bars from Polygon.io and persist idempotently.
 *   2. Query: return a normalised series for the performance chart overlay.
 *
 * Normalisation: benchmark bars are scaled so that the first data point
 * equals the user's portfolio value on the same start date. This lets all
 * three series (portfolio, SPY, QQQ) render on the same dollar Y-axis —
 * the same approach used by Betterment and Wealthfront.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BenchmarkService {

    static final List<String> BENCHMARK_TICKERS = List.of("SPY", "QQQ");

    private final BenchmarkSnapshotRepository benchmarkRepository;
    private final PolygonClient               polygonClient;

    // ── Sync ─────────────────────────────────────────────────────────────────

    /**
     * Fetches and stores SPY + QQQ daily closes for the last {@code days} calendar days.
     * Idempotent — skips dates that already have data.
     */
    @Transactional
    public void syncBenchmarks(int days) {
        LocalDate endDate   = LocalDate.now();
        LocalDate startDate = endDate.minusDays(days);
        for (String ticker : BENCHMARK_TICKERS) {
            syncTicker(ticker, startDate, endDate);
        }
    }

    @Transactional
    public void syncTicker(String ticker, LocalDate from, LocalDate to) {
        List<PolygonClient.DailyBar> bars = polygonClient.getDailyRange(ticker, from, to);
        int saved = 0;
        for (PolygonClient.DailyBar bar : bars) {
            if (benchmarkRepository.findByTickerAndSnapshotDate(ticker, bar.date()).isPresent()) {
                continue; // already stored — idempotent
            }
            benchmarkRepository.save(BenchmarkSnapshot.builder()
                    .ticker(ticker)
                    .snapshotDate(bar.date())
                    .closePrice(bar.close())
                    .build());
            saved++;
        }
        log.info("Benchmark sync for {}: {} new bars saved ({} → {})", ticker, saved, from, to);
    }

    // ── Query ─────────────────────────────────────────────────────────────────

    /**
     * Returns a normalised benchmark series for {@code ticker} starting from {@code since}.
     *
     * The first available bar is scaled so its value equals {@code portfolioStartValue}.
     * All subsequent bars are scaled by the same factor. Returns an empty list if there are
     * no stored bars or the portfolio start value is zero.
     *
     * @param ticker              "SPY" or "QQQ"
     * @param since               inclusive start date
     * @param portfolioStartValue portfolio total value on the first day of the requested period
     */
    @Transactional(readOnly = true)
    public List<PerformanceResponse.DataPoint> getNormalizedSeries(
            String ticker, LocalDate since, BigDecimal portfolioStartValue) {

        List<BenchmarkSnapshot> snapshots = benchmarkRepository.findByTickerSince(ticker, since);

        if (snapshots.isEmpty()
                || portfolioStartValue == null
                || portfolioStartValue.compareTo(BigDecimal.ZERO) == 0) {
            return List.of();
        }

        BigDecimal firstClose = snapshots.get(0).getClosePrice();
        if (firstClose.compareTo(BigDecimal.ZERO) == 0) return List.of();

        // scaleFactor = portfolioStartValue / firstBarClose
        BigDecimal scaleFactor = portfolioStartValue.divide(firstClose, 8, RoundingMode.HALF_UP);

        return snapshots.stream()
                .map(s -> new PerformanceResponse.DataPoint(
                        s.getSnapshotDate(),
                        s.getClosePrice()
                                .multiply(scaleFactor)
                                .setScale(2, RoundingMode.HALF_UP)
                ))
                .toList();
    }
}
