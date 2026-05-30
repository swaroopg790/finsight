package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A single realized-gain/loss event produced by matching a SELL against one or
 * more tax lots.  One sell transaction can generate multiple items when it
 * straddles lots with different purchase dates (short-term vs long-term split).
 */
public record RealizedGainItem(
        String      ticker,
        String      securityName,
        BigDecimal  quantity,
        BigDecimal  proceeds,
        BigDecimal  costBasis,
        BigDecimal  gainLoss,
        boolean     longTerm,
        LocalDate   saleDate,
        LocalDate   purchaseDate,
        long        holdingDays,
        String      accountName
) {}
