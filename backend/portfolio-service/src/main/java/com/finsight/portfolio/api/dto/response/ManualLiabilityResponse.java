package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ManualLiabilityResponse(
        UUID       id,
        String     name,
        String     liabilityType,
        String     liabilityTypeLabel,
        String     emoji,
        BigDecimal balance,
        BigDecimal interestRate,
        String     notes,
        Instant    updatedAt
) {}
