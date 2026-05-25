package com.finsight.portfolio.api.dto.request;

import jakarta.validation.constraints.NotBlank;

public record PlaidExchangeRequest(
        @NotBlank String publicToken,
        String institutionId,
        String institutionName
) {}
