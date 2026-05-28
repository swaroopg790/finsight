package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Performance chart payload.
 *
 * portfolio  — user's daily portfolio values
 * spy        — S&P 500 (SPY ETF) normalised to user's portfolio start value
 * qqq        — Nasdaq-100 (QQQ ETF) normalised to user's portfolio start value
 *
 * Both benchmarks are normalised so that their Day-0 value equals the user's
 * portfolio value on the first day of the requested period.  This lets the
 * frontend plot all three lines on the same dollar axis.
 */
public record PerformanceResponse(
        List<DataPoint> portfolio,
        List<DataPoint> spy,
        List<DataPoint> qqq
) {
    public record DataPoint(LocalDate date, BigDecimal value) {}
}
