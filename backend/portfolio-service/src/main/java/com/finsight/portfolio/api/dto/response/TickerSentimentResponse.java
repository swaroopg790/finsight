package com.finsight.portfolio.api.dto.response;

/**
 * Aggregated news sentiment for a single ticker over the past 7 days.
 *
 * score: 0.0 = fully bearish, 0.5 = neutral, 1.0 = fully bullish
 */
public record TickerSentimentResponse(
        String ticker,
        String label,          // BULLISH | BEARISH | NEUTRAL
        double score,          // 0.0 – 1.0
        int    articleCount,
        String topHeadline     // most recent headline for this ticker
) {}
