package com.finsight.portfolio.api.dto.response;

import java.util.List;

/**
 * A single news article enriched with per-ticker sentiment from Polygon.io.
 *
 * sentiment is one of: BULLISH | BEARISH | NEUTRAL
 */
public record NewsArticleResponse(
        String       id,
        String       title,
        String       description,
        String       publishedUtc,
        String       articleUrl,
        String       imageUrl,
        String       publisher,
        List<String> tickers,
        List<String> relevantTickers,  // intersection of article tickers + user's holdings
        String       sentiment,         // BULLISH | BEARISH | NEUTRAL
        String       sentimentReasoning,
        String       relativeTime       // "2h ago", "yesterday", etc.
) {}
