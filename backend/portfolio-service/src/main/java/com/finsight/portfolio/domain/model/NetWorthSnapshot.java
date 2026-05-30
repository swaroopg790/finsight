package com.finsight.portfolio.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Daily net-worth snapshot for a user.
 *
 * <p>One row per (user, date) — upserted whenever a snapshot is triggered.
 * The snapshot is auto-triggered on every sync and on-demand from the frontend.
 */
@Entity
@Table(name = "net_worth_snapshots",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "snapshot_date"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class NetWorthSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    // ── Asset components ──────────────────────────────────────────────────────
    @Column(name = "investment_value",   nullable = false, precision = 18, scale = 4) @Builder.Default
    private BigDecimal investmentValue   = BigDecimal.ZERO;

    @Column(name = "depository_value",   nullable = false, precision = 18, scale = 4) @Builder.Default
    private BigDecimal depositoryValue   = BigDecimal.ZERO;

    @Column(name = "manual_asset_value", nullable = false, precision = 18, scale = 4) @Builder.Default
    private BigDecimal manualAssetValue  = BigDecimal.ZERO;

    @Column(name = "total_assets",       nullable = false, precision = 18, scale = 4) @Builder.Default
    private BigDecimal totalAssets       = BigDecimal.ZERO;

    // ── Liability components ──────────────────────────────────────────────────
    @Column(name = "credit_card_balance",       nullable = false, precision = 18, scale = 4) @Builder.Default
    private BigDecimal creditCardBalance         = BigDecimal.ZERO;

    @Column(name = "loan_balance",              nullable = false, precision = 18, scale = 4) @Builder.Default
    private BigDecimal loanBalance               = BigDecimal.ZERO;

    @Column(name = "manual_liability_balance",  nullable = false, precision = 18, scale = 4) @Builder.Default
    private BigDecimal manualLiabilityBalance    = BigDecimal.ZERO;

    @Column(name = "total_liabilities",         nullable = false, precision = 18, scale = 4) @Builder.Default
    private BigDecimal totalLiabilities          = BigDecimal.ZERO;

    // ── Headline ──────────────────────────────────────────────────────────────
    @Column(name = "net_worth", nullable = false, precision = 18, scale = 4) @Builder.Default
    private BigDecimal netWorth = BigDecimal.ZERO;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
