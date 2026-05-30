package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A single event on the cash flow calendar.
 */
public record CashFlowEvent(
        LocalDate  date,
        String     type,           // "BILL", "INCOME", "ACTUAL"
        String     description,    // merchant name or "Payroll"
        String     category,
        String     categoryEmoji,
        BigDecimal amount,         // positive = income, negative = expense
        boolean    predicted       // true = projected; false = actual transaction
) {}
