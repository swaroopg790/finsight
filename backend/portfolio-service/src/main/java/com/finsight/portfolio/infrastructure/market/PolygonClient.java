package com.finsight.portfolio.infrastructure.market;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
}
