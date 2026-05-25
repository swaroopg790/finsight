package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.response.AccountResponse;
import com.finsight.portfolio.api.dto.response.HoldingResponse;
import com.finsight.portfolio.api.dto.response.InsightResponse;
import com.finsight.portfolio.domain.service.PortfolioService;
import com.finsight.portfolio.infrastructure.ai.AiInsightClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/insights")
@RequiredArgsConstructor
public class InsightController {

    private final PortfolioService portfolioService;
    private final AiInsightClient  aiInsightClient;

    /**
     * Returns AI-generated portfolio insights for the authenticated user.
     * Results are cached in Redis for 30 minutes.
     *
     * 200 — insights available
     * 503 — AI service is down or not configured
     */
    @GetMapping
    public ResponseEntity<?> getInsights(@AuthenticationPrincipal Jwt jwt) {
        UUID   userId   = UUID.fromString(jwt.getSubject());
        String userIdStr = userId.toString();

        List<HoldingResponse> holdings = portfolioService.getHoldings(userId);
        List<AccountResponse> accounts = portfolioService.getAccounts(userId);

        InsightResponse insight = aiInsightClient.getInsights(userIdStr, holdings, accounts);

        if (insight == null) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "AI service is currently unavailable — check that the AI service is running on port 8000"
            );
            problem.setTitle("AI Service Unavailable");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(problem);
        }

        return ResponseEntity.ok(insight);
    }

    /**
     * Clears the cached insights for the current user, forcing a fresh analysis on next GET.
     */
    @DeleteMapping("/cache")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void invalidateCache(@AuthenticationPrincipal Jwt jwt) {
        aiInsightClient.invalidateCache(jwt.getSubject());
        log.info("Insights cache invalidated for user={}", jwt.getSubject());
    }
}
