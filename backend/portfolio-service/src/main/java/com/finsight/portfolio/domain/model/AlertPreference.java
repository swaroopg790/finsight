package com.finsight.portfolio.domain.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "alert_preferences",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "alert_type"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AlertPreference {

    public enum AlertType { PORTFOLIO_DROP, WEEKLY_SUMMARY }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "alert_type", nullable = false, length = 50)
    private AlertType alertType;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    /** Drop percentage that triggers the PORTFOLIO_DROP alert (e.g. 3.00 = 3%). */
    @Column(name = "threshold_pct", precision = 5, scale = 2)
    private BigDecimal thresholdPct;

    /** Override email address; falls back to user's registration email if null. */
    @Column(name = "notification_email")
    private String notificationEmail;

    @Column(name = "last_triggered_at")
    private Instant lastTriggeredAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
