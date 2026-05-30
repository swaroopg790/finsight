package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.request.CreateGoalRequest;
import com.finsight.portfolio.api.dto.request.UpdateGoalRequest;
import com.finsight.portfolio.api.dto.request.WhatIfRequest;
import com.finsight.portfolio.api.dto.response.GoalProjectionResponse;
import com.finsight.portfolio.api.dto.response.GoalResponse;
import com.finsight.portfolio.api.dto.response.ParseGoalResponse;
import com.finsight.portfolio.api.dto.response.WhatIfResponse;
import com.finsight.portfolio.domain.service.GoalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/goals")
@RequiredArgsConstructor
public class GoalController {

    private final GoalService goalService;

    // ── GET /api/v1/goals ─────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<GoalResponse>> listGoals(
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(goalService.listGoals(userId));
    }

    // ── POST /api/v1/goals ────────────────────────────────────────────────────
    @PostMapping
    public ResponseEntity<GoalResponse> createGoal(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateGoalRequest req) {
        UUID userId = UUID.fromString(jwt.getSubject());
        GoalResponse created = goalService.createGoal(userId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // ── PUT /api/v1/goals/{id} ────────────────────────────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<GoalResponse> updateGoal(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @RequestBody UpdateGoalRequest req) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(goalService.updateGoal(userId, id, req));
    }

    // ── DELETE /api/v1/goals/{id} ─────────────────────────────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGoal(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id) {
        UUID userId = UUID.fromString(jwt.getSubject());
        goalService.deleteGoal(userId, id);
        return ResponseEntity.noContent().build();
    }

    // ── GET /api/v1/goals/{id}/simulation ────────────────────────────────────
    @GetMapping("/{id}/simulation")
    public ResponseEntity<GoalProjectionResponse> getSimulation(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(goalService.getSimulation(userId, id));
    }

    // ── POST /api/v1/goals/{id}/whatif ────────────────────────────────────────
    @PostMapping("/{id}/whatif")
    public ResponseEntity<WhatIfResponse> whatIf(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @RequestBody WhatIfRequest req) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(goalService.whatIf(userId, id, req));
    }

    // ── POST /api/v1/goals/parse ──────────────────────────────────────────────
    /** Parse a natural-language string into a goal pre-fill (does NOT persist). */
    @PostMapping("/parse")
    public ResponseEntity<ParseGoalResponse> parseGoal(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Map<String, String> body) {
        String text = body.getOrDefault("text", "");
        return ResponseEntity.ok(goalService.parseGoal(text));
    }
}
