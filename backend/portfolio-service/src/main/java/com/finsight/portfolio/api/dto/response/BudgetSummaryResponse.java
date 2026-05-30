package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.util.List;

/**
 * Full budget summary for a given month.
 */
public record BudgetSummaryResponse(
        int    year,
        int    month,
        String monthLabel,                        // e.g. "May 2026"

        BigDecimal totalSpent,                    // sum of all DEBIT transactions this month
        BigDecimal totalIncome,                   // sum of all CREDIT transactions this month
        BigDecimal netCashFlow,                   // income - spent
        BigDecimal totalBudgeted,                 // sum of all budget targets

        List<CategorySpendingItem> categories     // per-category breakdown
) {}
