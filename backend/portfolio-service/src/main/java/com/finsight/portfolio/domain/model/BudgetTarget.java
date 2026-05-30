package com.finsight.portfolio.domain.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Monthly spending budget target set by a user for a specific category.
 *
 * One row per (user, category) pair — upserted when the user edits their budget.
 */
@Entity
@Table(name = "budget_targets",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "category"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BudgetTarget {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 50)
    private String category;

    @Column(name = "monthly_budget", nullable = false, precision = 18, scale = 4)
    @Builder.Default
    private BigDecimal monthlyBudget = BigDecimal.ZERO;
}
