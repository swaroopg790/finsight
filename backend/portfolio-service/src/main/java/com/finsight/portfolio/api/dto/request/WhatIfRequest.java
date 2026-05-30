package com.finsight.portfolio.api.dto.request;

import java.math.BigDecimal;

/**
 * What-if scenario override for a specific goal.
 * All fields are optional — omitted fields use the goal's current values.
 */
public record WhatIfRequest(
        BigDecimal currentValue,
        BigDecimal monthlyContribution,
        BigDecimal expectedReturnPct,
        BigDecimal volatilityPct
) {}
