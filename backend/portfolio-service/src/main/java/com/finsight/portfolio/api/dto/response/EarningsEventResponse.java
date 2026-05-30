package com.finsight.portfolio.api.dto.response;

/**
 * Estimated upcoming earnings event for a holding.
 *
 * Dates are estimated from quarterly cadence when no confirmed calendar is available.
 */
public record EarningsEventResponse(
        String ticker,
        String companyName,
        String reportDate,   // ISO-8601 date string  e.g. "2026-07-24"
        int    daysUntil,
        String quarter,      // e.g. "Q2 2026"
        boolean estimated    // true when the date is projected, not confirmed
) {}
