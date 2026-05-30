package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.FinancialGoal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FinancialGoalRepository extends JpaRepository<FinancialGoal, UUID> {

    List<FinancialGoal> findByUserIdOrderByCreatedAtAsc(UUID userId);

    Optional<FinancialGoal> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByIdAndUserId(UUID id, UUID userId);
}
