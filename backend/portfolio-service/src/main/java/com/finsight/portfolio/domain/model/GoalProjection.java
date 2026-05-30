package com.finsight.portfolio.domain.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Cached Monte Carlo simulation result for a {@link FinancialGoal}.
 *
 * <p>Re-computed whenever the parent goal's parameters change (handled by
 * {@link com.finsight.portfolio.domain.service.GoalService}).
 *
 * <p>{@code yearlyBands} is a JSON array of annual snapshots:
 * <pre>
 * [{"year":2025,"p10":120000,"p25":145000,"p50":175000,"p75":210000,"p90":245000}, ...]
 * </pre>
 */
@Entity
@Table(name = "goal_projections")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class GoalProjection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "goal_id", nullable = false)
    private FinancialGoal goal;

    /** Fraction of simulation paths that reach the target (0–1). */
    @Column(name = "success_probability", nullable = false, precision = 5, scale = 4)
    private BigDecimal successProbability;

    @Column(name = "p10_final", nullable = false, precision = 18, scale = 4)
    private BigDecimal p10Final;

    @Column(name = "p25_final", nullable = false, precision = 18, scale = 4)
    private BigDecimal p25Final;

    @Column(name = "p50_final", nullable = false, precision = 18, scale = 4)
    private BigDecimal p50Final;

    @Column(name = "p75_final", nullable = false, precision = 18, scale = 4)
    private BigDecimal p75Final;

    @Column(name = "p90_final", nullable = false, precision = 18, scale = 4)
    private BigDecimal p90Final;

    /** JSON — yearly percentile band data for chart rendering. */
    @Column(name = "yearly_bands", nullable = false, columnDefinition = "TEXT")
    private String yearlyBands;

    @Column(name = "simulation_paths", nullable = false)
    @Builder.Default
    private int simulationPaths = 5000;

    @Column(name = "computed_at", nullable = false)
    @Builder.Default
    private Instant computedAt = Instant.now();
}
