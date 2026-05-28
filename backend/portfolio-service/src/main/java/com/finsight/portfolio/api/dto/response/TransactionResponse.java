package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record TransactionResponse(
        UUID      id,
        String    ticker,
        String    securityName,
        String    transactionType,   // BUY, SELL, DIVIDEND, FEE, TRANSFER, OTHER
        BigDecimal quantity,
        BigDecimal price,
        BigDecimal amount,           // negative = buy (cash out), positive = sell/dividend (cash in)
        LocalDate transactionDate,
        String    accountName,
        String    institutionName
) {}
