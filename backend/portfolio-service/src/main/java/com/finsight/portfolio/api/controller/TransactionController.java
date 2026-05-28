package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.response.TransactionResponse;
import com.finsight.portfolio.domain.service.TransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/portfolio")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService transactionService;

    /**
     * Returns paginated investment transaction history for the authenticated user.
     *
     * Query params:
     *   page (default 0)  — zero-based page index
     *   size (default 50) — records per page, capped at 100 in the service layer
     *
     * Response: Spring Data {@link Page} — includes content, totalElements, totalPages etc.
     */
    @GetMapping("/transactions")
    public Page<TransactionResponse> getTransactions(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size) {
        return transactionService.getTransactions(
                UUID.fromString(jwt.getSubject()), page, size);
    }
}
