package com.finsight.portfolio.api.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;

import java.math.BigDecimal;

public record AlertPreferenceRequest(
        boolean    enabled,

        /** Required for PORTFOLIO_DROP alerts; ignored for WEEKLY_SUMMARY. */
        @DecimalMin("0.5") @DecimalMax("20.0")
        BigDecimal thresholdPct,

        /** Optional override email for notifications. */
        @Email
        String     notificationEmail
) {}
