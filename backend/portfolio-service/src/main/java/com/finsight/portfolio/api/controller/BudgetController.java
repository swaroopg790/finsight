package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.request.BudgetTargetRequest;
import com.finsight.portfolio.api.dto.response.BudgetSummaryResponse;
import com.finsight.portfolio.domain.service.BudgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/budget")
@RequiredArgsConstructor
public class BudgetController {

    private final BudgetService budgetService;

    /**
     * GET /api/v1/budget/summary?year=2026&month=5
     *
     * Returns monthly spending summary with budget vs actual per category.
     * Defaults to the current month.
     */
    @GetMapping("/summary")
    public ResponseEntity<BudgetSummaryResponse> getSummary(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {

        LocalDate now  = LocalDate.now();
        int resolvedYear  = year  != null ? year  : now.getYear();
        int resolvedMonth = month != null ? month : now.getMonthValue();

        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(budgetService.getSummary(userId, resolvedYear, resolvedMonth));
    }

    /**
     * PUT /api/v1/budget/targets
     *
     * Updates monthly budget targets. Partial update — only included categories are changed.
     */
    @PutMapping("/targets")
    public ResponseEntity<Void> updateTargets(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody BudgetTargetRequest request) {

        UUID userId = UUID.fromString(jwt.getSubject());
        budgetService.updateTargets(userId, request.targets());
        return ResponseEntity.noContent().build();
    }
}
