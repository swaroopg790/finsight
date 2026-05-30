package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.response.CashFlowSummaryResponse;
import com.finsight.portfolio.domain.service.CashFlowService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/cashflow")
@RequiredArgsConstructor
public class CashFlowController {

    private final CashFlowService cashFlowService;

    /**
     * GET /api/v1/cashflow/summary
     *
     * Returns subscriptions, calendar events, current balance, and projected balance.
     */
    @GetMapping("/summary")
    public ResponseEntity<CashFlowSummaryResponse> getSummary(
            @AuthenticationPrincipal Jwt jwt) {

        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(cashFlowService.getSummary(userId));
    }
}
