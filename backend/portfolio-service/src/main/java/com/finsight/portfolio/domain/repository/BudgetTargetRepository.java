package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.BudgetTarget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BudgetTargetRepository extends JpaRepository<BudgetTarget, UUID> {

    List<BudgetTarget> findByUserId(UUID userId);

    Optional<BudgetTarget> findByUserIdAndCategory(UUID userId, String category);
}
