package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.PortfolioSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PortfolioSnapshotRepository extends JpaRepository<PortfolioSnapshot, UUID> {

    /** Returns snapshots for a user in the last N days, ascending by date (oldest first → chart L→R). */
    @Query("""
            SELECT s FROM PortfolioSnapshot s
            WHERE s.user.id = :userId
              AND s.snapshotDate >= :since
            ORDER BY s.snapshotDate ASC
            """)
    List<PortfolioSnapshot> findByUserIdSince(
            @Param("userId") UUID userId,
            @Param("since")  LocalDate since);

    /** Used for upsert: find today's existing snapshot for this user if it exists. */
    Optional<PortfolioSnapshot> findByUserIdAndSnapshotDate(UUID userId, LocalDate snapshotDate);
}
