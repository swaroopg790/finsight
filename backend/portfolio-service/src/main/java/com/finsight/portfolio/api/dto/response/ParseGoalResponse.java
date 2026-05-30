package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ParseGoalResponse(
        boolean    success,
        String     name,
        String     goalType,
        String     goalTypeLabel,
        String     emoji,
        BigDecimal targetAmount,
        LocalDate  targetDate,
        BigDecimal monthlyContribution   // null if not detected
) {}
