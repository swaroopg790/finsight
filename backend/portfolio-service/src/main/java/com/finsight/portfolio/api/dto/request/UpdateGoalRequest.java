package com.finsight.portfolio.api.dto.request;

import java.math.BigDecimal;
import java.time.LocalDate;

/** All fields optional — only provided fields are updated. */
public record UpdateGoalRequest(
        String     name,
        BigDecimal targetAmount,
        LocalDate  targetDate,
        BigDecimal currentValue,
        BigDecimal monthlyContribution,
        BigDecimal expectedReturnPct,
        BigDecimal volatilityPct,
        String     notes
) {}
