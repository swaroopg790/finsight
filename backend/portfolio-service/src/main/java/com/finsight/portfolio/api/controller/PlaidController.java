package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.request.PlaidExchangeRequest;
import com.finsight.portfolio.domain.service.PlaidService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/plaid")
@RequiredArgsConstructor
public class PlaidController {

    private final PlaidService plaidService;

    /**
     * Returns a Plaid Link token for the authenticated user.
     * The frontend passes this token to the Plaid Link widget to open the OAuth flow.
     */
    @GetMapping("/link-token")
    public Map<String, String> createLinkToken(@AuthenticationPrincipal Jwt jwt) {
        String linkToken = plaidService.createLinkToken(jwt.getSubject());
        return Map.of("linkToken", linkToken);
    }

    /**
     * Called after the user completes the Plaid Link flow in the browser.
     * Exchanges the public token, encrypts and stores the access token, triggers first sync.
     */
    @PostMapping("/exchange-token")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> exchangePublicToken(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody PlaidExchangeRequest request) {

        plaidService.connectBrokerage(
                UUID.fromString(jwt.getSubject()),
                request.publicToken(),
                request.institutionId(),
                request.institutionName()
        );
        return Map.of("status", "connected");
    }

    /**
     * Disconnects a brokerage account.
     * Deletes the PlaidItem — DB cascades remove all associated accounts and positions.
     * Returns 404 if the item doesn't exist or belongs to a different user (IDOR-safe).
     */
    @DeleteMapping("/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disconnectItem(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID itemId) {
        plaidService.disconnectItem(UUID.fromString(jwt.getSubject()), itemId);
    }
}
