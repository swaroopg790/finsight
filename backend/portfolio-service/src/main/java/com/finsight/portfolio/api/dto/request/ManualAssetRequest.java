package com.finsight.portfolio.api.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ManualAssetRequest(
        @NotBlank String     name,
        @NotBlank String     assetType,
        @NotNull @DecimalMin("0") BigDecimal value,
        String               notes
) {}
