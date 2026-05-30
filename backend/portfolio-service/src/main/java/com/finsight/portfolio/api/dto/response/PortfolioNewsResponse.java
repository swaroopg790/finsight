package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Complete portfolio-filtered news feed for a user.
 *
 * Cached in Redis for 15 minutes — stale flag is set when the cached copy
 * is older than 10 minutes so the UI can show a soft refresh hint.
 */
public record PortfolioNewsResponse(
        List<NewsArticleResponse>             articles,
        List<EarningsEventResponse>           earnings,
        Map<String, TickerSentimentResponse>  sentimentByTicker,
        String                                aiSummary,
        List<String>                          topHoldings,
        BigDecimal                            portfolioValue,
        Instant                               generatedAt,
        boolean                               stale   // true when served from cache > 10 min old
) {}
