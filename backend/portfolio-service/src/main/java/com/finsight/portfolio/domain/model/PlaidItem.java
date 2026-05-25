package com.finsight.portfolio.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "plaid_items")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlaidItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // AES-256 encrypted — never store or log plaintext
    @Column(name = "access_token_encrypted", nullable = false)
    private String accessTokenEncrypted;

    @Column(name = "plaid_item_id", nullable = false, unique = true)
    private String plaidItemId;

    @Column(name = "institution_id")
    private String institutionId;

    @Column(name = "institution_name")
    private String institutionName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private PlaidItemStatus status = PlaidItemStatus.ACTIVE;

    @Column(name = "last_synced_at")
    private Instant lastSyncedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public enum PlaidItemStatus {
        ACTIVE, ERROR, REVOKED
    }
}
