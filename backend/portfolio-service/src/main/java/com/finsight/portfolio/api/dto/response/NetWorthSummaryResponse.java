package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Full net-worth summary returned by GET /api/v1/networth/summary
 */
public record NetWorthSummaryResponse(
        // ── Headline ──────────────────────────────────────────────────────────
        BigDecimal netWorth,
        LocalDate  asOf,

        // ── Assets ────────────────────────────────────────────────────────────
        BigDecimal totalAssets,
        BigDecimal investmentValue,   // brokerage holdings
        BigDecimal depositoryValue,   // checking + savings
        BigDecimal creditAssetValue,  // credit accounts with positive balance (uncommon)
        BigDecimal manualAssetValue,  // user-entered: real estate, vehicles, etc.

        // ── Liabilities ───────────────────────────────────────────────────────
        BigDecimal totalLiabilities,
        BigDecimal creditCardBalance, // Plaid credit accounts
        BigDecimal loanBalance,       // Plaid loan accounts
        BigDecimal manualLiabilityBalance,

        // ── Change vs yesterday ───────────────────────────────────────────────
        BigDecimal changeToday,
        BigDecimal changeTodayPct,

        // ── Milestones ────────────────────────────────────────────────────────
        List<MilestoneResponse> newMilestones,

        // ── Line items ────────────────────────────────────────────────────────
        List<ManualAssetResponse>     manualAssets,
        List<ManualLiabilityResponse> manualLiabilities,

        // ── Plaid account breakdown ───────────────────────────────────────────
        List<AccountLineItem> plaidAccounts
) {
    /** A single Plaid account's contribution to the net-worth calculation. */
    public record AccountLineItem(
            String     name,
            String     institutionName,
            String     type,
            String     subtype,
            BigDecimal balance,
            boolean    isLiability  // true for credit/loan accounts
    ) {}
}
