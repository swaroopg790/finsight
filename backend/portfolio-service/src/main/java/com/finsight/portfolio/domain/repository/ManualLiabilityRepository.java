package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.ManualLiability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ManualLiabilityRepository extends JpaRepository<ManualLiability, UUID> {
    List<ManualLiability> findByUserIdOrderByCreatedAtAsc(UUID userId);
    Optional<ManualLiability> findByIdAndUserId(UUID id, UUID userId);
    boolean existsByIdAndUserId(UUID id, UUID userId);
}
