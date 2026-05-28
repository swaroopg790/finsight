package com.finsight.portfolio.infrastructure.market;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

/**
 * Fetches end-of-day close prices from Polygon.io (free tier).
 *
 * Free tier limits: 5 API calls / minute, previous-day close only.
 * Callers are responsible for rate-limiting (see PortfolioSyncScheduler).
 *
 * Uses SimpleClientHttpRequestFactory (HttpURLConnection) to avoid the JDK HTTP client
 * keep-alive bug that causes "bytes received: 0" on keep-alive connections.
 *
 * Upgrade path: set POLYGON_API_KEY to a paid plan key → swap endpoint to
 * /v2/last/trade/{ticker} for real-time quotes.
 */
@Slf4j
@Component
public class PolygonClient {

    private final RestClient restClient;
    private final String     apiKey;

    public PolygonClient(@Value("${finsight.polygon.api-key:}") String apiKey) {
        this.apiKey     = apiKey;
        // SimpleClientHttpRequestFactory uses HttpURLConnection — works reliably over HTTPS
        // and avoids the JDK HttpClient keep-alive issues seen with Spring Boot 4.
        this.restClient = RestClient.builder()
                .requestFactory(new SimpleClientHttpRequestFactory())
                .build();
    }

    /**
     * Returns the previous trading day's close price for a ticker.
     * Returns empty if the key is missing, the ticker is unknown, or the API errors.
     */
    public Optional<BigDecimal> getPreviousClose(String ticker) {
        if (apiKey == null || apiKey.isBlank()) {
            log.debug("Polygon API key not configured — skipping price enrichment for {}", ticker);
            return Optional.empty();
        }

        try {
            String url = "https://api.polygon.io/v2/aggs/ticker/{ticker}/prev"
                       + "?adjusted=true&apiKey={key}";

            // Use Map<String, Object> to stay annotation-free and Jackson-version-agnostic.
            // Jackson 3 (Spring Boot 4) and Jackson 2 (plaid-java) both handle this fine.
            Map<String, Object> response = restClient.get()
                    .uri(url, ticker.toUpperCase(), apiKey)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});

            if (response == null || !"OK".equals(response.get("status"))) {
                log.debug("No price data from Polygon for {} (status={})",
                        ticker, response != null ? response.get("status") : "null");
                return Optional.empty();
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("results");
            if (results == null || results.isEmpty()) {
                log.debug("Empty results from Polygon for {}", ticker);
                return Optional.empty();
            }

            // Polygon returns the close price in the "c" field
            Object closeRaw = results.get(0).get("c");
            if (closeRaw == null) {
                log.debug("No close price in Polygon response for {}", ticker);
                return Optional.empty();
            }

            BigDecimal close = new BigDecimal(closeRaw.toString());
            log.debug("Polygon price for {}: {}", ticker, close);
            return Optional.of(close);

        } catch (Exception e) {
            log.warn("Polygon price fetch failed for {}: {}", ticker, e.getMessage());
            return Optional.empty();
        }
    }

    // ── Daily aggregate range ─────────────────────────────────────────────────

    /**
     * Returns daily close prices for a ticker over a date range.
     * Used for benchmark (SPY / QQQ) historical data.
     *
     * Falls back to synthetic mock bars when POLYGON_API_KEY is not set —
     * suitable for local development without a paid Polygon subscription.
     *
     * @param ticker  e.g. "SPY" or "QQQ"
     * @param from    inclusive start date
     * @param to      inclusive end date
     * @return list of (date, closePrice) ordered ascending by date
     */
    public List<DailyBar> getDailyRange(String ticker, LocalDate from, LocalDate to) {
        if (apiKey == null || apiKey.isBlank()) {
            log.debug("Polygon API key not configured — returning mock bars for {}", ticker);
            return generateMockBars(ticker, from, to);
        }

        try {
            // /v2/aggs/ticker/{ticker}/range/1/day/{from}/{to}?adjusted=true&sort=asc&apiKey=...
            String url = "https://api.polygon.io/v2/aggs/ticker/{ticker}/range/1/day/{from}/{to}"
                       + "?adjusted=true&sort=asc&limit=500&apiKey={key}";

            Map<String, Object> response = restClient.get()
                    .uri(url, ticker.toUpperCase(), from.toString(), to.toString(), apiKey)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});

            if (response == null || !"OK".equals(response.get("status"))) {
                log.warn("No daily range data from Polygon for {} ({} → {}): status={}",
                        ticker, from, to, response != null ? response.get("status") : "null");
                return List.of();
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("results");
            if (results == null || results.isEmpty()) {
                log.debug("Empty daily range from Polygon for {}", ticker);
                return List.of();
            }

            return results.stream()
                    .map(r -> {
                        // Polygon returns timestamp in milliseconds UTC
                        long epochMs = ((Number) r.get("t")).longValue();
                        LocalDate date  = Instant.ofEpochMilli(epochMs)
                                .atZone(ZoneOffset.UTC).toLocalDate();
                        BigDecimal close = new BigDecimal(r.get("c").toString());
                        return new DailyBar(date, close);
                    })
                    .toList();

        } catch (Exception e) {
            log.warn("Polygon daily range fetch failed for {}: {}", ticker, e.getMessage());
            return List.of();
        }
    }

    /**
     * Generates deterministic mock daily bars for local dev (no Polygon key needed).
     * Simulates realistic SPY (~520) / QQQ (~445) price trajectories with slight upward
     * drift and Gaussian noise, seeded by ticker name for reproducibility.
     */
    private List<DailyBar> generateMockBars(String ticker, LocalDate from, LocalDate to) {
        // Base prices approximate real market levels; start ~15% lower to show visible growth
        double basePrice = "SPY".equalsIgnoreCase(ticker) ? 520.0 : 445.0;
        double price     = basePrice * 0.85;

        long totalDays = ChronoUnit.DAYS.between(from, to);
        Random rng     = new Random(ticker.hashCode()); // stable per ticker — same data every run
        List<DailyBar> bars = new ArrayList<>();

        for (long i = 0; i <= totalDays; i++) {
            LocalDate date = from.plusDays(i);
            // Skip weekends — markets are closed
            if (date.getDayOfWeek() == DayOfWeek.SATURDAY
             || date.getDayOfWeek() == DayOfWeek.SUNDAY) {
                continue;
            }
            // ~0.03% daily drift + ~1% Gaussian noise (realistic equity volatility)
            price *= (1.0 + (rng.nextGaussian() * 0.01) + 0.0003);
            bars.add(new DailyBar(date,
                    BigDecimal.valueOf(price).setScale(2, RoundingMode.HALF_UP)));
        }

        log.debug("Mock benchmark bars for {}: {} trading days ({} → {})", ticker, bars.size(), from, to);
        return bars;
    }

    /** Immutable value object returned by {@link #getDailyRange}. */
    public record DailyBar(LocalDate date, BigDecimal close) {}
}
