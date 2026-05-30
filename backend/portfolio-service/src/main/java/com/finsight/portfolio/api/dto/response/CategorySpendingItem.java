package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;

/**
 * Spending summary for a single category in a given month.
 */
public record CategorySpendingItem(
        String     category,          // e.g. "GROCERIES"
        String     label,             // e.g. "Groceries"
        String     emoji,             // e.g. "🛒"
        BigDecimal actual,            // amount actually spent (always positive)
        BigDecimal budget,            // monthly budget target (0 if not set)
        double     budgetUsedPct,     // actual / budget * 100 (0 if no budget set)
        long       transactionCount
) {}
