package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.request.LoginRequest;
import com.finsight.portfolio.api.dto.request.RefreshRequest;
import com.finsight.portfolio.api.dto.request.RegisterRequest;
import com.finsight.portfolio.api.dto.response.AuthResponse;
import com.finsight.portfolio.domain.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /**
     * Exchanges a valid refresh token for a new access token + rotated refresh token.
     * No Authorization header required — the refresh token IS the credential here.
     */
    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refresh(request);
    }

    /**
     * Revokes all refresh tokens for the current user.
     * Frontend should also clear localStorage tokens after calling this.
     */
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal Jwt jwt) {
        authService.revokeAllTokens(jwt.getSubject());
    }

    /** Lightweight token validity check — returns 200 if JWT is valid, 401 otherwise. */
    @GetMapping("/me")
    public Map<String, String> me(@AuthenticationPrincipal Jwt jwt) {
        return Map.of(
                "userId", jwt.getSubject(),
                "email",  jwt.getClaimAsString("email")
        );
    }
}
