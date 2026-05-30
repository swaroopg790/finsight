package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.dto.request.ManualAssetRequest;
import com.finsight.portfolio.api.dto.request.ManualLiabilityRequest;
import com.finsight.portfolio.api.dto.response.*;
import com.finsight.portfolio.domain.model.*;
import com.finsight.portfolio.domain.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * Computes and tracks net worth over time.
 *
 * <p>Net worth = Total Assets − Total Liabilities, where:
 * <ul>
 *   <li>Assets = investment holdings (positions) + depository accounts + manual assets</li>
 *   <li>Liabilities = Plaid credit accounts + Plaid loan accounts + manual liabilities</li>
 * </ul>
 *
 * <p>Milestones are checked at $10K, $25K, $50K, $100K, $250K, $500K, $1M, $2.5M, $5M, $10M.
 * A milestone fires once: it's returned as "new" when the net worth first crosses it in a
 * newly-saved snapshot (compared to the previous snapshot).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NetWorthService {

    private static final BigDecimal[] MILESTONES = {
        new BigDecimal("10000"),
        new BigDecimal("25000"),
        new BigDecimal("50000"),
        new BigDecimal("100000"),
        new BigDecimal("250000"),
        new BigDecimal("500000"),
        new BigDecimal("1000000"),
        new BigDecimal("2500000"),
        new BigDecimal("5000000"),
        new BigDecimal("10000000"),
    };

    private final ManualAssetRepository      manualAssetRepo;
    private final ManualLiabilityRepository  manualLiabilityRepo;
    private final NetWorthSnapshotRepository snapshotRepo;
    private final AccountRepository          accountRepository;
    private final PositionRepository         positionRepository;
    private final UserRepository             userRepository;

    // ── Summary ───────────────────────────────────────────────────────────────

    @Transactional
    public NetWorthSummaryResponse getSummary(UUID userId) {
        LocalDate today = LocalDate.now();

        // ── Compute current components ────────────────────────────────────────
        Components c = computeComponents(userId);

        // ── Persist today's snapshot (upsert) ────────────────────────────────
        NetWorthSnapshot snapshot = upsertSnapshot(userId, today, c);

        // ── Change vs yesterday ───────────────────────────────────────────────
        List<NetWorthSnapshot> recent = snapshotRepo.findTop2ByUserIdOrderBySnapshotDateDesc(userId);
        BigDecimal changeToday    = BigDecimal.ZERO;
        BigDecimal changeTodayPct = BigDecimal.ZERO;
        if (recent.size() == 2) {
            BigDecimal prev = recent.get(1).getNetWorth();
            changeToday = snapshot.getNetWorth().subtract(prev);
            if (prev.compareTo(BigDecimal.ZERO) != 0) {
                changeTodayPct = changeToday
                    .divide(prev.abs(), 4, RoundingMode.HALF_UP);
            }
        }

        // ── Milestone detection ───────────────────────────────────────────────
        List<MilestoneResponse> newMilestones = detectNewMilestones(recent, snapshot.getNetWorth());

        // ── Build response ────────────────────────────────────────────────────
        List<ManualAssetResponse>     assets      = c.manualAssets.stream().map(this::toAssetResponse).toList();
        List<ManualLiabilityResponse> liabilities = c.manualLiabilities.stream().map(this::toLiabilityResponse).toList();

        return new NetWorthSummaryResponse(
            snapshot.getNetWorth(),
            today,
            snapshot.getTotalAssets(),
            snapshot.getInvestmentValue(),
            snapshot.getDepositoryValue(),
            BigDecimal.ZERO,          // credit asset (positive balance on credit = asset, rare)
            snapshot.getManualAssetValue(),
            snapshot.getTotalLiabilities(),
            snapshot.getCreditCardBalance(),
            snapshot.getLoanBalance(),
            snapshot.getManualLiabilityBalance(),
            changeToday,
            changeTodayPct,
            newMilestones,
            assets,
            liabilities,
            c.plaidAccountLines
        );
    }

    // ── History ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public NetWorthHistoryResponse getHistory(UUID userId, String period) {
        LocalDate from = switch (period.toUpperCase()) {
            case "3Y"  -> LocalDate.now().minusYears(3);
            case "5Y"  -> LocalDate.now().minusYears(5);
            case "ALL" -> LocalDate.of(2000, 1, 1);
            default    -> LocalDate.now().minusYears(1);   // "1Y"
        };

        List<NetWorthSnapshot> snapshots = snapshotRepo.findByUserIdAndDateRange(userId, from);

        List<NetWorthHistoryResponse.DataPoint> points = snapshots.stream()
            .map(s -> new NetWorthHistoryResponse.DataPoint(
                s.getSnapshotDate(),
                s.getNetWorth(),
                s.getTotalAssets(),
                s.getTotalLiabilities()))
            .toList();

        BigDecimal startVal   = points.isEmpty() ? BigDecimal.ZERO : points.get(0).netWorth();
        BigDecimal endVal     = points.isEmpty() ? BigDecimal.ZERO : points.get(points.size() - 1).netWorth();
        BigDecimal change     = endVal.subtract(startVal);
        BigDecimal changePct  = startVal.compareTo(BigDecimal.ZERO) != 0
            ? change.divide(startVal.abs(), 4, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;

        return new NetWorthHistoryResponse(period.toUpperCase(), points, startVal, endVal, change, changePct);
    }

    // ── Manual Assets CRUD ────────────────────────────────────────────────────

    @Transactional
    public ManualAssetResponse createAsset(UUID userId, ManualAssetRequest req) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "User not found"));
        AssetType type = parseAssetType(req.assetType());
        ManualAsset asset = manualAssetRepo.save(ManualAsset.builder()
            .user(user).name(req.name()).assetType(type)
            .value(req.value()).notes(req.notes()).build());
        triggerSnapshot(userId);
        return toAssetResponse(asset);
    }

    @Transactional
    public ManualAssetResponse updateAsset(UUID userId, UUID assetId, ManualAssetRequest req) {
        ManualAsset asset = manualAssetRepo.findByIdAndUserId(assetId, userId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Asset not found"));
        asset.setName(req.name());
        asset.setAssetType(parseAssetType(req.assetType()));
        asset.setValue(req.value());
        asset.setNotes(req.notes());
        asset = manualAssetRepo.save(asset);
        triggerSnapshot(userId);
        return toAssetResponse(asset);
    }

    @Transactional
    public void deleteAsset(UUID userId, UUID assetId) {
        if (!manualAssetRepo.existsByIdAndUserId(assetId, userId))
            throw new ResponseStatusException(NOT_FOUND, "Asset not found");
        manualAssetRepo.deleteById(assetId);
        triggerSnapshot(userId);
    }

    // ── Manual Liabilities CRUD ───────────────────────────────────────────────

    @Transactional
    public ManualLiabilityResponse createLiability(UUID userId, ManualLiabilityRequest req) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "User not found"));
        LiabilityType type = parseLiabilityType(req.liabilityType());
        ManualLiability liability = manualLiabilityRepo.save(ManualLiability.builder()
            .user(user).name(req.name()).liabilityType(type)
            .balance(req.balance()).interestRate(req.interestRate()).notes(req.notes()).build());
        triggerSnapshot(userId);
        return toLiabilityResponse(liability);
    }

    @Transactional
    public ManualLiabilityResponse updateLiability(UUID userId, UUID liabilityId, ManualLiabilityRequest req) {
        ManualLiability liability = manualLiabilityRepo.findByIdAndUserId(liabilityId, userId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Liability not found"));
        liability.setName(req.name());
        liability.setLiabilityType(parseLiabilityType(req.liabilityType()));
        liability.setBalance(req.balance());
        liability.setInterestRate(req.interestRate());
        liability.setNotes(req.notes());
        liability = manualLiabilityRepo.save(liability);
        triggerSnapshot(userId);
        return toLiabilityResponse(liability);
    }

    @Transactional
    public void deleteLiability(UUID userId, UUID liabilityId) {
        if (!manualLiabilityRepo.existsByIdAndUserId(liabilityId, userId))
            throw new ResponseStatusException(NOT_FOUND, "Liability not found");
        manualLiabilityRepo.deleteById(liabilityId);
        triggerSnapshot(userId);
    }

    // ── Snapshot (called from sync pipeline) ─────────────────────────────────

    /** Public entry point for PlaidService to call after each sync. */
    @Transactional
    public void triggerSnapshot(UUID userId) {
        try {
            Components c = computeComponents(userId);
            upsertSnapshot(userId, LocalDate.now(), c);
        } catch (Exception e) {
            log.warn("Net worth snapshot failed for user={}: {}", userId, e.getMessage());
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private record Components(
        BigDecimal investmentValue,
        BigDecimal depositoryValue,
        BigDecimal manualAssetValue,
        BigDecimal totalAssets,
        BigDecimal creditCardBalance,
        BigDecimal loanBalance,
        BigDecimal manualLiabilityBalance,
        BigDecimal totalLiabilities,
        BigDecimal netWorth,
        List<ManualAsset>     manualAssets,
        List<ManualLiability> manualLiabilities,
        List<NetWorthSummaryResponse.AccountLineItem> plaidAccountLines
    ) {}

    private Components computeComponents(UUID userId) {
        List<Account> accounts = accountRepository.findByPlaidItemUserId(userId);
        List<ManualAsset>     mAssets = manualAssetRepo.findByUserIdOrderByCreatedAtAsc(userId);
        List<ManualLiability> mLibs   = manualLiabilityRepo.findByUserIdOrderByCreatedAtAsc(userId);

        BigDecimal investmentValue   = BigDecimal.ZERO;
        BigDecimal depositoryValue   = BigDecimal.ZERO;
        BigDecimal creditCardBalance = BigDecimal.ZERO;
        BigDecimal loanBalance       = BigDecimal.ZERO;

        List<NetWorthSummaryResponse.AccountLineItem> lines = new ArrayList<>();

        for (Account a : accounts) {
            BigDecimal bal = a.getBalanceCurrent() != null ? a.getBalanceCurrent() : BigDecimal.ZERO;
            String type    = a.getType() != null ? a.getType().toLowerCase() : "";

            boolean isLiability = false;
            switch (type) {
                case "depository" -> depositoryValue   = depositoryValue.add(bal);
                case "investment",
                     "brokerage"  -> investmentValue   = investmentValue.add(bal);
                case "credit"     -> { creditCardBalance = creditCardBalance.add(bal); isLiability = true; }
                case "loan"       -> { loanBalance       = loanBalance.add(bal);       isLiability = true; }
            }
            lines.add(new NetWorthSummaryResponse.AccountLineItem(
                a.getName(),
                a.getPlaidItem().getInstitutionName(),
                a.getType(),
                a.getSubtype(),
                bal,
                isLiability
            ));
        }

        // Investment positions: use current value from positions table (more accurate than account balance)
        try {
            BigDecimal positionsValue = positionRepository.findAllByUserId(userId)
                .stream()
                .filter(p -> p.getCurrentValue() != null)
                .map(Position::getCurrentValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (positionsValue.compareTo(BigDecimal.ZERO) > 0) {
                investmentValue = positionsValue;
            }
        } catch (Exception e) {
            log.debug("Could not sum positions for user={}: {}", userId, e.getMessage());
        }

        BigDecimal manualAssetValue = mAssets.stream()
            .map(ManualAsset::getValue)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal manualLibValue = mLibs.stream()
            .map(ManualLiability::getBalance)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalAssets      = investmentValue.add(depositoryValue).add(manualAssetValue);
        BigDecimal totalLiabilities = creditCardBalance.add(loanBalance).add(manualLibValue);
        BigDecimal netWorth         = totalAssets.subtract(totalLiabilities);

        return new Components(
            investmentValue, depositoryValue, manualAssetValue, totalAssets,
            creditCardBalance, loanBalance, manualLibValue, totalLiabilities,
            netWorth, mAssets, mLibs, lines
        );
    }

    private NetWorthSnapshot upsertSnapshot(UUID userId, LocalDate date, Components c) {
        User user = userRepository.getReferenceById(userId);

        Optional<NetWorthSnapshot> existing = snapshotRepo.findByUserIdAndSnapshotDate(userId, date);
        NetWorthSnapshot snapshot;
        if (existing.isPresent()) {
            snapshot = existing.get();
            snapshot.setInvestmentValue(c.investmentValue());
            snapshot.setDepositoryValue(c.depositoryValue());
            snapshot.setManualAssetValue(c.manualAssetValue());
            snapshot.setTotalAssets(c.totalAssets());
            snapshot.setCreditCardBalance(c.creditCardBalance());
            snapshot.setLoanBalance(c.loanBalance());
            snapshot.setManualLiabilityBalance(c.manualLiabilityBalance());
            snapshot.setTotalLiabilities(c.totalLiabilities());
            snapshot.setNetWorth(c.netWorth());
        } else {
            snapshot = NetWorthSnapshot.builder()
                .user(user)
                .snapshotDate(date)
                .investmentValue(c.investmentValue())
                .depositoryValue(c.depositoryValue())
                .manualAssetValue(c.manualAssetValue())
                .totalAssets(c.totalAssets())
                .creditCardBalance(c.creditCardBalance())
                .loanBalance(c.loanBalance())
                .manualLiabilityBalance(c.manualLiabilityBalance())
                .totalLiabilities(c.totalLiabilities())
                .netWorth(c.netWorth())
                .build();
        }
        return snapshotRepo.save(snapshot);
    }

    private List<MilestoneResponse> detectNewMilestones(List<NetWorthSnapshot> recent,
                                                          BigDecimal currentNw) {
        List<MilestoneResponse> crossed = new ArrayList<>();
        if (recent.size() < 2) return crossed;

        BigDecimal prevNw = recent.get(1).getNetWorth();
        LocalDate today   = LocalDate.now();

        for (BigDecimal milestone : MILESTONES) {
            // Crossed upward: previous was below threshold, current is above
            if (prevNw.compareTo(milestone) < 0 && currentNw.compareTo(milestone) >= 0) {
                crossed.add(new MilestoneResponse(
                    milestone,
                    "You crossed " + formatMilestone(milestone) + " net worth! 🎉",
                    "🎉",
                    today
                ));
            }
        }
        return crossed;
    }

    private String formatMilestone(BigDecimal v) {
        double d = v.doubleValue();
        if (d >= 1_000_000) return String.format("$%.0fM", d / 1_000_000);
        if (d >= 1_000)     return String.format("$%.0fK", d / 1_000);
        return "$" + v.toPlainString();
    }

    // ── Enum parsers ──────────────────────────────────────────────────────────

    private AssetType parseAssetType(String s) {
        try { return AssetType.valueOf(s.toUpperCase()); }
        catch (IllegalArgumentException e) { return AssetType.OTHER; }
    }

    private LiabilityType parseLiabilityType(String s) {
        try { return LiabilityType.valueOf(s.toUpperCase()); }
        catch (IllegalArgumentException e) { return LiabilityType.OTHER; }
    }

    // ── Response mappers ──────────────────────────────────────────────────────

    private ManualAssetResponse toAssetResponse(ManualAsset a) {
        return new ManualAssetResponse(
            a.getId(), a.getName(),
            a.getAssetType().name(), a.getAssetType().label(), a.getAssetType().emoji(),
            a.getValue(), a.getNotes(), a.getUpdatedAt()
        );
    }

    private ManualLiabilityResponse toLiabilityResponse(ManualLiability l) {
        return new ManualLiabilityResponse(
            l.getId(), l.getName(),
            l.getLiabilityType().name(), l.getLiabilityType().label(), l.getLiabilityType().emoji(),
            l.getBalance(), l.getInterestRate(), l.getNotes(), l.getUpdatedAt()
        );
    }
}
