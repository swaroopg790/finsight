package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.response.AccountResponse;
import com.finsight.portfolio.api.dto.response.HoldingResponse;
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

    private final PortfolioService       portfolioService;
    private final PriceEnrichmentService priceEnrichmentService;

    @GetMapping("/holdings")
    public List<HoldingResponse> getHoldings(@AuthenticationPrincipal Jwt jwt) {
        return portfolioService.getHoldings(UUID.fromString(jwt.getSubject()));
    }

    @GetMapping("/accounts")
    public List<AccountResponse> getAccounts(@AuthenticationPrincipal Jwt jwt) {
        return portfolioService.getAccounts(UUID.fromString(jwt.getSubject()));
    }

    /**
     * Triggers an immediate async Polygon.io price refresh for all positions.
     * Returns 202 Accepted immediately — enrichment runs in the background.
     *
     * The frontend can call this after connecting a brokerage and then re-fetch
     * holdings a few seconds later to show live market prices.
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
