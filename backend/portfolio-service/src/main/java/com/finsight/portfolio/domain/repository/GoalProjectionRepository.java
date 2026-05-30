package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.GoalProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface GoalProjectionRepository extends JpaRepository<GoalProjection, UUID> {

    Optional<GoalProjection> findByGoalId(UUID goalId);

    void deleteByGoalId(UUID goalId);
}
