package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.dto.response.AccountResponse;
import com.finsight.portfolio.api.dto.response.AllocationItem;
import com.finsight.portfolio.api.dto.response.HoldingResponse;
import com.finsight.portfolio.api.dto.response.SnapshotPoint;
import com.finsight.portfolio.domain.model.Position;
import com.finsight.portfolio.domain.repository.AccountRepository;
import com.finsight.portfolio.domain.repository.PortfolioSnapshotRepository;
import com.finsight.portfolio.domain.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PortfolioService {

    private final PositionRepository         positionRepository;
    private final AccountRepository          accountRepository;
    private final PortfolioSnapshotRepository snapshotRepository;

    // ── Holdings ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HoldingResponse> getHoldings(UUID userId) {
        return positionRepository.findAllByUserId(userId).stream()
                .map(this::toHoldingResponse)
                .toList();
    }

    // ── Accounts ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AccountResponse> getAccounts(UUID userId) {
        return accountRepository.findByPlaidItemUserId(userId).stream()
                .map(account -> new AccountResponse(
                        account.getId(),
                        account.getPlaidItem().getId(),
                        account.getName(),
                        account.getType(),
                        account.getSubtype(),
                        account.getBalanceCurrent(),
                        account.getBalanceAvailable(),
                        account.getCurrency(),
                        account.getPlaidItem().getInstitutionName()
                ))
                .toList();
    }

    // ── Performance chart ─────────────────────────────────────────────────────

    /**
     * Returns daily portfolio value snapshots for the past {@code days} calendar days.
     * The chart will be sparse for new users (scheduler records one point per run).
     */
    @Transactional(readOnly = true)
    public List<SnapshotPoint> getPerformance(UUID userId, int days) {
        LocalDate since = LocalDate.now().minusDays(days);
        return snapshotRepository.findByUserIdSince(userId, since).stream()
                .map(s -> new SnapshotPoint(s.getSnapshotDate(), s.getTotalValue()))
                .toList();
    }

    // ── Asset allocation ──────────────────────────────────────────────────────

    /**
     * Builds a breakdown of portfolio allocation by ticker, sorted by value descending.
     * Only includes positions that have a priced current value.
     * Positions without prices are excluded (can't meaningfully allocate $0).
     */
    @Transactional(readOnly = true)
    public List<AllocationItem> getAllocation(UUID userId) {
        List<Position> positions = positionRepository.findAllByUserId(userId).stream()
                .filter(p -> p.getCurrentValue() != null
                          && p.getCurrentValue().compareTo(BigDecimal.ZERO) > 0)
                .toList();

        if (positions.isEmpty()) return List.of();

        BigDecimal total = positions.stream()
                .map(Position::getCurrentValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return positions.stream()
                .map(p -> new AllocationItem(
                        p.getTicker(),
                        p.getName() != null ? p.getName() : p.getTicker(),
                        p.getCurrentValue(),
                        p.getCurrentValue()
                                .divide(total, 4, RoundingMode.HALF_UP)
                                .multiply(BigDecimal.valueOf(100))
                                .setScale(2, RoundingMode.HALF_UP)
                ))
                .sorted(Comparator.comparing(AllocationItem::value).reversed())
                .toList();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private HoldingResponse toHoldingResponse(Position p) {
        BigDecimal gainLoss = null;
        BigDecimal gainLossPct = null;
        if (p.getCurrentValue() != null
                && p.getCostBasis() != null
                && p.getCostBasis().compareTo(BigDecimal.ZERO) != 0) {
            gainLoss = p.getCurrentValue().subtract(p.getCostBasis());
            gainLossPct = gainLoss.divide(p.getCostBasis(), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));
        }
        return new HoldingResponse(
                p.getId(),
                p.getTicker(),
                p.getName(),
                p.getQuantity(),
                p.getCostBasis(),
                p.getCurrentPrice(),
                p.getCurrentValue(),
                gainLoss,
                gainLossPct,
                p.getAccount().getName()
        );
    }
}
