package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.Instant;

public record GoalProjectionResponse(
        BigDecimal successProbability,
        BigDecimal p10Final,
        BigDecimal p25Final,
        BigDecimal p50Final,
        BigDecimal p75Final,
        BigDecimal p90Final,
        String     yearlyBands,     // JSON string
        int        simulationPaths,
        Instant    computedAt
) {}
