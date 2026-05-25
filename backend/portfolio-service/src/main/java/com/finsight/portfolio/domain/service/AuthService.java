package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.dto.request.LoginRequest;
import com.finsight.portfolio.api.dto.request.RefreshRequest;
import com.finsight.portfolio.api.dto.request.RegisterRequest;
import com.finsight.portfolio.api.dto.response.AuthResponse;
import com.finsight.portfolio.api.exception.ResourceNotFoundException;
import com.finsight.portfolio.domain.model.RefreshToken;
import com.finsight.portfolio.domain.model.User;
import com.finsight.portfolio.domain.repository.RefreshTokenRepository;
import com.finsight.portfolio.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int    ACCESS_TOKEN_MINUTES  = 15;
    private static final int    REFRESH_TOKEN_DAYS    = 7;

    private final UserRepository         userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder        passwordEncoder;
    private final JwtEncoder             jwtEncoder;

    // ── Public API ───────────────────────────────────────────────────────────

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email already registered");
        }
        User user = User.builder()
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .build();
        userRepository.save(user);
        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        return buildAuthResponse(user);
    }

    /**
     * Exchanges a valid refresh token for a new access token + rotated refresh token.
     * The old refresh token is deleted immediately (rotation prevents replay attacks).
     */
    @Transactional
    public AuthResponse refresh(RefreshRequest request) {
        String hash = hashToken(request.refreshToken());

        RefreshToken storedToken = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new ResourceNotFoundException("Refresh token not found or already used"));

        if (storedToken.isExpired()) {
            refreshTokenRepository.delete(storedToken);
            throw new IllegalArgumentException("Refresh token has expired — please log in again");
        }

        User user = storedToken.getUser();

        // Rotate: delete old token, issue new pair
        refreshTokenRepository.delete(storedToken);
        log.debug("Refresh token rotated for user={}", user.getId());

        return buildAuthResponse(user);
    }

    /**
     * Revokes all refresh tokens for a user — call on explicit logout or password change.
     */
    @Transactional
    public void revokeAllTokens(String userId) {
        refreshTokenRepository.deleteByUserId(java.util.UUID.fromString(userId));
        log.info("All refresh tokens revoked for user={}", userId);
    }

    // ── Scheduled cleanup ────────────────────────────────────────────────────

    /** Purge expired refresh tokens daily at midnight to keep the table lean. */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void purgeExpiredRefreshTokens() {
        int removed = refreshTokenRepository.deleteExpiredBefore(Instant.now());
        if (removed > 0) log.info("Purged {} expired refresh tokens", removed);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private AuthResponse buildAuthResponse(User user) {
        String accessToken   = generateAccessToken(user);
        String rawRefresh    = generateRawRefreshToken();
        persistRefreshToken(user, rawRefresh);
        return new AuthResponse(accessToken, rawRefresh);
    }

    private String generateAccessToken(User user) {
        Instant now = Instant.now();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("finsight")
                .issuedAt(now)
                .expiresAt(now.plus(ACCESS_TOKEN_MINUTES, ChronoUnit.MINUTES))
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    /** Generates a cryptographically secure 32-byte opaque token, base64url-encoded. */
    private static String generateRawRefreshToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private void persistRefreshToken(User user, String rawToken) {
        RefreshToken rt = RefreshToken.builder()
                .user(user)
                .tokenHash(hashToken(rawToken))
                .expiresAt(Instant.now().plus(REFRESH_TOKEN_DAYS, ChronoUnit.DAYS))
                .createdAt(Instant.now())
                .build();
        refreshTokenRepository.save(rt);
    }

    /** SHA-256 hex of the raw token — stored in DB, never the plaintext. */
    private static String hashToken(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 unavailable", e);
        }
    }
}
