package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.ManualAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ManualAssetRepository extends JpaRepository<ManualAsset, UUID> {
    List<ManualAsset> findByUserIdOrderByCreatedAtAsc(UUID userId);
    Optional<ManualAsset> findByIdAndUserId(UUID id, UUID userId);
    boolean existsByIdAndUserId(UUID id, UUID userId);
}
