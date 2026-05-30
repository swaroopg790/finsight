package com.finsight.portfolio.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A user-defined financial goal (retirement, home purchase, college, etc.).
 *
 * <p>Stores the goal parameters used as inputs to the Monte Carlo simulation.
 * The simulation output is cached in {@link GoalProjection}.
 */
@Entity
@Table(name = "financial_goals")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class FinancialGoal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "goal_type", nullable = false, length = 50)
    private GoalType goalType;

    @Column(name = "target_amount", nullable = false, precision = 18, scale = 4)
    private BigDecimal targetAmount;

    @Column(name = "target_date", nullable = false)
    private LocalDate targetDate;

    /** Current saved/invested value toward this goal. */
    @Column(name = "current_value", nullable = false, precision = 18, scale = 4)
    @Builder.Default
    private BigDecimal currentValue = BigDecimal.ZERO;

    /** Monthly contribution the user plans to make toward this goal. */
    @Column(name = "monthly_contribution", nullable = false, precision = 18, scale = 4)
    @Builder.Default
    private BigDecimal monthlyContribution = BigDecimal.ZERO;

    /** Annualised expected return rate (e.g., 0.07 = 7%). */
    @Column(name = "expected_return_pct", nullable = false, precision = 6, scale = 4)
    @Builder.Default
    private BigDecimal expectedReturnPct = new BigDecimal("0.07");

    /** Annualised volatility / standard deviation (e.g., 0.15 = 15%). */
    @Column(name = "volatility_pct", nullable = false, precision = 6, scale = 4)
    @Builder.Default
    private BigDecimal volatilityPct = new BigDecimal("0.15");

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
