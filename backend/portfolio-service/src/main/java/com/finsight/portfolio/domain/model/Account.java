package com.finsight.portfolio.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "accounts")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plaid_item_id", nullable = false)
    private PlaidItem plaidItem;

    @Column(name = "plaid_account_id", nullable = false, unique = true)
    private String plaidAccountId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String type;

    private String subtype;

    @Column(name = "balance_current", precision = 18, scale = 4)
    private BigDecimal balanceCurrent;

    @Column(name = "balance_available", precision = 18, scale = 4)
    private BigDecimal balanceAvailable;

    @Column(length = 3)
    @Builder.Default
    private String currency = "USD";

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
