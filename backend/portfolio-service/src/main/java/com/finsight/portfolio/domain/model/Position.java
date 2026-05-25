package com.finsight.portfolio.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "positions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Position {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Column(nullable = false, length = 20)
    private String ticker;

    @Column(length = 255)
    private String name;

    @Column(nullable = false, precision = 18, scale = 8)
    private BigDecimal quantity;

    @Column(name = "cost_basis", precision = 18, scale = 4)
    private BigDecimal costBasis;

    @Column(name = "current_price", precision = 18, scale = 4)
    private BigDecimal currentPrice;

    @Column(name = "current_value", precision = 18, scale = 4)
    private BigDecimal currentValue;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
