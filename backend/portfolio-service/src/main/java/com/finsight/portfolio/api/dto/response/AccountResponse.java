package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

public record AccountResponse(
        UUID accountId,
        String name,
        String type,
        String subtype,
        BigDecimal balanceCurrent,
        BigDecimal balanceAvailable,
        String currency,
        String institutionName
) {}
