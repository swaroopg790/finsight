package com.finsight.portfolio.api.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateGoalRequest(
        @NotBlank String    name,
        @NotBlank String    goalType,
        @NotNull  @DecimalMin("1") BigDecimal targetAmount,
        @NotNull  @Future   LocalDate targetDate,
        BigDecimal currentValue,
        BigDecimal monthlyContribution,
        BigDecimal expectedReturnPct,
        BigDecimal volatilityPct,
        String     notes
) {}
