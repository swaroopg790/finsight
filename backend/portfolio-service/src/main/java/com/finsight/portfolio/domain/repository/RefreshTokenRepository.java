package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** Revokes all sessions for a user — called on logout or password change. */
    void deleteByUserId(UUID userId);

    /** Scheduled cleanup — purge expired tokens nightly. */
    @Modifying
    @Query("DELETE FROM RefreshToken t WHERE t.expiresAt < :now")
    int deleteExpiredBefore(@Param("now") Instant now);
}
