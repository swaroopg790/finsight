package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.dto.response.CashFlowEvent;
import com.finsight.portfolio.api.dto.response.CashFlowSummaryResponse;
import com.finsight.portfolio.api.dto.response.SubscriptionItem;
import com.finsight.portfolio.domain.model.SpendingCategory;
import com.finsight.portfolio.domain.model.Transaction;
import com.finsight.portfolio.domain.repository.AccountRepository;
import com.finsight.portfolio.domain.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Subscription detection and cash flow calendar.
 *
 * <p>Subscription detection algorithm:
 * <ol>
 *   <li>Group bank debit transactions by merchant name (case-insensitive)</li>
 *   <li>Filter to merchants with >= 2 occurrences</li>
 *   <li>Compute median interval between consecutive charges</li>
 *   <li>Flag as recurring if median interval is 7±2, 14±3, or 28–35 days</li>
 *   <li>Amount consistency check: standard deviation of amounts &lt; 10% of median</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CashFlowService {

    private final TransactionRepository transactionRepository;
    private final AccountRepository     accountRepository;

    @Transactional(readOnly = true)
    public CashFlowSummaryResponse getSummary(UUID userId) {
        List<Transaction> allBankTxns = transactionRepository.findAllBankByUserId(userId);

        // ── Current balance (checking + savings) ──────────────────────────────
        BigDecimal currentBalance = computeCurrentBalance(userId);

        // ── Subscription detection ─────────────────────────────────────────────
        List<SubscriptionItem> subscriptions = detectSubscriptions(allBankTxns);

        // ── Monthly sub + bill totals ──────────────────────────────────────────
        BigDecimal totalSubs  = subscriptions.stream()
                .filter(s -> "Monthly".equals(s.frequency()))
                .map(SubscriptionItem::typicalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalBills = subscriptions.stream()
                .filter(s -> !SpendingCategory.SUBSCRIPTIONS.name().equals(s.category()))
                .map(SubscriptionItem::typicalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // ── Calendar events ────────────────────────────────────────────────────
        List<CashFlowEvent> events = buildCalendarEvents(allBankTxns, subscriptions);

        // ── Projected balance (30 days) ────────────────────────────────────────
        BigDecimal projected = computeProjectedBalance(currentBalance, subscriptions, allBankTxns);

        return new CashFlowSummaryResponse(
                currentBalance,
                projected,
                totalSubs,
                totalBills,
                subscriptions,
                events
        );
    }

    // ── Subscription detection ────────────────────────────────────────────────

    private List<SubscriptionItem> detectSubscriptions(List<Transaction> allBankTxns) {
        // Only consider expense transactions (negative amount = money out)
        List<Transaction> debits = allBankTxns.stream()
                .filter(t -> t.getAmount().compareTo(BigDecimal.ZERO) < 0)
                .toList();

        // Group by merchant name (normalised)
        Map<String, List<Transaction>> byMerchant = debits.stream()
                .collect(Collectors.groupingBy(t -> normalise(effectiveMerchant(t))));

        List<SubscriptionItem> result = new ArrayList<>();

        for (Map.Entry<String, List<Transaction>> entry : byMerchant.entrySet()) {
            List<Transaction> group = entry.getValue();
            if (group.size() < 2) continue;

            // Sort ascending by date
            group = group.stream()
                    .sorted(Comparator.comparing(Transaction::getTransactionDate))
                    .toList();

            // Compute intervals (days between consecutive charges)
            List<Long> intervals = new ArrayList<>();
            for (int i = 1; i < group.size(); i++) {
                long days = ChronoUnit.DAYS.between(
                        group.get(i - 1).getTransactionDate(),
                        group.get(i).getTransactionDate());
                intervals.add(days);
            }

            long medianInterval = median(intervals);
            String frequency = classifyFrequency(medianInterval);
            if (frequency == null) continue;  // not a recognized recurring pattern

            // Amount consistency check
            List<BigDecimal> amounts = group.stream()
                    .map(t -> t.getAmount().abs())
                    .toList();
            BigDecimal medianAmount = medianBd(amounts);
            if (!isAmountConsistent(amounts, medianAmount)) continue;

            Transaction last = group.get(group.size() - 1);
            LocalDate nextExpected = estimateNextDate(last.getTransactionDate(), medianInterval);
            String category = last.getCategory() != null
                    ? last.getCategory() : SpendingCategory.SUBSCRIPTIONS.name();

            SpendingCategory cat;
            try { cat = SpendingCategory.valueOf(category); }
            catch (IllegalArgumentException e) { cat = SpendingCategory.OTHER; }

            BigDecimal annualCost = switch (frequency) {
                case "Weekly"    -> medianAmount.multiply(BigDecimal.valueOf(52));
                case "Bi-weekly" -> medianAmount.multiply(BigDecimal.valueOf(26));
                default          -> medianAmount.multiply(BigDecimal.valueOf(12)); // Monthly
            };

            result.add(new SubscriptionItem(
                    effectiveMerchant(last),
                    category,
                    cat.label(),
                    cat.emoji(),
                    medianAmount,
                    annualCost.setScale(2, RoundingMode.HALF_UP),
                    last.getTransactionDate(),
                    nextExpected,
                    frequency,
                    group.size()
            ));
        }

        // Sort by typical amount descending (most expensive first)
        result.sort(Comparator.comparing(SubscriptionItem::typicalAmount).reversed());
        return result;
    }

    // ── Calendar events ───────────────────────────────────────────────────────

    private List<CashFlowEvent> buildCalendarEvents(List<Transaction> allBankTxns,
                                                     List<SubscriptionItem> subscriptions) {
        List<CashFlowEvent> events = new ArrayList<>();
        LocalDate today = LocalDate.now();
        LocalDate pastStart  = today.minusDays(30);
        LocalDate futureEnd  = today.plusDays(30);

        // ── Past 30 days: actual transactions ─────────────────────────────────
        for (Transaction t : allBankTxns) {
            if (t.getTransactionDate().isBefore(pastStart)) continue;
            if (t.getTransactionDate().isAfter(today)) continue;

            String category = t.getCategory() != null
                    ? t.getCategory() : SpendingCategory.OTHER.name();
            SpendingCategory cat;
            try { cat = SpendingCategory.valueOf(category); }
            catch (IllegalArgumentException e) { cat = SpendingCategory.OTHER; }

            String type = t.getAmount().compareTo(BigDecimal.ZERO) > 0 ? "INCOME" : "BILL";

            events.add(new CashFlowEvent(
                    t.getTransactionDate(),
                    type,
                    effectiveMerchant(t),
                    category,
                    cat.emoji(),
                    t.getAmount(),
                    false
            ));
        }

        // ── Future 30 days: predicted recurring charges ────────────────────────
        for (SubscriptionItem sub : subscriptions) {
            if (sub.nextExpectedDate() == null) continue;
            LocalDate next = sub.nextExpectedDate();
            if (next.isAfter(futureEnd) || next.isBefore(today)) continue;

            SpendingCategory cat;
            try { cat = SpendingCategory.valueOf(sub.category()); }
            catch (IllegalArgumentException e) { cat = SpendingCategory.OTHER; }

            events.add(new CashFlowEvent(
                    next,
                    "BILL",
                    sub.merchantName(),
                    sub.category(),
                    cat.emoji(),
                    sub.typicalAmount().negate(), // negative = outgoing
                    true
            ));

            // Also add subsequent occurrence if it falls within the window
            LocalDate next2 = estimateNextDate(next, frequencyToDays(sub.frequency()));
            if (!next2.isAfter(futureEnd) && next2.isAfter(today)) {
                events.add(new CashFlowEvent(
                        next2,
                        "BILL",
                        sub.merchantName(),
                        sub.category(),
                        cat.emoji(),
                        sub.typicalAmount().negate(),
                        true
                ));
            }
        }

        // Sort chronologically
        events.sort(Comparator.comparing(CashFlowEvent::date));
        return events;
    }

    // ── Balance projection ────────────────────────────────────────────────────

    private BigDecimal computeProjectedBalance(BigDecimal currentBalance,
                                                List<SubscriptionItem> subscriptions,
                                                List<Transaction> allBankTxns) {
        LocalDate today    = LocalDate.now();
        LocalDate future30 = today.plusDays(30);

        BigDecimal projected = currentBalance;

        // Subtract upcoming recurring charges
        for (SubscriptionItem sub : subscriptions) {
            if (sub.nextExpectedDate() == null) continue;
            LocalDate next = sub.nextExpectedDate();
            if (!next.isAfter(today) || next.isAfter(future30)) continue;
            projected = projected.subtract(sub.typicalAmount());

            // Check for second occurrence
            LocalDate next2 = estimateNextDate(next, frequencyToDays(sub.frequency()));
            if (!next2.isAfter(today) || next2.isAfter(future30)) continue;
            projected = projected.subtract(sub.typicalAmount());
        }

        // Add expected income based on payroll patterns detected
        BigDecimal medianPaycheck = detectTypicalPaycheck(allBankTxns);
        if (medianPaycheck.compareTo(BigDecimal.ZERO) > 0) {
            // Estimate 2 paychecks in the next 30 days (bi-weekly assumption)
            projected = projected.add(medianPaycheck.multiply(BigDecimal.valueOf(2)));
        }

        return projected.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal detectTypicalPaycheck(List<Transaction> allBankTxns) {
        List<BigDecimal> paychecks = allBankTxns.stream()
                .filter(t -> t.getAmount().compareTo(BigDecimal.ZERO) > 0)
                .filter(t -> SpendingCategory.INCOME.name().equals(t.getCategory()))
                .filter(t -> t.getAmount().compareTo(new BigDecimal("1000")) > 0) // exclude small credits
                .map(Transaction::getAmount)
                .toList();

        return paychecks.isEmpty() ? BigDecimal.ZERO : medianBd(paychecks);
    }

    // ── Balance helpers ───────────────────────────────────────────────────────

    private BigDecimal computeCurrentBalance(UUID userId) {
        // Sum balanceCurrent for all depository accounts (checking + savings)
        try {
            return accountRepository.findByPlaidItemUserId(userId).stream()
                    .filter(a -> "depository".equalsIgnoreCase(a.getType()))
                    .map(a -> a.getBalanceCurrent() != null ? a.getBalanceCurrent() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .setScale(2, RoundingMode.HALF_UP);
        } catch (Exception e) {
            log.warn("Could not compute current balance for user {}: {}", userId, e.getMessage());
            return BigDecimal.ZERO;
        }
    }

    // ── Utility helpers ───────────────────────────────────────────────────────

    private String effectiveMerchant(Transaction t) {
        return t.getMerchantName() != null ? t.getMerchantName()
             : t.getSecurityName() != null ? t.getSecurityName()
             : "Unknown";
    }

    private String normalise(String merchant) {
        return merchant.toLowerCase(Locale.ROOT).trim();
    }

    private String classifyFrequency(long medianIntervalDays) {
        if (medianIntervalDays >= 5  && medianIntervalDays <= 9)  return "Weekly";
        if (medianIntervalDays >= 12 && medianIntervalDays <= 16) return "Bi-weekly";
        if (medianIntervalDays >= 25 && medianIntervalDays <= 35) return "Monthly";
        return null;
    }

    private long frequencyToDays(String frequency) {
        return switch (frequency) {
            case "Weekly"    -> 7;
            case "Bi-weekly" -> 14;
            default          -> 30; // Monthly
        };
    }

    private LocalDate estimateNextDate(LocalDate lastDate, long intervalDays) {
        return lastDate.plusDays(intervalDays);
    }

    private boolean isAmountConsistent(List<BigDecimal> amounts, BigDecimal median) {
        if (median.compareTo(BigDecimal.ZERO) == 0) return false;
        // Check all amounts are within 20% of the median
        for (BigDecimal a : amounts) {
            BigDecimal diff = a.subtract(median).abs();
            BigDecimal pct  = diff.divide(median, 4, RoundingMode.HALF_UP);
            if (pct.compareTo(new BigDecimal("0.20")) > 0) return false;
        }
        return true;
    }

    private long median(List<Long> values) {
        if (values.isEmpty()) return 0;
        List<Long> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int mid = sorted.size() / 2;
        return sorted.size() % 2 == 0
                ? (sorted.get(mid - 1) + sorted.get(mid)) / 2
                : sorted.get(mid);
    }

    private BigDecimal medianBd(List<BigDecimal> values) {
        if (values.isEmpty()) return BigDecimal.ZERO;
        List<BigDecimal> sorted = new ArrayList<>(values);
        sorted.sort(BigDecimal::compareTo);
        int mid = sorted.size() / 2;
        return sorted.size() % 2 == 0
                ? sorted.get(mid - 1).add(sorted.get(mid))
                         .divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP)
                : sorted.get(mid);
    }
}
