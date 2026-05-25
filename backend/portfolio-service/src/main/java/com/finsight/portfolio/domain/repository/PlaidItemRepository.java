package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.PlaidItem;
import com.finsight.portfolio.domain.model.PlaidItem.PlaidItemStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlaidItemRepository extends JpaRepository<PlaidItem, UUID> {
    List<PlaidItem> findByUserIdAndStatus(UUID userId, PlaidItemStatus status);
    List<PlaidItem> findByStatus(PlaidItemStatus status);

    /** Security-scoped lookup — returns empty if itemId exists but belongs to a different user. */
    Optional<PlaidItem> findByIdAndUserId(UUID id, UUID userId);
}
