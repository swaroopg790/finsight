package com.finsight.portfolio.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "manual_liabilities")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ManualLiability {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "liability_type", nullable = false, length = 50)
    private LiabilityType liabilityType;

    @Column(nullable = false, precision = 18, scale = 4)
    @Builder.Default
    private BigDecimal balance = BigDecimal.ZERO;

    /** Annualised interest rate, e.g. 0.065 = 6.5%. Nullable. */
    @Column(name = "interest_rate", precision = 5, scale = 4)
    private BigDecimal interestRate;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
