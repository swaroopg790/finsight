package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.response.TaxSummaryResponse;
import com.finsight.portfolio.domain.service.TaxService;
import com.finsight.portfolio.domain.service.TaxService.CostBasisMethod;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

/**
 * GET /api/v1/tax/summary?year=2026&method=FIFO
 *
 * Returns the full tax-intelligence summary for the authenticated user.
 * <p>
 * Query params:
 * <ul>
 *   <li>{@code year}   – tax year (defaults to current calendar year)</li>
 *   <li>{@code method} – cost-basis method: FIFO | LIFO | HIGHEST_COST (defaults to FIFO)</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/tax")
@RequiredArgsConstructor
public class TaxController {

    private final TaxService taxService;

    @GetMapping("/summary")
    public TaxSummaryResponse getSummary(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0")    int year,
            @RequestParam(defaultValue = "FIFO") String method
    ) {
        UUID userId    = UUID.fromString(jwt.getSubject());
        int  taxYear   = year > 0 ? year : LocalDate.now().getYear();
        CostBasisMethod basisMethod;
        try {
            basisMethod = CostBasisMethod.valueOf(method.toUpperCase());
        } catch (IllegalArgumentException e) {
            basisMethod = CostBasisMethod.FIFO;
        }
        return taxService.computeSummary(userId, taxYear, basisMethod);
    }
}
