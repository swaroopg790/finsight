package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record TransactionResponse(
        UUID       id,
        String     ticker,
        String     securityName,
        String     transactionType,   // BUY, SELL, DIVIDEND, DEBIT, CREDIT, etc.
        BigDecimal quantity,
        BigDecimal price,
        BigDecimal amount,            // negative = expense/buy (cash out), positive = income/sell
        LocalDate  transactionDate,
        String     accountName,
        String     institutionName,
        String     source,            // "INVESTMENT" or "BANK"
        String     category,          // spending category for BANK transactions (nullable)
        String     merchantName       // merchant/payee name for BANK transactions (nullable)
) {}
