package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;

/** One slice of the asset allocation pie chart. */
public record AllocationItem(
        String     ticker,
        String     name,
        BigDecimal value,
        BigDecimal weightPct   // percentage of total priced portfolio, e.g. 23.45
) {}
