package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.NetWorthSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NetWorthSnapshotRepository extends JpaRepository<NetWorthSnapshot, UUID> {

    @Query("""
        SELECT s FROM NetWorthSnapshot s
        WHERE s.user.id = :userId
          AND s.snapshotDate >= :from
        ORDER BY s.snapshotDate ASC
    """)
    List<NetWorthSnapshot> findByUserIdAndDateRange(
            @Param("userId") UUID userId,
            @Param("from")   LocalDate from);

    @Query("""
        SELECT s FROM NetWorthSnapshot s
        WHERE s.user.id = :userId
        ORDER BY s.snapshotDate DESC
        LIMIT 1
    """)
    Optional<NetWorthSnapshot> findLatestByUserId(@Param("userId") UUID userId);

    Optional<NetWorthSnapshot> findByUserIdAndSnapshotDate(UUID userId, LocalDate snapshotDate);

    /** Two most-recent snapshots — used for milestone detection (prev vs current). */
    @Query("""
        SELECT s FROM NetWorthSnapshot s
        WHERE s.user.id = :userId
        ORDER BY s.snapshotDate DESC
        LIMIT 2
    """)
    List<NetWorthSnapshot> findTop2ByUserIdOrderBySnapshotDateDesc(@Param("userId") UUID userId);
}
