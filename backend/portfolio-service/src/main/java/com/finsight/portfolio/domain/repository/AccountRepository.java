package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<Account, UUID> {
    List<Account> findByPlaidItemId(UUID plaidItemId);
    List<Account> findByPlaidItemUserId(UUID userId);

    /** Used by PlaidService to upsert accounts during sync. */
    Optional<Account> findByPlaidAccountId(String plaidAccountId);
}
