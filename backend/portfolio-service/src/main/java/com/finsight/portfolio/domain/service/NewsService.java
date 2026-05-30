package com.finsight.portfolio.domain.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finsight.portfolio.api.dto.response.*;
import com.finsight.portfolio.domain.model.Position;
import com.finsight.portfolio.domain.repository.PositionRepository;
import com.finsight.portfolio.infrastructure.market.PolygonNewsGateway;
import com.finsight.portfolio.infrastructure.market.PolygonNewsGateway.PolygonNewsArticle;
import com.finsight.portfolio.infrastructure.market.PolygonNewsGateway.TickerInsight;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Orchestrates portfolio-filtered news intelligence.
 *
 * <p>Flow:
 * <ol>
 *   <li>Load user's top 15 positions by market value.</li>
 *   <li>Fetch news from Polygon.io for those tickers in a single API call.</li>
 *   <li>Aggregate per-ticker sentiment from article insights.</li>
 *   <li>Estimate upcoming earnings dates using a quarterly-cadence algorithm.</li>
 *   <li>Call the Python AI service for a personalised summary paragraph.</li>
 *   <li>Cache the full response in Redis for {@link #CACHE_TTL}.</li>
 * </ol>
 *
 * <p>Jackson note: uses a static Jackson-2 ObjectMapper (same pattern as AiInsightClient)
 * because Spring Boot 4 injects a Jackson-3 bean that is incompatible.
 */
@Slf4j
@Service
public class NewsService {

    // Jackson 2 (via plaid-java transitive dep) — NOT injected from Spring context
    private static final ObjectMapper JSON = new ObjectMapper();

    private static final Duration CACHE_TTL   = Duration.ofMinutes(15);
    private static final Duration STALE_AFTER = Duration.ofMinutes(10);
    private static final String   CACHE_KEY   = "news:";

    private final PositionRepository   positionRepository;
    private final PolygonNewsGateway   newsGateway;
    private final StringRedisTemplate  redis;

    private final RestClient restClient = RestClient.builder()
            .requestFactory(new SimpleClientHttpRequestFactory())
            .build();

    @Value("${finsight.ai-service.url:http://localhost:8000}")
    private String aiServiceUrl;

    public NewsService(PositionRepository positionRepository,
                       PolygonNewsGateway newsGateway,
                       StringRedisTemplate redis) {
        this.positionRepository = positionRepository;
        this.newsGateway        = newsGateway;
        this.redis              = redis;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Returns the portfolio-filtered news feed for a user.
     * Served from Redis cache when available (15-min TTL, stale flag after 10 min).
     */
    public PortfolioNewsResponse getNewsFeed(UUID userId) {
        // ── Try cache ──────────────────────────────────────────────────────
        try {
            String cached = redis.opsForValue().get(CACHE_KEY + userId);
            if (cached != null) {
                PortfolioNewsResponse r = deserializeCache(cached);
                if (r != null) {
                    long ageMin = ChronoUnit.MINUTES.between(r.generatedAt(), Instant.now());
                    boolean stale = ageMin >= STALE_AFTER.toMinutes();
                    log.debug("Serving cached news for user={} (age={}min stale={})", userId, ageMin, stale);
                    if (!stale) return r;
                    // stale — return cached copy but rebuild in the background
                    // (for simplicity, we rebuild synchronously)
                }
            }
        } catch (Exception e) {
            log.warn("News cache read failed for user={}: {}", userId, e.getMessage());
        }

        // ── Build fresh ────────────────────────────────────────────────────
        return buildAndCache(userId);
    }

    /** Forces a cache bust and rebuilds immediately. */
    public PortfolioNewsResponse refreshNewsFeed(UUID userId) {
        try { redis.delete(CACHE_KEY + userId); } catch (Exception ignored) {}
        return buildAndCache(userId);
    }

    // ── Core pipeline ─────────────────────────────────────────────────────────

    private PortfolioNewsResponse buildAndCache(UUID userId) {
        // 1. Get positions
        List<Position> allPositions = positionRepository.findAllByUserId(userId);

        List<Position> topPositions = allPositions.stream()
                .filter(p -> p.getTicker() != null && !p.getTicker().isBlank())
                .sorted(Comparator.comparing(
                        p -> p.getCurrentValue() != null ? p.getCurrentValue().negate() : BigDecimal.ZERO))
                .limit(15)
                .toList();

        List<String> tickers = topPositions.stream()
                .map(Position::getTicker)
                .distinct()
                .toList();

        BigDecimal portfolioValue = allPositions.stream()
                .map(p -> p.getCurrentValue() != null ? p.getCurrentValue() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 2. Fetch news (single Polygon API call)
        List<PolygonNewsArticle> rawArticles = newsGateway.fetchNewsForTickers(tickers, 20);

        // 3. Map to response articles
        Set<String> holdingSet = new HashSet<>(tickers);
        List<NewsArticleResponse> articles = rawArticles.stream()
                .map(a -> toArticleResponse(a, holdingSet))
                .toList();

        // 4. Aggregate sentiment per ticker
        Map<String, TickerSentimentResponse> sentiment = buildSentimentMap(articles, tickers);

        // 5. Upcoming earnings
        List<EarningsEventResponse> earnings = buildEarningsCalendar(topPositions);

        // 6. AI summary
        String aiSummary = fetchAiSummary(userId, topPositions, articles, portfolioValue);

        PortfolioNewsResponse response = new PortfolioNewsResponse(
                articles, earnings, sentiment, aiSummary,
                tickers, portfolioValue, Instant.now(), false);

        // 7. Cache
        try {
            redis.opsForValue().set(CACHE_KEY + userId, serializeCache(response), CACHE_TTL);
        } catch (Exception e) {
            log.warn("News cache write failed for user={}: {}", userId, e.getMessage());
        }

        return response;
    }

    // ── Article mapping ───────────────────────────────────────────────────────

    private NewsArticleResponse toArticleResponse(PolygonNewsArticle raw, Set<String> holdingSet) {
        // Find which article tickers are in the user's portfolio
        List<String> relevant = raw.tickers().stream()
                .filter(holdingSet::contains)
                .toList();

        // Primary sentiment: first insight for a relevant ticker, else first insight overall
        String sentiment = "NEUTRAL";
        String reasoning = null;

        Optional<TickerInsight> primaryInsight = raw.insights().stream()
                .filter(i -> holdingSet.contains(i.ticker()))
                .findFirst();
        if (primaryInsight.isEmpty()) {
            primaryInsight = raw.insights().stream().findFirst();
        }

        if (primaryInsight.isPresent()) {
            sentiment = toLabel(primaryInsight.get().sentiment());
            reasoning = primaryInsight.get().sentimentReasoning();
        } else {
            // Fallback: keyword-based scoring from title
            sentiment = keywordSentiment(raw.title());
        }

        return new NewsArticleResponse(
                raw.id(),
                raw.title(),
                raw.description(),
                raw.publishedUtc(),
                raw.articleUrl(),
                raw.imageUrl(),
                raw.publisher(),
                raw.tickers(),
                relevant,
                sentiment,
                reasoning,
                toRelativeTime(raw.publishedUtc())
        );
    }

    private static String toLabel(String polygon) {
        return switch (polygon.toLowerCase()) {
            case "positive" -> "BULLISH";
            case "negative" -> "BEARISH";
            default         -> "NEUTRAL";
        };
    }

    private static String keywordSentiment(String title) {
        if (title == null) return "NEUTRAL";
        String lower = title.toLowerCase();
        boolean bullish = lower.contains("beat") || lower.contains("surge") ||
                lower.contains("soar") || lower.contains("jump") || lower.contains("rally") ||
                lower.contains("record") || lower.contains("raise") || lower.contains("upgrade") ||
                lower.contains("strong") || lower.contains("buyback") || lower.contains("exceed");
        boolean bearish = lower.contains("miss") || lower.contains("fall") ||
                lower.contains("plunge") || lower.contains("drop") || lower.contains("tumble") ||
                lower.contains("decline") || lower.contains("downgrade") || lower.contains("cut") ||
                lower.contains("warn") || lower.contains("probe") || lower.contains("fine") ||
                lower.contains("layoff") || lower.contains("headwind");
        if (bullish && !bearish) return "BULLISH";
        if (bearish && !bullish) return "BEARISH";
        return "NEUTRAL";
    }

    private static String toRelativeTime(String isoUtc) {
        if (isoUtc == null || isoUtc.isBlank()) return "";
        try {
            Instant published = Instant.parse(isoUtc);
            long minutes = ChronoUnit.MINUTES.between(published, Instant.now());
            if (minutes < 60)   return minutes + "m ago";
            long hours = minutes / 60;
            if (hours  < 24)    return hours + "h ago";
            long days = hours / 24;
            if (days   < 7)     return days == 1 ? "Yesterday" : days + "d ago";
            return DateTimeFormatter.ofPattern("MMM d")
                    .format(published.atZone(ZoneOffset.UTC));
        } catch (Exception e) {
            return "";
        }
    }

    // ── Sentiment aggregation ─────────────────────────────────────────────────

    private Map<String, TickerSentimentResponse> buildSentimentMap(
            List<NewsArticleResponse> articles, List<String> tickers) {

        // Collect scores per ticker:
        //   BULLISH = +1.0, NEUTRAL = 0.5, BEARISH = 0.0
        Map<String, List<Double>> scoresByTicker = new HashMap<>();
        Map<String, String>       topHeadline    = new HashMap<>();

        for (NewsArticleResponse article : articles) {
            double score = switch (article.sentiment()) {
                case "BULLISH" -> 1.0;
                case "BEARISH" -> 0.0;
                default        -> 0.5;
            };

            List<String> relevant = article.relevantTickers().isEmpty()
                    ? article.tickers()
                    : article.relevantTickers();

            for (String ticker : relevant) {
                scoresByTicker.computeIfAbsent(ticker, k -> new ArrayList<>()).add(score);
                topHeadline.putIfAbsent(ticker, article.title());
            }
        }

        Map<String, TickerSentimentResponse> result = new LinkedHashMap<>();
        for (String ticker : tickers) {
            List<Double> scores = scoresByTicker.getOrDefault(ticker, List.of());
            if (scores.isEmpty()) continue; // no news → skip (don't add a "no data" entry)

            double avg = scores.stream().mapToDouble(Double::doubleValue).average().orElse(0.5);
            String label = avg >= 0.6 ? "BULLISH" : avg <= 0.4 ? "BEARISH" : "NEUTRAL";

            result.put(ticker, new TickerSentimentResponse(
                    ticker, label,
                    BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP).doubleValue(),
                    scores.size(),
                    topHeadline.getOrDefault(ticker, "")
            ));
        }
        return result;
    }

    // ── Earnings calendar ─────────────────────────────────────────────────────

    /**
     * Estimates the next earnings date for each holding using quarterly cadence rules.
     *
     * <p>Most US companies report earnings within 30 days after quarter end:
     * <ul>
     *   <li>Q1 (ends Mar 31) → typically Apr 15 – May 15</li>
     *   <li>Q2 (ends Jun 30) → typically Jul 15 – Aug 15</li>
     *   <li>Q3 (ends Sep 30) → typically Oct 15 – Nov 15</li>
     *   <li>Q4 (ends Dec 31) → typically Jan 15 – Feb 15</li>
     * </ul>
     * A ticker hash selects a deterministic day within the window so each holding
     * appears on a different date (realistic stagger).
     */
    private List<EarningsEventResponse> buildEarningsCalendar(List<Position> positions) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<EarningsEventResponse> events = new ArrayList<>();

        for (Position position : positions) {
            LocalDate reportDate = estimateNextEarnings(position.getTicker(), today);
            long daysUntil = ChronoUnit.DAYS.between(today, reportDate);

            // Only show events in the next 90 days (and not already past)
            if (daysUntil < 0 || daysUntil > 90) continue;

            String quarter = earningsQuarter(reportDate);
            events.add(new EarningsEventResponse(
                    position.getTicker(),
                    position.getName() != null ? position.getName() : position.getTicker(),
                    reportDate.toString(),
                    (int) daysUntil,
                    quarter,
                    true   // always estimated — no confirmed calendar source
            ));
        }

        // Sort by daysUntil ascending
        events.sort(Comparator.comparingInt(EarningsEventResponse::daysUntil));
        return events;
    }

    private static LocalDate estimateNextEarnings(String ticker, LocalDate today) {
        // Earnings windows (windowStart is first day of reporting season)
        int year = today.getYear();
        List<LocalDate> windows = List.of(
                LocalDate.of(year,     1, 15),
                LocalDate.of(year,     4, 15),
                LocalDate.of(year,     7, 15),
                LocalDate.of(year,    10, 15),
                LocalDate.of(year + 1, 1, 15)
        );

        // Find the next window that is at least today (may be mid-season)
        LocalDate windowStart = windows.stream()
                .filter(w -> !w.plusDays(30).isBefore(today))  // window hasn't fully passed
                .findFirst()
                .orElse(windows.get(4));

        // Use ticker hash to pick a day offset within the 28-day window
        int dayOffset = Math.abs(ticker.hashCode() % 28);
        LocalDate candidate = windowStart.plusDays(dayOffset);

        // Skip weekends
        if (candidate.getDayOfWeek() == DayOfWeek.SATURDAY) candidate = candidate.plusDays(2);
        if (candidate.getDayOfWeek() == DayOfWeek.SUNDAY)   candidate = candidate.plusDays(1);

        // If the computed date is in the past, roll to the next window
        if (candidate.isBefore(today)) {
            final LocalDate afterDate = candidate;    // effectively-final copy for lambda
            LocalDate nextWindow = windows.stream()
                    .filter(w -> w.isAfter(afterDate))
                    .findFirst()
                    .orElse(LocalDate.of(year + 1, 1, 15));
            candidate = nextWindow.plusDays(dayOffset);
            if (candidate.getDayOfWeek() == DayOfWeek.SATURDAY) candidate = candidate.plusDays(2);
            if (candidate.getDayOfWeek() == DayOfWeek.SUNDAY)   candidate = candidate.plusDays(1);
        }

        return candidate;
    }

    private static String earningsQuarter(LocalDate reportDate) {
        int month = reportDate.getMonthValue();
        int year  = reportDate.getYear();
        // Reporting season follows the previous quarter end
        if (month >= 1 && month <= 3)   return "Q4 " + (year - 1);
        if (month >= 4 && month <= 6)   return "Q1 " + year;
        if (month >= 7 && month <= 9)   return "Q2 " + year;
        return "Q3 " + year;
    }

    // ── AI Summary ────────────────────────────────────────────────────────────

    private String fetchAiSummary(UUID userId,
                                   List<Position> positions,
                                   List<NewsArticleResponse> articles,
                                   BigDecimal portfolioValue) {
        try {
            BigDecimal total = portfolioValue.max(BigDecimal.ONE); // avoid div-by-zero

            List<Map<String, Object>> posPayload = positions.stream()
                    .map(p -> {
                        BigDecimal val = p.getCurrentValue() != null ? p.getCurrentValue() : BigDecimal.ZERO;
                        double wt = val.multiply(BigDecimal.valueOf(100))
                                .divide(total, 1, RoundingMode.HALF_UP)
                                .doubleValue();
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("ticker",        p.getTicker());
                        m.put("name",          p.getName() != null ? p.getName() : "");
                        m.put("current_value", val.doubleValue());
                        m.put("weight_pct",    wt);
                        return m;
                    })
                    .toList();

            List<Map<String, Object>> articlePayload = articles.stream()
                    .limit(15)
                    .map(a -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("title",                a.title());
                        m.put("description",          a.description());
                        m.put("tickers",              a.tickers());
                        m.put("sentiment",            a.sentiment().toLowerCase());
                        m.put("sentiment_reasoning",  a.sentimentReasoning());
                        return m;
                    })
                    .toList();

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("user_id",         userId.toString());
            body.put("positions",       posPayload);
            body.put("articles",        articlePayload);
            body.put("portfolio_value", portfolioValue.doubleValue());

            Map<String, Object> result = restClient.post()
                    .uri(aiServiceUrl + "/analyze/news")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});

            if (result != null && result.get("summary") instanceof String s) {
                return s;
            }
        } catch (Exception e) {
            log.warn("AI news summary failed for user={}: {}", userId, e.getMessage());
        }

        // Fallback when AI service is unavailable
        return buildFallbackSummary(positions, articles, portfolioValue);
    }

    private String buildFallbackSummary(List<Position> positions,
                                         List<NewsArticleResponse> articles,
                                         BigDecimal portfolioValue) {
        if (articles.isEmpty()) {
            return "No significant news affecting your holdings today. Markets appear quiet.";
        }

        long bullish = articles.stream().filter(a -> "BULLISH".equals(a.sentiment())).count();
        long bearish = articles.stream().filter(a -> "BEARISH".equals(a.sentiment())).count();

        String topTicker = positions.isEmpty() ? "your top holdings" : positions.get(0).getTicker();
        String topTitle  = articles.get(0).title();

        String mood = bullish > bearish ? "generally positive" : bearish > bullish ? "mixed to negative" : "mixed";
        return String.format(
            "News sentiment for your portfolio is %s today, with %d bullish and %d bearish signals. "
            + "The top story affecting %s: \"%s.\" "
            + "Monitor positions closely for any price action triggered by these developments.",
            mood, bullish, bearish, topTicker, topTitle.length() > 80 ? topTitle.substring(0, 77) + "..." : topTitle
        );
    }

    // ── Cache serialisation ───────────────────────────────────────────────────

    private String serializeCache(PortfolioNewsResponse r) throws Exception {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("articles",          JSON.writeValueAsString(r.articles()));
        m.put("earnings",          JSON.writeValueAsString(r.earnings()));
        m.put("sentimentByTicker", JSON.writeValueAsString(r.sentimentByTicker()));
        m.put("aiSummary",         r.aiSummary());
        m.put("topHoldings",       r.topHoldings());
        m.put("portfolioValue",    r.portfolioValue().toString());
        m.put("generatedAt",       r.generatedAt().toString());
        return JSON.writeValueAsString(m);
    }

    @SuppressWarnings("unchecked")
    private PortfolioNewsResponse deserializeCache(String json) {
        try {
            Map<String, Object> m = JSON.readValue(json, Map.class);
            List<NewsArticleResponse> articles = JSON.readValue(
                    (String) m.get("articles"),
                    JSON.getTypeFactory().constructCollectionType(List.class, NewsArticleResponse.class));
            List<EarningsEventResponse> earnings = JSON.readValue(
                    (String) m.get("earnings"),
                    JSON.getTypeFactory().constructCollectionType(List.class, EarningsEventResponse.class));
            Map<String, TickerSentimentResponse> sentiment = JSON.readValue(
                    (String) m.get("sentimentByTicker"),
                    JSON.getTypeFactory().constructMapType(LinkedHashMap.class,
                            String.class, TickerSentimentResponse.class));
            String aiSummary  = (String) m.get("aiSummary");
            List<String> topH = (List<String>) m.get("topHoldings");
            BigDecimal pv     = new BigDecimal((String) m.get("portfolioValue"));
            Instant generatedAt = Instant.parse((String) m.get("generatedAt"));

            long ageMin = ChronoUnit.MINUTES.between(generatedAt, Instant.now());
            return new PortfolioNewsResponse(articles, earnings, sentiment, aiSummary,
                    topH, pv, generatedAt, ageMin >= STALE_AFTER.toMinutes());
        } catch (Exception e) {
            log.warn("Failed to deserialise news cache: {}", e.getMessage());
            return null;
        }
    }
}
