package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * IRS wash-sale alert: a loss was sold but the same security was purchased
 * within 30 days before or after the sale, disqualifying the loss deduction.
 */
public record WashSaleWarning(
        String      ticker,
        String      securityName,
        LocalDate   saleDate,
        LocalDate   relatedBuyDate,
        BigDecimal  lossAmount,
        String      message
) {}
