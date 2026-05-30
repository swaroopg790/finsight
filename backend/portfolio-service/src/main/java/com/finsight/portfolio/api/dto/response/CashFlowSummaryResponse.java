package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.util.List;

/**
 * Cash flow calendar + subscription intelligence response.
 */
public record CashFlowSummaryResponse(
        BigDecimal currentBalance,               // sum of checking + savings balances
        BigDecimal projectedBalance30Days,       // estimated balance 30 days from now
        BigDecimal totalMonthlySubscriptions,    // sum of typical subscription amounts
        BigDecimal totalMonthlyBills,            // utilities + rent + recurring non-subscriptions
        List<SubscriptionItem>  subscriptions,
        List<CashFlowEvent>     calendarEvents   // next 30 days + past 30 days actuals
) {}
