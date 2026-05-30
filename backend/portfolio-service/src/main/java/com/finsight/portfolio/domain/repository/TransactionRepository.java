package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    /** Paginated transactions for a user, newest first. */
    @Query("""
        SELECT t FROM Transaction t
        WHERE t.account.plaidItem.user.id = :userId
        ORDER BY t.transactionDate DESC, t.createdAt DESC
    """)
    Page<Transaction> findByUserIdOrderByDateDesc(@Param("userId") UUID userId, Pageable pageable);

    /** Check whether a Plaid transaction ID already exists (for idempotent upsert). */
    boolean existsByPlaidTransactionId(String plaidTransactionId);

    /**
     * All BUY and SELL transactions for a user, oldest first, with account
     * eagerly fetched to avoid N+1 in tax lot matching.
     */
    @Query("""
        SELECT t FROM Transaction t
        JOIN FETCH t.account a
        WHERE a.plaidItem.user.id = :userId
          AND t.transactionType IN ('BUY', 'SELL')
          AND t.ticker IS NOT NULL
          AND t.quantity IS NOT NULL
        ORDER BY t.transactionDate ASC, t.createdAt ASC
    """)
    List<Transaction> findBuyAndSellByUserId(@Param("userId") UUID userId);

    /**
     * All BANK transactions for a user within a date range, newest first.
     * Used by budget and cash flow services.
     */
    @Query("""
        SELECT t FROM Transaction t
        JOIN FETCH t.account a
        WHERE a.plaidItem.user.id = :userId
          AND t.source = 'BANK'
          AND t.transactionDate >= :startDate
          AND t.transactionDate <= :endDate
        ORDER BY t.transactionDate DESC, t.createdAt DESC
    """)
    List<Transaction> findBankByUserIdAndDateRange(
            @Param("userId")    UUID      userId,
            @Param("startDate") java.time.LocalDate startDate,
            @Param("endDate")   java.time.LocalDate endDate);

    /**
     * All BANK transactions for a user (all time), for subscription / recurring detection.
     */
    @Query("""
        SELECT t FROM Transaction t
        JOIN FETCH t.account a
        WHERE a.plaidItem.user.id = :userId
          AND t.source = 'BANK'
        ORDER BY t.transactionDate DESC, t.createdAt DESC
    """)
    List<Transaction> findAllBankByUserId(@Param("userId") UUID userId);
}
