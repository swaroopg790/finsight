package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.request.ManualAssetRequest;
import com.finsight.portfolio.api.dto.request.ManualLiabilityRequest;
import com.finsight.portfolio.api.dto.response.*;
import com.finsight.portfolio.domain.service.NetWorthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/networth")
@RequiredArgsConstructor
public class NetWorthController {

    private final NetWorthService netWorthService;

    // ── GET /api/v1/networth/summary ──────────────────────────────────────────
    @GetMapping("/summary")
    public ResponseEntity<NetWorthSummaryResponse> getSummary(
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(netWorthService.getSummary(userId));
    }

    // ── GET /api/v1/networth/history?period=1Y ────────────────────────────────
    @GetMapping("/history")
    public ResponseEntity<NetWorthHistoryResponse> getHistory(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "1Y") String period) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(netWorthService.getHistory(userId, period));
    }

    // ── POST /api/v1/networth/snapshot ────────────────────────────────────────
    /** Manually trigger a net-worth snapshot refresh. */
    @PostMapping("/snapshot")
    public ResponseEntity<Void> triggerSnapshot(
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        netWorthService.triggerSnapshot(userId);
        return ResponseEntity.noContent().build();
    }

    // ── Manual Assets ─────────────────────────────────────────────────────────

    @PostMapping("/assets")
    public ResponseEntity<ManualAssetResponse> createAsset(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ManualAssetRequest req) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(netWorthService.createAsset(userId, req));
    }

    @PutMapping("/assets/{id}")
    public ResponseEntity<ManualAssetResponse> updateAsset(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody ManualAssetRequest req) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(netWorthService.updateAsset(userId, id, req));
    }

    @DeleteMapping("/assets/{id}")
    public ResponseEntity<Void> deleteAsset(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id) {
        UUID userId = UUID.fromString(jwt.getSubject());
        netWorthService.deleteAsset(userId, id);
        return ResponseEntity.noContent().build();
    }

    // ── Manual Liabilities ────────────────────────────────────────────────────

    @PostMapping("/liabilities")
    public ResponseEntity<ManualLiabilityResponse> createLiability(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ManualLiabilityRequest req) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(netWorthService.createLiability(userId, req));
    }

    @PutMapping("/liabilities/{id}")
    public ResponseEntity<ManualLiabilityResponse> updateLiability(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody ManualLiabilityRequest req) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(netWorthService.updateLiability(userId, id, req));
    }

    @DeleteMapping("/liabilities/{id}")
    public ResponseEntity<Void> deleteLiability(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id) {
        UUID userId = UUID.fromString(jwt.getSubject());
        netWorthService.deleteLiability(userId, id);
        return ResponseEntity.noContent().build();
    }
}
