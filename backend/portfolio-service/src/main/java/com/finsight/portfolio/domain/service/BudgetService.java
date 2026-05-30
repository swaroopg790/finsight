package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.dto.response.BudgetSummaryResponse;
import com.finsight.portfolio.api.dto.response.CategorySpendingItem;
import com.finsight.portfolio.domain.model.BudgetTarget;
import com.finsight.portfolio.domain.model.SpendingCategory;
import com.finsight.portfolio.domain.model.Transaction;
import com.finsight.portfolio.domain.model.User;
import com.finsight.portfolio.domain.repository.BudgetTargetRepository;
import com.finsight.portfolio.domain.repository.TransactionRepository;
import com.finsight.portfolio.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Monthly budget computation.
 *
 * <p>Reads bank transactions for the requested month, aggregates by spending category,
 * and compares actuals against user-configured budget targets.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BudgetService {

    private final TransactionRepository transactionRepository;
    private final BudgetTargetRepository budgetTargetRepository;
    private final UserRepository         userRepository;

    private static final DateTimeFormatter MONTH_LABEL_FMT =
            DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH);

    // ── Read ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public BudgetSummaryResponse getSummary(UUID userId, int year, int month) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end   = start.withDayOfMonth(start.lengthOfMonth());

        List<Transaction> txns = transactionRepository
                .findBankByUserIdAndDateRange(userId, start, end);

        // Build a map from existing budget targets
        Map<String, BigDecimal> budgetMap = new HashMap<>();
        budgetTargetRepository.findByUserId(userId)
                .forEach(t -> budgetMap.put(t.getCategory(), t.getMonthlyBudget()));

        // Aggregate spending per category (exclude INCOME and TRANSFER)
        Map<String, BigDecimal> spentMap  = new LinkedHashMap<>();
        Map<String, Long>       countMap  = new LinkedHashMap<>();
        BigDecimal totalSpent  = BigDecimal.ZERO;
        BigDecimal totalIncome = BigDecimal.ZERO;

        for (Transaction t : txns) {
            String cat = t.getCategory() != null ? t.getCategory() : SpendingCategory.OTHER.name();
            BigDecimal amount = t.getAmount(); // negative = expense, positive = income

            if (amount.compareTo(BigDecimal.ZERO) > 0) {
                // Income / credit
                totalIncome = totalIncome.add(amount);
            } else {
                // Expense / debit — use absolute value
                BigDecimal absAmount = amount.abs();
                if (!SpendingCategory.INCOME.name().equals(cat)
                 && !SpendingCategory.TRANSFER.name().equals(cat)) {
                    totalSpent = totalSpent.add(absAmount);
                    spentMap.merge(cat, absAmount, BigDecimal::add);
                    countMap.merge(cat, 1L, Long::sum);
                }
            }
        }

        // Build category items — include ALL SpendingCategory values that either
        // have spending data or have a budget set, excluding INCOME and TRANSFER
        Set<String> allCats = new LinkedHashSet<>();
        spentMap.keySet().forEach(allCats::add);
        budgetMap.keySet().forEach(allCats::add);

        List<CategorySpendingItem> items = new ArrayList<>();
        BigDecimal totalBudgeted = BigDecimal.ZERO;

        for (String catName : allCats) {
            if (SpendingCategory.INCOME.name().equals(catName)
             || SpendingCategory.TRANSFER.name().equals(catName)) {
                continue;
            }
            SpendingCategory cat;
            try {
                cat = SpendingCategory.valueOf(catName);
            } catch (IllegalArgumentException e) {
                cat = SpendingCategory.OTHER;
            }

            BigDecimal actual  = spentMap.getOrDefault(catName, BigDecimal.ZERO);
            BigDecimal budget  = budgetMap.getOrDefault(catName, BigDecimal.ZERO);
            long       count   = countMap.getOrDefault(catName, 0L);
            totalBudgeted      = totalBudgeted.add(budget);

            double pct = budget.compareTo(BigDecimal.ZERO) > 0
                    ? actual.divide(budget, 4, RoundingMode.HALF_UP)
                             .multiply(BigDecimal.valueOf(100))
                             .doubleValue()
                    : 0.0;

            items.add(new CategorySpendingItem(
                    catName,
                    cat.label(),
                    cat.emoji(),
                    actual,
                    budget,
                    pct,
                    count
            ));
        }

        // Sort by actual spending descending
        items.sort(Comparator.comparing(CategorySpendingItem::actual).reversed());

        BigDecimal netCashFlow = totalIncome.subtract(totalSpent);

        return new BudgetSummaryResponse(
                year,
                month,
                start.format(MONTH_LABEL_FMT),
                totalSpent,
                totalIncome,
                netCashFlow,
                totalBudgeted,
                items
        );
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * Saves / updates monthly budget targets for a user.
     * Supports partial updates — only categories included in the request are changed.
     */
    @Transactional
    public void updateTargets(UUID userId, Map<String, BigDecimal> targets) {
        User userRef = userRepository.getReferenceById(userId);

        for (Map.Entry<String, BigDecimal> entry : targets.entrySet()) {
            String     catName = entry.getKey().toUpperCase(Locale.ROOT);
            BigDecimal budget  = entry.getValue();

            // Validate category name
            try { SpendingCategory.valueOf(catName); }
            catch (IllegalArgumentException e) {
                log.warn("Unknown budget category '{}' — skipping", catName);
                continue;
            }

            BudgetTarget target = budgetTargetRepository
                    .findByUserIdAndCategory(userId, catName)
                    .orElseGet(() -> BudgetTarget.builder()
                            .user(userRef)
                            .category(catName)
                            .build());
            target.setMonthlyBudget(budget);
            budgetTargetRepository.save(target);
        }
    }
}
