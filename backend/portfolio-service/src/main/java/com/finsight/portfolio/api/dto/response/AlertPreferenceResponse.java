package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;

public record AlertPreferenceResponse(
        String     alertType,
        boolean    enabled,
        BigDecimal thresholdPct,
        String     notificationEmail
) {}
