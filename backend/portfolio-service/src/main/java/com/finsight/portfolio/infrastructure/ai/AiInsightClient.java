package com.finsight.portfolio.infrastructure.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finsight.portfolio.api.dto.response.AccountResponse;
import com.finsight.portfolio.api.dto.response.HoldingResponse;
import com.finsight.portfolio.api.dto.response.InsightResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Calls the Python AI service (Groq/Llama) to analyse a user's portfolio.
 *
 * Results are cached in Redis for 30 minutes so repeated dashboard loads
 * don't hammer the Groq free-tier quota.
 *
 * If the AI service is down the method returns null — callers must handle that gracefully.
 *
 * NOTE: Spring Boot 4 auto-configures a Jackson 3 ObjectMapper bean (tools.jackson.databind).
 * This class uses a plain Jackson 2 instance (available via plaid-java transitive dep) only
 * for Redis cache serialization, keeping only simple types (String, List<String>) so no
 * JavaTimeModule is needed. RestClient deserialization uses Map<String,Object> to stay
 * annotation-free and compatible with whichever Jackson version Spring 4 uses internally.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiInsightClient {

    private final StringRedisTemplate redisTemplate;

    // Jackson 2 instance for Redis cache serialisation (available via plaid-java transitive dep).
    // We only store primitive types + List<String> so no JavaTimeModule is required.
    private static final ObjectMapper JSON = new ObjectMapper();

    // Use SimpleClientHttpRequestFactory (HttpURLConnection) instead of the default JDK HTTP client.
    // The JDK HTTP client has a keep-alive bug with Python/uvicorn: it reuses the connection
    // after uvicorn closes it, resulting in "fixed content-length: N, bytes received: 0".
    private final RestClient restClient = RestClient.builder()
            .requestFactory(new SimpleClientHttpRequestFactory())
            .build();

    private static final Duration CACHE_TTL    = Duration.ofMinutes(30);
    private static final String   CACHE_PREFIX = "insights:";

    @Value("${finsight.ai-service.url:http://localhost:8000}")
    private String aiServiceUrl;

    /**
     * Returns AI-generated portfolio insights, served from Redis cache when available.
     *
     * @param userId   JWT subject (UUID string) — used as cache key
     * @param holdings current holdings for the user
     * @param accounts connected accounts for the user
     * @return InsightResponse or null if the AI service is unavailable
     */
    public InsightResponse getInsights(String userId,
                                        List<HoldingResponse> holdings,
                                        List<AccountResponse> accounts) {
        String cacheKey = CACHE_PREFIX + userId;

        // ── Cache read ───────────────────────────────────────────────────────
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                log.debug("Serving insights from cache for user={}", userId);
                return deserializeFromCache(cached);
            }
        } catch (Exception e) {
            log.warn("Redis cache read failed (will call AI service directly): {}", e.getMessage());
        }

        // ── AI service call ──────────────────────────────────────────────────
        try {
            Map<String, Object> requestBody = Map.of(
                    "user_id",  userId,
                    "holdings", holdings,
                    "accounts", accounts
            );

            // Use Map<String,Object> to avoid Jackson 2/3 annotation mismatch.
            // The Python service returns snake_case risk_flags — we read it by key directly.
            Map<String, Object> payload = restClient.post()
                    .uri(aiServiceUrl + "/analyze/portfolio")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});

            if (payload == null) {
                log.warn("AI service returned null payload for user={}", userId);
                return null;
            }

            @SuppressWarnings("unchecked")
            List<String> riskFlags   = (List<String>) payload.get("risk_flags");
            @SuppressWarnings("unchecked")
            List<String> suggestions = (List<String>) payload.get("suggestions");

            InsightResponse result = new InsightResponse(
                    (String) payload.getOrDefault("summary", "Analysis unavailable"),
                    riskFlags   != null ? riskFlags   : List.of(),
                    suggestions != null ? suggestions : List.of(),
                    Instant.now()
            );

            // ── Cache write ──────────────────────────────────────────────────
            try {
                redisTemplate.opsForValue()
                        .set(cacheKey, serializeToCache(result), CACHE_TTL);
                log.debug("Cached insights for user={} (TTL={})", userId, CACHE_TTL);
            } catch (Exception e) {
                log.warn("Redis cache write failed: {}", e.getMessage());
            }

            return result;

        } catch (Exception e) {
            log.error("AI service call failed for user={}: {}", userId, e.getMessage());
            return null;
        }
    }

    /**
     * Invalidates cached insights for a user — called after a portfolio sync
     * so the next dashboard load triggers fresh analysis.
     */
    public void invalidateCache(String userId) {
        try {
            redisTemplate.delete(CACHE_PREFIX + userId);
            log.debug("Invalidated insights cache for user={}", userId);
        } catch (Exception e) {
            log.warn("Failed to invalidate insights cache: {}", e.getMessage());
        }
    }

    // ── Private cache helpers ─────────────────────────────────────────────────

    /**
     * Serialises InsightResponse to a JSON string for Redis.
     * Stores only simple types (String, List<String>, String for Instant) so
     * Jackson 2's ObjectMapper works without JavaTimeModule.
     */
    private static String serializeToCache(InsightResponse r) throws Exception {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("summary",     r.summary());
        map.put("riskFlags",   r.riskFlags()   != null ? r.riskFlags()   : List.of());
        map.put("suggestions", r.suggestions() != null ? r.suggestions() : List.of());
        map.put("generatedAt", r.generatedAt() != null ? r.generatedAt().toString() : Instant.now().toString());
        return JSON.writeValueAsString(map);
    }

    /**
     * Deserialises InsightResponse from a Redis JSON string.
     */
    @SuppressWarnings("unchecked")
    private static InsightResponse deserializeFromCache(String json) throws Exception {
        Map<String, Object> map = JSON.readValue(json, Map.class);
        return new InsightResponse(
                (String) map.get("summary"),
                (List<String>) map.get("riskFlags"),
                (List<String>) map.get("suggestions"),
                Instant.parse((String) map.get("generatedAt"))
        );
    }
}
