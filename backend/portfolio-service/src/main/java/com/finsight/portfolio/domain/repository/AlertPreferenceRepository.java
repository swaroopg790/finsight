package com.finsight.portfolio.domain.repository;

import com.finsight.portfolio.domain.model.AlertPreference;
import com.finsight.portfolio.domain.model.AlertPreference.AlertType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AlertPreferenceRepository extends JpaRepository<AlertPreference, UUID> {

    List<AlertPreference> findByUserId(UUID userId);

    Optional<AlertPreference> findByUserIdAndAlertType(UUID userId, AlertType alertType);

    /** All enabled preferences of a given type — used by the alert scheduler. */
    List<AlertPreference> findByAlertTypeAndEnabledTrue(AlertType alertType);
}
