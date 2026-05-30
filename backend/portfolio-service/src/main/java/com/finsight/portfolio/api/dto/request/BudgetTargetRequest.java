package com.finsight.portfolio.api.dto.request;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Request body for updating monthly budget targets.
 * The map key is the category name (e.g. "GROCERIES"), value is the monthly budget amount.
 */
public record BudgetTargetRequest(
        Map<String, BigDecimal> targets   // category → monthlyBudget
) {}
