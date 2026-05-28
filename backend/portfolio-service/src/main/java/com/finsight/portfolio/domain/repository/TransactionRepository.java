package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
}
