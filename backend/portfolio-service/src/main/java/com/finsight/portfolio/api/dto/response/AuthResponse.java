package com.finsight.portfolio.api.dto.response;

/**
 * Returned by /auth/login, /auth/register, and /auth/refresh.
 *
 * accessToken  — short-lived JWT (15 minutes), sent as Bearer on every API call.
 * refreshToken — long-lived opaque token (7 days), used only to get a new accessToken.
 * expiresIn    — access token TTL in seconds (900 = 15 min), for client-side scheduling.
 */
public record AuthResponse(
        String token,
        String tokenType,
        long   expiresIn,
        String refreshToken
) {
    /** Convenience constructor used internally — tokenType defaults to Bearer. */
    public AuthResponse(String token, String refreshToken) {
        this(token, "Bearer", 900, refreshToken);
    }
}
