package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.util.List;

/**
 * Full tax-intelligence payload returned by GET /api/v1/tax/summary.
 */
public record TaxSummaryResponse(
        int    taxYear,
        String costBasisMethod,

        // ── Realised gains (year-to-date within taxYear) ──────────────────────
        BigDecimal shortTermRealizedGains,
        BigDecimal longTermRealizedGains,
        BigDecimal totalRealizedGains,

        // ── Unrealised gains on current positions ─────────────────────────────
        BigDecimal shortTermUnrealizedGains,
        BigDecimal longTermUnrealizedGains,
        BigDecimal totalUnrealizedGains,

        // ── Estimated tax exposure ─────────────────────────────────────────────
        BigDecimal estimatedTaxOwed,
        double     shortTermTaxRate,
        double     longTermTaxRate,

        // ── Year-end context ──────────────────────────────────────────────────
        int    daysRemainingInYear,
        String yearEndAdvice,

        // ── Harvest summary ────────────────────────────────────────────────────
        BigDecimal totalHarvestableLosses,
        BigDecimal estimatedHarvestSavings,

        // ── Detail lists ──────────────────────────────────────────────────────
        List<RealizedGainItem>    realizedGains,
        List<HarvestOpportunity>  harvestOpportunities,
        List<WashSaleWarning>     washSaleWarnings
) {}
