package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;

/**
 * A current position with an unrealised loss large enough to be worth
 * harvesting.  The recommendation string is ready for display in the UI.
 */
public record HarvestOpportunity(
        String      ticker,
        String      securityName,
        BigDecimal  quantity,
        BigDecimal  currentValue,
        BigDecimal  costBasis,
        BigDecimal  unrealizedLoss,
        BigDecimal  estimatedTaxSavings,
        boolean     shortTerm,
        boolean     washSaleRisk,
        String      recommendation
) {}
