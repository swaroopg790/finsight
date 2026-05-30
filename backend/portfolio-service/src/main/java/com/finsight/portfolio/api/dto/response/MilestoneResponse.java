package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MilestoneResponse(
        BigDecimal threshold,
        String     label,      // "You crossed $100K net worth! 🎉"
        String     emoji,
        LocalDate  achievedOn
) {}
