package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.response.AccountResponse;
import com.finsight.portfolio.api.dto.response.AllocationItem;
import com.finsight.portfolio.api.dto.response.HoldingResponse;
import com.finsight.portfolio.api.dto.response.PerformanceResponse;
import com.finsight.portfolio.domain.service.PortfolioService;
import com.finsight.portfolio.infrastructure.market.PriceEnrichmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/portfolio")
@RequiredArgsConstructor
public class PortfolioController {

    private final PortfolioService        portfolioService;
    private final PriceEnrichmentService  priceEnrichmentService;

    @GetMapping("/holdings")
    public List<HoldingResponse> getHoldings(@AuthenticationPrincipal Jwt jwt) {
        return portfolioService.getHoldings(UUID.fromString(jwt.getSubject()));
    }

    @GetMapping("/accounts")
    public List<AccountResponse> getAccounts(@AuthenticationPrincipal Jwt jwt) {
        return portfolioService.getAccounts(UUID.fromString(jwt.getSubject()));
    }

    /**
     * Returns daily portfolio value snapshots plus SPY and QQQ benchmark overlays
     * for the past N days (default 30).
     *
     * All three series share the same dollar Y-axis: benchmarks are normalised
     * to the portfolio's Day-0 value for the requested period.
     *
     * Sparse for new users — the scheduler records one snapshot per 4-hour run.
     */
    @GetMapping("/performance")
    public PerformanceResponse getPerformance(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "30") int days) {
        int clampedDays = Math.max(7, Math.min(365, days));
        return portfolioService.getPerformance(UUID.fromString(jwt.getSubject()), clampedDays);
    }

    /**
     * Returns asset allocation breakdown by ticker, sorted by value descending.
     * Only priced positions are included.
     */
    @GetMapping("/allocation")
    public List<AllocationItem> getAllocation(@AuthenticationPrincipal Jwt jwt) {
        return portfolioService.getAllocation(UUID.fromString(jwt.getSubject()));
    }

    /**
     * Triggers an immediate async Polygon.io price refresh for all positions.
     * Returns 202 Accepted immediately — enrichment runs in the background.
     */
    @PostMapping("/refresh-prices")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, String> refreshPrices(@AuthenticationPrincipal Jwt jwt) {
        priceEnrichmentService.enrichAllPricesAsync();
        return Map.of(
                "status",  "accepted",
                "message", "Price refresh queued — re-fetch holdings in ~10 seconds"
        );
    }
}
