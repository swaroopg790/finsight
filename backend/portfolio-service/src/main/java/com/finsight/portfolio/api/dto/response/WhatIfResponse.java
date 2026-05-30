package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;

public record WhatIfResponse(
        double     successProbability,
        double     baselineProbability,
        double     probabilityDelta,    // positive = improvement
        BigDecimal p50Final,
        BigDecimal p10Final,
        BigDecimal p90Final
) {}
