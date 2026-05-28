package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.dto.response.AccountResponse;
import com.finsight.portfolio.api.dto.response.AllocationItem;
import com.finsight.portfolio.api.dto.response.HoldingResponse;
import com.finsight.portfolio.api.dto.response.PerformanceResponse;
import com.finsight.portfolio.domain.model.PortfolioSnapshot;
import com.finsight.portfolio.domain.model.Position;
import com.finsight.portfolio.domain.model.User;
import com.finsight.portfolio.domain.repository.AccountRepository;
import com.finsight.portfolio.domain.repository.PortfolioSnapshotRepository;
import com.finsight.portfolio.domain.repository.PositionRepository;
import com.finsight.portfolio.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PortfolioService {

    private final PositionRepository         positionRepository;
    private final AccountRepository          accountRepository;
    private final PortfolioSnapshotRepository snapshotRepository;
    private final BenchmarkService           benchmarkService;
    private final UserRepository             userRepository;

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
     * Returns daily portfolio value snapshots plus SPY and QQQ benchmark overlays
     * for the past {@code days} calendar days.
     *
     * Both benchmarks are normalised to the portfolio's starting value so all three
     * series can be plotted on the same dollar Y-axis.
     *
     * New-user path: the portfolio snapshot history is empty until the 4-hour scheduler
     * records the first entry.  In that case we fall back to the user's current live
     * position value (sum of currentValue across all positions) as the normalization base.
     * This ensures SPY/QQQ benchmark lines always render right after a brokerage is
     * connected and prices are enriched — no need to wait for the next scheduler run.
     */
    @Transactional(readOnly = true)
    public PerformanceResponse getPerformance(UUID userId, int days) {
        LocalDate since = LocalDate.now().minusDays(days);

        List<PerformanceResponse.DataPoint> portfolio = snapshotRepository
                .findByUserIdSince(userId, since).stream()
                .map(s -> new PerformanceResponse.DataPoint(s.getSnapshotDate(), s.getTotalValue()))
                .toList();

        // Normalization base: use the Day-0 snapshot value when available.
        // New users have no snapshots yet → use the live positions total so benchmarks
        // can still be normalised and rendered on the same Y-axis.
        BigDecimal portfolioStartValue;
        if (!portfolio.isEmpty()) {
            portfolioStartValue = portfolio.get(0).value();
        } else {
            portfolioStartValue = positionRepository.sumCurrentValueByUserId(userId);
        }

        List<PerformanceResponse.DataPoint> spy = benchmarkService.getNormalizedSeries(
                "SPY", since, portfolioStartValue);
        List<PerformanceResponse.DataPoint> qqq = benchmarkService.getNormalizedSeries(
                "QQQ", since, portfolioStartValue);

        return new PerformanceResponse(portfolio, spy, qqq);
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

    // ── Snapshot recording ────────────────────────────────────────────────────

    /**
     * Records (or updates) today's portfolio snapshot for a single user based on
     * the current sum of position values.  Called from the manual sync endpoint so
     * the performance chart has at least one data point immediately after the user
     * connects their first brokerage — no need to wait for the 4-hour scheduler.
     *
     * <p>No-ops when the user has no priced positions yet (total value == 0).
     */
    @Transactional
    public void recordSnapshotForUser(UUID userId) {
        BigDecimal totalValue = positionRepository.sumCurrentValueByUserId(userId);
        if (totalValue == null || totalValue.compareTo(BigDecimal.ZERO) == 0) {
            log.debug("Skipping snapshot for user={} — no priced positions yet", userId);
            return;
        }

        User user = userRepository.getReferenceById(userId);
        LocalDate today = LocalDate.now();

        PortfolioSnapshot snapshot = snapshotRepository
                .findByUserIdAndSnapshotDate(userId, today)
                .orElseGet(() -> PortfolioSnapshot.builder()
                        .user(user)
                        .snapshotDate(today)
                        .createdAt(Instant.now())
                        .build());

        snapshot.setTotalValue(totalValue);
        snapshotRepository.save(snapshot);
        log.info("Snapshot recorded on manual sync: user={} date={} value={}", userId, today, totalValue);
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
