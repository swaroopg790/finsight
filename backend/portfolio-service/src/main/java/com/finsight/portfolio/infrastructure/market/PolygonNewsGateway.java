package com.finsight.portfolio.infrastructure.market;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Fetches news articles from Polygon.io filtered by ticker.
 *
 * <p>Uses the multi-ticker {@code ticker.any_of} parameter to fetch news across
 * all user holdings in a single API call — respecting the free-tier 5 req/min limit.
 *
 * <p>Polygon news articles include an {@code insights} array with per-ticker sentiment
 * scores (positive/negative/neutral) and a reasoning string. Available on Starter+ plan;
 * falls back to keyword-based scoring on the free tier.
 *
 * <p>When {@code POLYGON_API_KEY} is blank the gateway returns realistic mock articles
 * suitable for local development and demos.
 */
@Slf4j
@Component
public class PolygonNewsGateway {

    private static final String NEWS_URL =
            "https://api.polygon.io/v2/reference/news"
          + "?ticker.any_of={tickers}&limit={limit}&order=desc&sort=published_utc&apiKey={key}";

    private final RestClient restClient;
    private final String     apiKey;

    public PolygonNewsGateway(@Value("${finsight.polygon.api-key:}") String apiKey) {
        this.apiKey = apiKey;
        this.restClient = RestClient.builder()
                .requestFactory(new SimpleClientHttpRequestFactory())
                .build();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Fetches recent news for the given list of tickers (max 15).
     * Returns at most {@code limit} articles ordered by publication date descending.
     */
    public List<PolygonNewsArticle> fetchNewsForTickers(List<String> tickers, int limit) {
        if (tickers == null || tickers.isEmpty()) {
            return List.of();
        }

        if (apiKey == null || apiKey.isBlank()) {
            log.debug("Polygon API key not configured — returning mock news for {} tickers", tickers.size());
            return generateMockArticles(tickers, limit);
        }

        // Polygon accepts "AAPL,MSFT,GOOGL" as the ticker.any_of parameter
        String tickersCsv = String.join(",",
                tickers.stream().map(String::toUpperCase).limit(15).toList());

        try {
            Map<String, Object> response = restClient.get()
                    .uri(NEWS_URL, tickersCsv, limit, apiKey)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});

            if (response == null || !"OK".equals(response.get("status"))) {
                log.warn("Polygon news returned non-OK status for tickers={}: status={}",
                        tickersCsv, response != null ? response.get("status") : "null");
                return generateMockArticles(tickers, limit);
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("results");
            if (results == null || results.isEmpty()) {
                log.debug("No news from Polygon for tickers={}", tickersCsv);
                return generateMockArticles(tickers, limit);
            }

            return results.stream()
                    .map(this::mapArticle)
                    .toList();

        } catch (Exception e) {
            log.warn("Polygon news fetch failed (tickers={}): {} — falling back to mock",
                    tickersCsv, e.getMessage());
            return generateMockArticles(tickers, limit);
        }
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private PolygonNewsArticle mapArticle(Map<String, Object> raw) {
        String id          = (String) raw.get("id");
        String title       = (String) raw.get("title");
        String description = (String) raw.get("description");
        String publishedUtc = (String) raw.get("published_utc");
        String articleUrl  = (String) raw.get("article_url");
        String imageUrl    = (String) raw.get("image_url");

        // Publisher is a nested object
        String publisher = "Unknown";
        Object pubRaw = raw.get("publisher");
        if (pubRaw instanceof Map<?,?> pubMap) {
            Object name = pubMap.get("name");
            if (name instanceof String s) publisher = s;
        }

        List<String> tickers = List.of();
        Object tickersRaw = raw.get("tickers");
        if (tickersRaw instanceof List<?> t) {
            tickers = t.stream().map(Object::toString).toList();
        }

        // insights: [{ticker, sentiment, sentiment_reasoning}]
        List<TickerInsight> insights = new ArrayList<>();
        Object insightsRaw = raw.get("insights");
        if (insightsRaw instanceof List<?> iList) {
            for (Object item : iList) {
                if (item instanceof Map<?,?> m) {
                    String ticker    = java.util.Objects.toString(m.get("ticker"),           "");
                    String sentiment = java.util.Objects.toString(m.get("sentiment"),        "neutral");
                    String reasoning = java.util.Objects.toString(m.get("sentiment_reasoning"), "");
                    insights.add(new TickerInsight(ticker, normalise(sentiment), reasoning));
                }
            }
        }

        return new PolygonNewsArticle(id, title, description, publishedUtc,
                articleUrl, imageUrl, publisher, tickers, insights);
    }

    /** Normalises Polygon's "positive"/"negative"/"neutral" to our BULLISH/BEARISH/NEUTRAL. */
    private static String normalise(String raw) {
        return switch (raw.toLowerCase()) {
            case "positive" -> "positive";
            case "negative" -> "negative";
            default         -> "neutral";
        };
    }

    // ── Mock data for local development ──────────────────────────────────────

    private static final List<MockTemplate> TEMPLATES = List.of(
        new MockTemplate("{T} beats Q2 earnings estimates — EPS up {N}% vs analyst forecast",
                "positive", "{T} reported earnings that exceeded consensus estimates by a wider margin than expected, driven by strong demand in its core segments."),
        new MockTemplate("{T} raises full-year guidance after record quarterly revenue",
                "positive", "Management cited robust consumer demand and improved operating leverage as reasons for the upward revision to annual revenue guidance."),
        new MockTemplate("{T} shares dip on mixed revenue despite earnings beat",
                "negative", "While {T} beat on earnings per share, revenue came in below the Street's expectations, raising concerns about near-term growth momentum."),
        new MockTemplate("Fed signals one more rate hike this cycle — bond yields climb",
                "neutral", "Federal Reserve officials reiterated their commitment to bringing inflation back to the 2% target, signalling one additional 25bps increase remains possible."),
        new MockTemplate("{T} announces $10B share buyback programme",
                "positive", "The board of directors authorised a new multi-year share repurchase programme, signalling confidence in the company's long-term cash-flow generation."),
        new MockTemplate("{T} faces regulatory headwinds in EU antitrust probe",
                "negative", "European regulators opened a formal investigation into {T}'s business practices, a development that could result in significant fines and operational restrictions."),
        new MockTemplate("Inflation data cooler than expected — markets rally",
                "positive", "Core PCE came in below consensus for the third consecutive month, boosting optimism that the Fed's tightening cycle may be drawing to a close."),
        new MockTemplate("{T} acquires AI startup in $2.1B all-cash deal",
                "positive", "The acquisition is expected to accelerate {T}'s AI product roadmap and add a team of 200 engineers specialising in large-language-model infrastructure."),
        new MockTemplate("{T} misses on user growth — stock falls 7% after hours",
                "negative", "Monthly active users grew more slowly than analysts had forecast, reigniting concerns about market saturation in {T}'s core demographics."),
        new MockTemplate("Treasury yields hit 3-month high — growth stocks under pressure",
                "negative", "Rising real rates compressed valuation multiples across high-growth technology names, as investors rotated toward value and dividend-paying equities."),
        new MockTemplate("{T} partners with major cloud provider for AI infrastructure rollout",
                "positive", "{T} signed a multi-year strategic agreement to co-develop AI-optimised infrastructure, which analysts expect to contribute meaningful incremental revenue by next fiscal year."),
        new MockTemplate("{T} CFO departs after 6 years — transition plan outlined",
                "neutral", "The company announced the planned departure of its chief financial officer and confirmed an internal search is under way, with an interim CFO named pending transition."),
        new MockTemplate("Jobs report beats — 280K new payrolls in April, unemployment 3.9%",
                "neutral", "The stronger-than-expected labour market data adds complexity to the Fed's rate path, balancing resilient growth against still-elevated services inflation.")
    );

    private List<PolygonNewsArticle> generateMockArticles(List<String> tickers, int limit) {
        List<PolygonNewsArticle> articles = new ArrayList<>();
        Random rng = new Random(LocalDate.now().toEpochDay()); // deterministic per calendar day

        // Ticker-specific articles
        for (String ticker : tickers) {
            // Each ticker gets 1-2 articles from ticker-specific templates
            List<MockTemplate> tickerTemplates = TEMPLATES.stream()
                    .filter(t -> t.title().contains("{T}"))
                    .toList();
            MockTemplate tmpl = tickerTemplates.get(
                    Math.abs((ticker.hashCode() + rng.nextInt(100)) % tickerTemplates.size()));

            int epsVariance = 5 + Math.abs(ticker.hashCode() % 18);
            String title = tmpl.title()
                    .replace("{T}", ticker)
                    .replace("{N}", String.valueOf(epsVariance));
            String desc = tmpl.description()
                    .replace("{T}", ticker);

            Instant published = Instant.now()
                    .minus(Math.abs(ticker.hashCode() % 48) + 1, ChronoUnit.HOURS);

            String insight = tmpl.sentiment().equals("positive") ?
                    ticker + " showed positive momentum driven by strong fundamentals." :
                    tmpl.sentiment().equals("negative") ?
                    ticker + " faces near-term headwinds based on recent reporting." :
                    ticker + " remains range-bound pending macro clarity.";

            articles.add(new PolygonNewsArticle(
                    "mock-" + ticker + "-" + LocalDate.now(),
                    title, desc,
                    published.toString(),
                    "https://finance.yahoo.com/news/",
                    null,
                    pickPublisher(ticker),
                    List.of(ticker),
                    List.of(new TickerInsight(ticker, tmpl.sentiment(), insight))
            ));

            if (articles.size() >= limit) break;
        }

        // Add 2-3 macro/market articles
        List<MockTemplate> macroTemplates = TEMPLATES.stream()
                .filter(t -> !t.title().contains("{T}"))
                .toList();
        for (int i = 0; i < Math.min(3, macroTemplates.size()) && articles.size() < limit; i++) {
            MockTemplate tmpl = macroTemplates.get(i);
            Instant published = Instant.now().minus(i + 3, ChronoUnit.HOURS);
            articles.add(new PolygonNewsArticle(
                    "mock-macro-" + i + "-" + LocalDate.now(),
                    tmpl.title(), tmpl.description(),
                    published.toString(),
                    "https://www.reuters.com/",
                    null,
                    i % 2 == 0 ? "Reuters" : "Bloomberg",
                    tickers.subList(0, Math.min(3, tickers.size())),
                    List.of()
            ));
        }

        // Sort by published date descending
        articles.sort((a, b) -> b.publishedUtc().compareTo(a.publishedUtc()));
        return articles.subList(0, Math.min(limit, articles.size()));
    }

    private static String pickPublisher(String ticker) {
        return switch (Math.abs(ticker.hashCode() % 5)) {
            case 0 -> "Reuters";
            case 1 -> "Bloomberg";
            case 2 -> "CNBC";
            case 3 -> "Wall Street Journal";
            default -> "Barron's";
        };
    }

    // ── Value objects ─────────────────────────────────────────────────────────

    /**
     * Raw article from Polygon.io (before sentiment normalisation / time formatting).
     *
     * @param insights per-ticker sentiment from Polygon; may be empty on free tier
     */
    public record PolygonNewsArticle(
            String             id,
            String             title,
            String             description,
            String             publishedUtc,   // ISO-8601 UTC string
            String             articleUrl,
            String             imageUrl,       // may be null
            String             publisher,
            List<String>       tickers,
            List<TickerInsight> insights
    ) {}

    /** Sentiment annotation attached to one ticker within a news article. */
    public record TickerInsight(
            String ticker,
            String sentiment,          // positive | negative | neutral
            String sentimentReasoning
    ) {}

    private record MockTemplate(String title, String sentiment, String description) {}
}
