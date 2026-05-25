package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

public record HoldingResponse(
        UUID positionId,
        String ticker,
        String name,
        BigDecimal quantity,
        BigDecimal costBasis,
        BigDecimal currentPrice,
        BigDecimal currentValue,
        BigDecimal unrealizedGainLoss,
        BigDecimal unrealizedGainLossPct,
        String accountName
) {}
