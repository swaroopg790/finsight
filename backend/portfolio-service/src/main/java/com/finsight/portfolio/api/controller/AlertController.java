package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.request.AlertPreferenceRequest;
import com.finsight.portfolio.api.dto.response.AlertPreferenceResponse;
import com.finsight.portfolio.domain.model.AlertPreference;
import com.finsight.portfolio.domain.service.AlertService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;

    /**
     * Returns all alert preferences for the authenticated user.
     * Returns an empty list if the user has never configured any alerts.
     */
    @GetMapping("/preferences")
    public List<AlertPreferenceResponse> getPreferences(@AuthenticationPrincipal Jwt jwt) {
        return alertService.getPreferences(UUID.fromString(jwt.getSubject()));
    }

    /**
     * Creates or updates an alert preference for the given alert type.
     *
     * Path variable {alertType} must match {@link AlertPreference.AlertType}:
     *   PORTFOLIO_DROP  — triggers when portfolio drops ≥ thresholdPct% in 24h
     *   WEEKLY_SUMMARY  — sends a weekly portfolio summary email
     *
     * Upsert semantics — safe to call repeatedly.
     */
    @PutMapping("/preferences/{alertType}")
    public AlertPreferenceResponse upsertPreference(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String alertType,
            @RequestBody @Valid AlertPreferenceRequest request) {

        AlertPreference.AlertType type;
        try {
            type = AlertPreference.AlertType.valueOf(alertType.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Unknown alert type: '" + alertType + "'. Valid values: PORTFOLIO_DROP, WEEKLY_SUMMARY");
        }

        return alertService.upsertPreference(
                UUID.fromString(jwt.getSubject()), type, request);
    }
}
