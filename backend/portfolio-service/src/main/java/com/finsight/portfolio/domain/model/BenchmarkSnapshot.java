package com.finsight.portfolio.domain.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "benchmark_snapshots",
       uniqueConstraints = @UniqueConstraint(columnNames = {"ticker", "snapshot_date"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BenchmarkSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** 'SPY' (S&P 500 ETF) or 'QQQ' (Nasdaq-100 ETF). */
    @Column(name = "ticker", nullable = false, length = 20)
    private String ticker;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "close_price", nullable = false, precision = 18, scale = 4)
    private BigDecimal closePrice;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
