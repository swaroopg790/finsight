package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.Position;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PositionRepository extends JpaRepository<Position, UUID> {
    List<Position> findByAccountId(UUID accountId);

    @Query("SELECT p FROM Position p WHERE p.account.plaidItem.user.id = :userId")
    List<Position> findAllByUserId(@Param("userId") UUID userId);

    /** Used by PlaidService to upsert positions during sync. */
    Optional<Position> findByAccountIdAndTicker(UUID accountId, String ticker);

    /** All unique tickers across all users — used by PortfolioSyncScheduler for bulk price enrichment. */
    @Query("SELECT DISTINCT p.ticker FROM Position p")
    List<String> findAllDistinctTickers();

    /**
     * Bulk price update: sets currentPrice and recomputes currentValue for all positions
     * with the given ticker across all users.
     */
    @Modifying
    @Query("UPDATE Position p SET p.currentPrice = :price, p.currentValue = p.quantity * :price WHERE p.ticker = :ticker")
    int updateCurrentPriceByTicker(@Param("ticker") String ticker, @Param("price") BigDecimal price);

    /**
     * Returns (userId, totalValue) pairs — sums priced current values per user.
     * Used by PortfolioSyncScheduler to record daily portfolio snapshots.
     * Positions with null currentValue contribute 0 so snapshot is always recorded.
     */
    @Query("""
            SELECT p.account.plaidItem.user.id, SUM(COALESCE(p.currentValue, 0))
            FROM Position p
            GROUP BY p.account.plaidItem.user.id
            """)
    List<Object[]> sumCurrentValueGroupedByUserId();

    /**
     * Sums current portfolio value for a single user across all positions.
     * Returns 0 when the user has no positions or none are priced yet.
     * Used as a normalization base for benchmark series when no snapshot history exists.
     */
    @Query("""
            SELECT COALESCE(SUM(COALESCE(p.currentValue, 0)), 0)
            FROM Position p
            WHERE p.account.plaidItem.user.id = :userId
            """)
    BigDecimal sumCurrentValueByUserId(@Param("userId") UUID userId);
}
