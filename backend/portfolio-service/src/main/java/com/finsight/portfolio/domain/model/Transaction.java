package com.finsight.portfolio.domain.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "transactions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Column(name = "plaid_transaction_id", unique = true)
    private String plaidTransactionId;

    @Column(name = "ticker", length = 20)
    private String ticker;

    @Column(name = "security_name")
    private String securityName;

    /** BUY, SELL, DIVIDEND, FEE, TRANSFER, OTHER */
    @Column(name = "transaction_type", nullable = false, length = 50)
    private String transactionType;

    @Column(name = "quantity", precision = 18, scale = 6)
    private BigDecimal quantity;

    @Column(name = "price", precision = 18, scale = 4)
    private BigDecimal price;

    /** Negative = cash out (buy), Positive = cash in (sell, dividend). */
    @Column(name = "amount", nullable = false, precision = 18, scale = 4)
    private BigDecimal amount;

    @Column(name = "transaction_date", nullable = false)
    private LocalDate transactionDate;

    /**
     * Transaction source: INVESTMENT (from Plaid Investments API) or BANK (from Plaid Transactions API).
     * Defaults to INVESTMENT for backward compatibility with existing rows.
     */
    @Column(name = "source", nullable = false, length = 20)
    @Builder.Default
    private String source = "INVESTMENT";

    /**
     * Spending category for BANK transactions (e.g., GROCERIES, DINING, SUBSCRIPTIONS).
     * Null for INVESTMENT transactions.
     */
    @Column(name = "category", length = 50)
    private String category;

    /**
     * Merchant or payee name for BANK transactions.
     * For investment transactions this is the same as securityName.
     */
    @Column(name = "merchant_name")
    private String merchantName;

    /** True if this transaction has been detected as a recurring charge (subscription, utility bill). */
    @Column(name = "is_recurring", nullable = false)
    @Builder.Default
    private boolean recurring = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
