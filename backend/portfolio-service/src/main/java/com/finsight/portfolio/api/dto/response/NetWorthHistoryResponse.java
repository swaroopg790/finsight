package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record NetWorthHistoryResponse(
        String            period,    // "1Y", "3Y", "5Y", "ALL"
        List<DataPoint>   points,
        BigDecimal        startValue,
        BigDecimal        endValue,
        BigDecimal        change,
        BigDecimal        changePct
) {
    public record DataPoint(
            LocalDate  date,
            BigDecimal netWorth,
            BigDecimal totalAssets,
            BigDecimal totalLiabilities
    ) {}
}
