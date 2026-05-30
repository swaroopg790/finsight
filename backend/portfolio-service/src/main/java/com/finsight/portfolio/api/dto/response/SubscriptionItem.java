package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A detected recurring subscription or bill.
 */
public record SubscriptionItem(
        String     merchantName,
        String     category,
        String     categoryLabel,
        String     categoryEmoji,
        BigDecimal typicalAmount,         // median charge amount (positive = cost)
        BigDecimal annualCost,            // typicalAmount * 12
        LocalDate  lastChargeDate,
        LocalDate  nextExpectedDate,      // estimated next charge date
        String     frequency,             // "Monthly", "Weekly", "Bi-weekly"
        int        occurrences            // how many times seen in the data window
) {}
