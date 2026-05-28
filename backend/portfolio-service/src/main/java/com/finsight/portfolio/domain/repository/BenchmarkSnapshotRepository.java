package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.BenchmarkSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BenchmarkSnapshotRepository extends JpaRepository<BenchmarkSnapshot, UUID> {

    Optional<BenchmarkSnapshot> findByTickerAndSnapshotDate(String ticker, LocalDate date);

    @Query("""
        SELECT b FROM BenchmarkSnapshot b
        WHERE b.ticker = :ticker AND b.snapshotDate >= :since
        ORDER BY b.snapshotDate ASC
    """)
    List<BenchmarkSnapshot> findByTickerSince(@Param("ticker") String ticker,
                                              @Param("since")  LocalDate since);
}
