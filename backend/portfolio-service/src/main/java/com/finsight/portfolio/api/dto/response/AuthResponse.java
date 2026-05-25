package com.finsight.portfolio.api.dto.response;

public record AuthResponse(
        String token,
        String tokenType,
        long expiresIn
) {
    public AuthResponse(String token) {
        this(token, "Bearer", 86400);
    }
}
