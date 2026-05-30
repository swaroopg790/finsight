package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ManualAssetResponse(
        UUID       id,
        String     name,
        String     assetType,
        String     assetTypeLabel,
        String     emoji,
        BigDecimal value,
        String     notes,
        Instant    updatedAt
) {}
