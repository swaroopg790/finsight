package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.dto.request.AlertPreferenceRequest;
import com.finsight.portfolio.api.dto.response.AlertPreferenceResponse;
import com.finsight.portfolio.domain.model.AlertPreference;
import com.finsight.portfolio.domain.model.AlertPreference.AlertType;
import com.finsight.portfolio.domain.model.PortfolioSnapshot;
import com.finsight.portfolio.domain.repository.AlertPreferenceRepository;
import com.finsight.portfolio.domain.repository.PortfolioSnapshotRepository;
import com.finsight.portfolio.domain.repository.UserRepository;
import com.finsight.portfolio.infrastructure.mail.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Manages alert preferences and scheduled alert delivery.
 *
 * Two alert types:
 *   PORTFOLIO_DROP  — triggers when portfolio drops ≥ thresholdPct% in 24 hours
 *   WEEKLY_SUMMARY  — sends a summary email every Monday (driven by scheduler)
 *
 * All sends are best-effort via EmailService, which gracefully falls back to
 * console logging in dev mode (no SMTP required).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlertService {

    private final AlertPreferenceRepository  alertPreferenceRepository;
    private final PortfolioSnapshotRepository snapshotRepository;
    private final UserRepository             userRepository;
    private final EmailService               emailService;

    // ── Preference CRUD ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AlertPreferenceResponse> getPreferences(UUID userId) {
        return alertPreferenceRepository.findByUserId(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Creates or updates an alert preference for the given user + type.
     * Upsert semantics: safe to call repeatedly with the same type.
     */
    @Transactional
    public AlertPreferenceResponse upsertPreference(UUID userId,
                                                     AlertType alertType,
                                                     AlertPreferenceRequest req) {
        AlertPreference pref = alertPreferenceRepository
                .findByUserIdAndAlertType(userId, alertType)
                .orElseGet(() -> AlertPreference.builder()
                        .user(userRepository.getReferenceById(userId))
                        .alertType(alertType)
                        .build());

        pref.setEnabled(req.enabled());
        if (req.thresholdPct()      != null) pref.setThresholdPct(req.thresholdPct());
        if (req.notificationEmail() != null) pref.setNotificationEmail(req.notificationEmail());

        return toResponse(alertPreferenceRepository.save(pref));
    }

    // ── Scheduled checks (called from PortfolioSyncScheduler) ─────────────────

    /**
     * Checks all users with PORTFOLIO_DROP enabled.
     * Compares today's portfolio snapshot against yesterday's.
     * Sends an alert if the drop exceeds the configured threshold.
     *
     * Cooldown: each preference fires at most once per 24 hours.
     */
    @Transactional
    public void checkPortfolioDropAlerts() {
        List<AlertPreference> prefs = alertPreferenceRepository
                .findByAlertTypeAndEnabledTrue(AlertType.PORTFOLIO_DROP);

        if (prefs.isEmpty()) {
            log.debug("No enabled PORTFOLIO_DROP preferences — skipping check");
            return;
        }

        log.info("Checking PORTFOLIO_DROP alerts for {} users", prefs.size());
        LocalDate today     = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);

        for (AlertPreference pref : prefs) {
            try {
                evaluateDropAlert(pref, today, yesterday);
            } catch (Exception e) {
                log.error("Error evaluating PORTFOLIO_DROP for pref={}: {}", pref.getId(), e.getMessage());
            }
        }
    }

    /**
     * Sends weekly portfolio summary emails to all users with WEEKLY_SUMMARY enabled.
     * Should be called by the scheduler every Monday morning.
     */
    @Transactional(readOnly = true)
    public void sendWeeklySummaries() {
        List<AlertPreference> prefs = alertPreferenceRepository
                .findByAlertTypeAndEnabledTrue(AlertType.WEEKLY_SUMMARY);

        if (prefs.isEmpty()) {
            log.debug("No enabled WEEKLY_SUMMARY preferences — nothing to send");
            return;
        }

        log.info("Sending weekly portfolio summaries to {} users", prefs.size());
        LocalDate today   = LocalDate.now();
        LocalDate weekAgo = today.minusDays(7);

        for (AlertPreference pref : prefs) {
            try {
                sendWeeklySummary(pref, today, weekAgo);
            } catch (Exception e) {
                log.error("Error sending weekly summary for pref={}: {}", pref.getId(), e.getMessage());
            }
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void evaluateDropAlert(AlertPreference pref, LocalDate today, LocalDate yesterday) {
        UUID userId = pref.getUser().getId();

        // 24-hour cooldown — don't spam the user
        if (pref.getLastTriggeredAt() != null
                && pref.getLastTriggeredAt().isAfter(Instant.now().minus(24, ChronoUnit.HOURS))) {
            log.debug("PORTFOLIO_DROP cooldown active for user={} — skipping", userId);
            return;
        }

        Optional<PortfolioSnapshot> todaySnap = snapshotRepository
                .findByUserIdAndSnapshotDate(userId, today);
        Optional<PortfolioSnapshot> yestSnap  = snapshotRepository
                .findByUserIdAndSnapshotDate(userId, yesterday);

        if (todaySnap.isEmpty() || yestSnap.isEmpty()) {
            log.debug("Insufficient snapshots for user={} — need today + yesterday", userId);
            return;
        }

        BigDecimal todayVal = todaySnap.get().getTotalValue();
        BigDecimal yestVal  = yestSnap.get().getTotalValue();

        if (yestVal.compareTo(BigDecimal.ZERO) == 0) return;

        // dropPct is positive when portfolio declined
        BigDecimal dropPct = yestVal.subtract(todayVal)
                .divide(yestVal, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

        BigDecimal threshold = pref.getThresholdPct() != null
                ? pref.getThresholdPct() : new BigDecimal("5.0");

        log.debug("PORTFOLIO_DROP check for user={}: drop={}% threshold={}%", userId, dropPct, threshold);

        if (dropPct.compareTo(threshold) >= 0) {
            String to = resolveEmail(pref);
            String subject = String.format("FinSight Alert: Portfolio dropped %.2f%%", dropPct);
            String body = String.format(
                    "FinSight Portfolio Drop Alert%n%n" +
                    "Your portfolio has dropped %.2f%% in the last 24 hours.%n" +
                    "Current value: $%,.2f%n%n" +
                    "Log in to FinSight to review your positions.%n" +
                    "%nhttps://app.finsight.io%n",
                    dropPct, todayVal
            );
            emailService.send(to, subject, body);
            pref.setLastTriggeredAt(Instant.now());
            alertPreferenceRepository.save(pref);
            log.info("PORTFOLIO_DROP alert fired for user={} drop={}%", userId, dropPct);
        }
    }

    private void sendWeeklySummary(AlertPreference pref, LocalDate today, LocalDate weekAgo) {
        UUID userId = pref.getUser().getId();

        Optional<PortfolioSnapshot> latestSnap = snapshotRepository
                .findByUserIdAndSnapshotDate(userId, today);
        if (latestSnap.isEmpty()) {
            log.debug("No snapshot for user={} on {} — skipping weekly summary", userId, today);
            return;
        }

        BigDecimal current = latestSnap.get().getTotalValue();
        String weekChange = snapshotRepository
                .findByUserIdAndSnapshotDate(userId, weekAgo)
                .map(s -> formatChange(current, s.getTotalValue()))
                .orElse("N/A (no data for 7 days ago)");

        String to   = resolveEmail(pref);
        String body = String.format(
                "FinSight Weekly Portfolio Summary%n%n" +
                "Current Value: $%,.2f%n" +
                "7-Day Change:  %s%n%n" +
                "Log in to FinSight to see your full portfolio breakdown,%n" +
                "transaction history, and AI insights.%n%n" +
                "https://app.finsight.io%n",
                current, weekChange
        );

        emailService.send(to, "Your FinSight Weekly Portfolio Summary", body);
        log.info("Weekly summary sent to {} for user={}", to, userId);
    }

    private String formatChange(BigDecimal current, BigDecimal previous) {
        if (previous.compareTo(BigDecimal.ZERO) == 0) return "N/A";
        BigDecimal diff = current.subtract(previous);
        BigDecimal pct  = diff.divide(previous, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
        return String.format("%s$%,.2f (%s%.2f%%)",
                diff.compareTo(BigDecimal.ZERO) >= 0 ? "+" : "",
                diff.abs(),
                pct.compareTo(BigDecimal.ZERO) >= 0 ? "+" : "",
                pct);
    }

    /** Returns notification email override if set, otherwise falls back to registration email. */
    private String resolveEmail(AlertPreference pref) {
        return pref.getNotificationEmail() != null && !pref.getNotificationEmail().isBlank()
                ? pref.getNotificationEmail()
                : pref.getUser().getEmail();
    }

    private AlertPreferenceResponse toResponse(AlertPreference p) {
        return new AlertPreferenceResponse(
                p.getAlertType().name(),
                p.isEnabled(),
                p.getThresholdPct(),
                p.getNotificationEmail()
        );
    }
}
