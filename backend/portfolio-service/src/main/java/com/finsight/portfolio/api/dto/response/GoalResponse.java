package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record GoalResponse(
        UUID       id,
        String     name,
        String     goalType,
        String     goalTypeLabel,
        String     emoji,
        BigDecimal targetAmount,
        LocalDate  targetDate,
        BigDecimal currentValue,
        BigDecimal monthlyContribution,
        BigDecimal expectedReturnPct,
        BigDecimal volatilityPct,
        String     notes,
        BigDecimal progressFraction,   // 0.0 – 1.0
        long       yearsLeft,
        long       daysLeft,
        GoalProjectionResponse projection,
        Instant    createdAt
) {}
