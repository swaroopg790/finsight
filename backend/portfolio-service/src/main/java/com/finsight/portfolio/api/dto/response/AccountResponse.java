package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

public record AccountResponse(
        UUID accountId,
        UUID plaidItemId,       // institution-level item — used by DELETE /plaid/items/{id}
        String name,
        String type,
        String subtype,
        BigDecimal balanceCurrent,
        BigDecimal balanceAvailable,
        String currency,
        String institutionName
) {}
