package com.finsight.portfolio.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One data point on the portfolio performance chart: a date + total portfolio value. */
public record SnapshotPoint(LocalDate date, BigDecimal totalValue) {}
