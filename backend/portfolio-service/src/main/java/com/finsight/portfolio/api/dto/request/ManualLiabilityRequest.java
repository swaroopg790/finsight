package com.finsight.portfolio.api.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ManualLiabilityRequest(
        @NotBlank String     name,
        @NotBlank String     liabilityType,
        @NotNull @DecimalMin("0") BigDecimal balance,
        BigDecimal           interestRate,   // optional
        String               notes
) {}
