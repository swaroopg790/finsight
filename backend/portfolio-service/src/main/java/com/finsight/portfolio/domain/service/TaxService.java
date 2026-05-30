package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.dto.response.*;
import com.finsight.portfolio.domain.model.Position;
import com.finsight.portfolio.domain.model.Transaction;
import com.finsight.portfolio.domain.repository.PositionRepository;
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
 * Core tax-intelligence engine.
 *
 * <p>Computes realised gains/losses using FIFO, LIFO, or Highest-Cost lot
 * matching, detects wash-sale violations, surfaces tax-loss harvesting
 * opportunities, and generates a year-end advisory.
 *
 * <p>Tax-rate assumptions (suitable for a US earner in the $75 K+ bracket):
 * <ul>
 *   <li>Short-term: 32 % (22 % federal + ~10 % blended state)</li>
 *   <li>Long-term:  20 % (15 % federal + ~5 % blended state)</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TaxService {

    // ── Tax-rate constants ────────────────────────────────────────────────────
    public static final double SHORT_TERM_RATE  = 0.32;
    public static final double LONG_TERM_RATE   = 0.20;

    /** Minimum unrealised loss (USD) before surfacing a harvest alert. */
    private static final BigDecimal HARVEST_THRESHOLD = new BigDecimal("100.00");

    /** Long-term threshold: positions held > 365 days. */
    private static final long LONG_TERM_DAYS = 365L;

    // ── Wash-sale window (IRS: 30 days before + after the sale) ───────────────
    private static final long WASH_SALE_WINDOW = 30L;

    private final TransactionRepository transactionRepository;
    private final PositionRepository    positionRepository;

    // ── Public API ────────────────────────────────────────────────────────────

    public enum CostBasisMethod { FIFO, LIFO, HIGHEST_COST }

    /**
     * Compute the full tax summary for {@code userId} in {@code taxYear}
     * using the given cost-basis method.
     */
    @Transactional(readOnly = true)
    public TaxSummaryResponse computeSummary(UUID userId, int taxYear, CostBasisMethod method) {
        log.debug("Computing tax summary: user={} year={} method={}", userId, taxYear, method);

        // ── 1. Load raw data ──────────────────────────────────────────────────
        List<Transaction> allTxns     = transactionRepository.findBuyAndSellByUserId(userId);
        List<Position>    positions   = positionRepository.findAllByUserId(userId);

        // ── 2. Compute realised gains via lot matching ─────────────────────────
        List<RealizedGainItem> allRealized = matchLots(allTxns, method);

        // ── 3. Filter to the requested tax year ───────────────────────────────
        List<RealizedGainItem> yearRealized = allRealized.stream()
                .filter(r -> r.saleDate().getYear() == taxYear)
                .toList();

        // ── 4. Aggregate short-term vs long-term realised ─────────────────────
        BigDecimal stRealized = sum(yearRealized.stream()
                .filter(r -> !r.longTerm())
                .map(RealizedGainItem::gainLoss)
                .toList());

        BigDecimal ltRealized = sum(yearRealized.stream()
                .filter(RealizedGainItem::longTerm)
                .map(RealizedGainItem::gainLoss)
                .toList());

        BigDecimal totalRealized = stRealized.add(ltRealized);

        // ── 5. Detect wash sales from the year's loss events ──────────────────
        List<WashSaleWarning> washSales = detectWashSales(yearRealized, allTxns);

        // ── 6. Compute unrealised gains on current positions ──────────────────
        // Determine the "earliest buy date" per ticker for ST vs LT classification
        Map<String, LocalDate> earliestBuyDate = buildEarliestBuyDateMap(allTxns);

        BigDecimal stUnrealized = BigDecimal.ZERO;
        BigDecimal ltUnrealized = BigDecimal.ZERO;
        for (Position pos : positions) {
            if (pos.getCostBasis() == null || pos.getCurrentValue() == null) continue;
            BigDecimal unrealizedGain = pos.getCurrentValue().subtract(pos.getCostBasis());
            LocalDate buyDate = earliestBuyDate.get(pos.getTicker());
            boolean isLongTerm = buyDate != null
                    && ChronoUnit.DAYS.between(buyDate, LocalDate.now()) > LONG_TERM_DAYS;
            if (isLongTerm) {
                ltUnrealized = ltUnrealized.add(unrealizedGain);
            } else {
                stUnrealized = stUnrealized.add(unrealizedGain);
            }
        }
        BigDecimal totalUnrealized = stUnrealized.add(ltUnrealized);

        // ── 7. Estimated tax owed on realised gains ────────────────────────────
        // Only positive (gain) portions are taxable; losses offset gains.
        BigDecimal stTax = stRealized.compareTo(BigDecimal.ZERO) > 0
                ? stRealized.multiply(BigDecimal.valueOf(SHORT_TERM_RATE)).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal ltTax = ltRealized.compareTo(BigDecimal.ZERO) > 0
                ? ltRealized.multiply(BigDecimal.valueOf(LONG_TERM_RATE)).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal estimatedTaxOwed = stTax.add(ltTax);

        // ── 8. Harvest opportunities ──────────────────────────────────────────
        List<HarvestOpportunity> harvests = buildHarvestOpportunities(
                positions, earliestBuyDate, allTxns, taxYear);

        BigDecimal totalHarvestableLoss = harvests.stream()
                .map(HarvestOpportunity::unrealizedLoss)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalHarvestSavings = harvests.stream()
                .map(HarvestOpportunity::estimatedTaxSavings)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // ── 9. Year-end advice ────────────────────────────────────────────────
        LocalDate today            = LocalDate.now();
        LocalDate yearEnd          = LocalDate.of(taxYear, 12, 31);
        int daysRemaining          = (int) Math.max(0, ChronoUnit.DAYS.between(today, yearEnd));
        String advice              = buildYearEndAdvice(
                taxYear, stRealized, ltRealized, harvests, washSales, daysRemaining);

        // ── 10. Assemble response ──────────────────────────────────────────────
        return new TaxSummaryResponse(
                taxYear,
                method.name(),
                stRealized.setScale(2, RoundingMode.HALF_UP),
                ltRealized.setScale(2, RoundingMode.HALF_UP),
                totalRealized.setScale(2, RoundingMode.HALF_UP),
                stUnrealized.setScale(2, RoundingMode.HALF_UP),
                ltUnrealized.setScale(2, RoundingMode.HALF_UP),
                totalUnrealized.setScale(2, RoundingMode.HALF_UP),
                estimatedTaxOwed,
                SHORT_TERM_RATE,
                LONG_TERM_RATE,
                daysRemaining,
                advice,
                totalHarvestableLoss.abs().setScale(2, RoundingMode.HALF_UP),
                totalHarvestSavings.setScale(2, RoundingMode.HALF_UP),
                yearRealized,
                harvests,
                washSales
        );
    }

    // ── Lot matching ──────────────────────────────────────────────────────────

    /**
     * Walk all BUY/SELL transactions in chronological order and match sells
     * against open lots using the chosen method.
     */
    private List<RealizedGainItem> matchLots(List<Transaction> txns, CostBasisMethod method) {
        // Per-ticker queue of open lots  (Deque supports FIFO and LIFO efficiently)
        Map<String, Deque<TaxLot>> openLots = new HashMap<>();
        List<RealizedGainItem> realized      = new ArrayList<>();

        for (Transaction t : txns) {
            String ticker = t.getTicker();
            if (ticker == null || ticker.isBlank()) continue;

            BigDecimal qty = t.getQuantity();
            if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) continue;

            if ("BUY".equalsIgnoreCase(t.getTransactionType())) {
                BigDecimal costPerShare = deriveCostPerShare(t);
                if (costPerShare == null || costPerShare.compareTo(BigDecimal.ZERO) <= 0) continue;

                TaxLot lot = new TaxLot(t.getTransactionDate(), qty, costPerShare,
                        t.getAccount().getName(), t.getSecurityName());
                Deque<TaxLot> deque = openLots.computeIfAbsent(ticker, k -> new ArrayDeque<>());
                if (method == CostBasisMethod.LIFO) {
                    deque.addFirst(lot);   // newest at head
                } else {
                    deque.addLast(lot);    // oldest at head for FIFO / will sort for HIGHEST_COST
                }

            } else if ("SELL".equalsIgnoreCase(t.getTransactionType())) {
                Deque<TaxLot> deque = openLots.get(ticker);
                if (deque == null || deque.isEmpty()) continue;

                // For HIGHEST_COST: sort the deque so most-expensive lot is first
                if (method == CostBasisMethod.HIGHEST_COST) {
                    List<TaxLot> sorted = new ArrayList<>(deque);
                    sorted.sort(Comparator.comparing(TaxLot::costPerShare).reversed());
                    deque.clear();
                    deque.addAll(sorted);
                }

                BigDecimal proceedsPerShare = deriveProeedsPerShare(t);
                BigDecimal remainingSellQty = qty;
                String accountName = t.getAccount().getName();
                String secName     = t.getSecurityName() != null ? t.getSecurityName()
                                   : (deque.isEmpty() ? ticker : deque.peekFirst().securityName());

                while (remainingSellQty.compareTo(BigDecimal.ZERO) > 0 && !deque.isEmpty()) {
                    TaxLot lot       = deque.peekFirst();
                    BigDecimal consumed = remainingSellQty.min(lot.remaining());

                    BigDecimal lotCost     = consumed.multiply(lot.costPerShare()).setScale(4, RoundingMode.HALF_UP);
                    BigDecimal lotProceeds = proceedsPerShare != null
                            ? consumed.multiply(proceedsPerShare).setScale(4, RoundingMode.HALF_UP)
                            : consumed.multiply(proceedsPerShare != null ? proceedsPerShare : BigDecimal.ZERO).setScale(4, RoundingMode.HALF_UP);

                    // Fallback when no per-share sell price: use total amount
                    if (proceedsPerShare == null) {
                        // distribute total proceeds proportionally to qty consumed
                        if (remainingSellQty.compareTo(BigDecimal.ZERO) > 0) {
                            BigDecimal totalProceeds = t.getAmount() != null
                                    ? t.getAmount().abs()
                                    : BigDecimal.ZERO;
                            lotProceeds = totalProceeds
                                    .multiply(consumed)
                                    .divide(qty, 4, RoundingMode.HALF_UP);
                        }
                    }

                    long holdingDays = ChronoUnit.DAYS.between(lot.purchaseDate(), t.getTransactionDate());
                    boolean lt       = holdingDays > LONG_TERM_DAYS;

                    realized.add(new RealizedGainItem(
                            ticker,
                            secName,
                            consumed.setScale(6, RoundingMode.HALF_UP),
                            lotProceeds,
                            lotCost,
                            lotProceeds.subtract(lotCost).setScale(2, RoundingMode.HALF_UP),
                            lt,
                            t.getTransactionDate(),
                            lot.purchaseDate(),
                            holdingDays,
                            accountName
                    ));

                    lot.deduct(consumed);
                    remainingSellQty = remainingSellQty.subtract(consumed);
                    if (lot.remaining().compareTo(BigDecimal.ZERO) <= 0) {
                        deque.pollFirst();
                    }
                }
            }
        }
        return realized;
    }

    // ── Wash-sale detection ───────────────────────────────────────────────────

    private List<WashSaleWarning> detectWashSales(
            List<RealizedGainItem> yearRealized,
            List<Transaction> allTxns) {

        // Only look at loss events
        List<RealizedGainItem> losses = yearRealized.stream()
                .filter(r -> r.gainLoss().compareTo(BigDecimal.ZERO) < 0)
                .toList();
        if (losses.isEmpty()) return List.of();

        // Index all BUY transactions by ticker for fast lookup
        Map<String, List<Transaction>> buysByTicker = allTxns.stream()
                .filter(t -> "BUY".equalsIgnoreCase(t.getTransactionType()))
                .collect(Collectors.groupingBy(Transaction::getTicker));

        List<WashSaleWarning> warnings = new ArrayList<>();
        Set<String> seen = new HashSet<>(); // dedup (ticker + saleDate)

        for (RealizedGainItem loss : losses) {
            String key = loss.ticker() + "|" + loss.saleDate();
            if (seen.contains(key)) continue;

            List<Transaction> buys = buysByTicker.getOrDefault(loss.ticker(), List.of());
            for (Transaction buy : buys) {
                long daysBetween = Math.abs(ChronoUnit.DAYS.between(loss.saleDate(), buy.getTransactionDate()));
                if (daysBetween <= WASH_SALE_WINDOW) {
                    seen.add(key);
                    String msg = String.format(
                            "You sold %s at a loss of %s on %s, but purchased it on %s "
                          + "(%d days %s the sale). The IRS may disallow this loss deduction "
                          + "(wash-sale rule). Consult a tax professional.",
                            loss.ticker(),
                            formatUsd(loss.gainLoss().abs()),
                            loss.saleDate(),
                            buy.getTransactionDate(),
                            daysBetween,
                            buy.getTransactionDate().isBefore(loss.saleDate()) ? "before" : "after"
                    );
                    warnings.add(new WashSaleWarning(
                            loss.ticker(),
                            loss.securityName(),
                            loss.saleDate(),
                            buy.getTransactionDate(),
                            loss.gainLoss().abs(),
                            msg
                    ));
                    break; // one warning per loss event is enough
                }
            }
        }
        return warnings;
    }

    // ── Harvest opportunities ─────────────────────────────────────────────────

    private List<HarvestOpportunity> buildHarvestOpportunities(
            List<Position> positions,
            Map<String, LocalDate> earliestBuyDate,
            List<Transaction> allTxns,
            int taxYear) {

        LocalDate today    = LocalDate.now();
        LocalDate yearEnd  = LocalDate.of(taxYear, 12, 31);
        if (today.isAfter(yearEnd)) return List.of(); // past tax year — no harvesting

        // Recent buys (last 30 days) by ticker — for wash-sale risk check
        Set<String> recentBuyTickers = allTxns.stream()
                .filter(t -> "BUY".equalsIgnoreCase(t.getTransactionType()))
                .filter(t -> ChronoUnit.DAYS.between(t.getTransactionDate(), today) <= WASH_SALE_WINDOW)
                .map(Transaction::getTicker)
                .collect(Collectors.toSet());

        List<HarvestOpportunity> opps = new ArrayList<>();

        for (Position pos : positions) {
            if (pos.getCostBasis() == null || pos.getCurrentValue() == null) continue;
            if (pos.getTicker() == null) continue;

            BigDecimal unrealizedGain = pos.getCurrentValue().subtract(pos.getCostBasis());
            // Only harvest losses
            if (unrealizedGain.compareTo(HARVEST_THRESHOLD.negate()) >= 0) continue;

            BigDecimal unrealizedLoss = unrealizedGain.abs(); // positive number = magnitude of loss

            LocalDate buyDate   = earliestBuyDate.get(pos.getTicker());
            boolean shortTerm   = buyDate == null
                    || ChronoUnit.DAYS.between(buyDate, today) <= LONG_TERM_DAYS;
            double  rate        = shortTerm ? SHORT_TERM_RATE : LONG_TERM_RATE;
            BigDecimal savings  = unrealizedLoss
                    .multiply(BigDecimal.valueOf(rate))
                    .setScale(2, RoundingMode.HALF_UP);

            boolean washSaleRisk = recentBuyTickers.contains(pos.getTicker());

            String secName = pos.getName() != null ? pos.getName() : pos.getTicker();
            String rec     = buildHarvestRecommendation(pos.getTicker(), secName,
                    unrealizedLoss, savings, shortTerm, washSaleRisk);

            opps.add(new HarvestOpportunity(
                    pos.getTicker(),
                    secName,
                    pos.getQuantity(),
                    pos.getCurrentValue().setScale(2, RoundingMode.HALF_UP),
                    pos.getCostBasis().setScale(2, RoundingMode.HALF_UP),
                    unrealizedLoss.setScale(2, RoundingMode.HALF_UP),
                    savings,
                    shortTerm,
                    washSaleRisk,
                    rec
            ));
        }

        // Sort largest savings first
        opps.sort(Comparator.comparing(HarvestOpportunity::estimatedTaxSavings).reversed());
        return opps;
    }

    // ── Year-end advisory ─────────────────────────────────────────────────────

    private String buildYearEndAdvice(
            int taxYear,
            BigDecimal stRealized,
            BigDecimal ltRealized,
            List<HarvestOpportunity> harvests,
            List<WashSaleWarning> washSales,
            int daysRemaining) {

        if (daysRemaining <= 0) {
            return String.format("Tax year %d is complete. Review your Schedule D before filing.", taxYear);
        }

        List<String> lines = new ArrayList<>();

        // Harvest nudge
        if (!harvests.isEmpty()) {
            BigDecimal totalSavings = harvests.stream()
                    .map(HarvestOpportunity::estimatedTaxSavings)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            lines.add(String.format(
                    "You have %d tax-loss harvesting opportunity%s worth ~%s in tax savings before Dec 31.",
                    harvests.size(),
                    harvests.size() == 1 ? "" : "s",
                    formatUsd(totalSavings)
            ));
        }

        // Short-term to long-term conversion nudge
        if (stRealized.compareTo(BigDecimal.ZERO) > 0 && ltRealized.compareTo(stRealized) < 0) {
            lines.add(String.format(
                    "Your short-term gains (%s) are taxed at %.0f%%. Consider deferring "
                  + "additional sells beyond the 365-day mark to qualify for the %.0f%% long-term rate.",
                    formatUsd(stRealized),
                    SHORT_TERM_RATE * 100,
                    LONG_TERM_RATE * 100
            ));
        }

        // Wash-sale alert
        if (!washSales.isEmpty()) {
            lines.add(String.format(
                    "⚠️ %d potential wash-sale violation%s detected. Disallowed losses will "
                  + "increase your taxable income — review with a tax professional.",
                    washSales.size(),
                    washSales.size() == 1 ? "" : "s"
            ));
        }

        // Default encouraging message
        if (lines.isEmpty()) {
            if (daysRemaining < 45) {
                lines.add(String.format(
                        "Only %d days left in %d. Confirm your cost-basis method with your broker "
                      + "and review open positions for any last-minute harvesting opportunities.",
                        daysRemaining, taxYear
                ));
            } else {
                lines.add(String.format(
                        "%d days remaining in %d. Your portfolio looks clean — "
                      + "no immediate tax action required.",
                        daysRemaining, taxYear
                ));
            }
        }

        return String.join(" ", lines);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private BigDecimal deriveCostPerShare(Transaction t) {
        if (t.getPrice() != null && t.getPrice().compareTo(BigDecimal.ZERO) > 0) {
            return t.getPrice();
        }
        // Derive from total amount (negative for buys)
        if (t.getAmount() != null && t.getQuantity() != null
                && t.getQuantity().compareTo(BigDecimal.ZERO) > 0) {
            return t.getAmount().abs().divide(t.getQuantity(), 4, RoundingMode.HALF_UP);
        }
        return null;
    }

    private BigDecimal deriveProeedsPerShare(Transaction t) {
        if (t.getPrice() != null && t.getPrice().compareTo(BigDecimal.ZERO) > 0) {
            return t.getPrice();
        }
        if (t.getAmount() != null && t.getQuantity() != null
                && t.getQuantity().compareTo(BigDecimal.ZERO) > 0) {
            return t.getAmount().abs().divide(t.getQuantity(), 4, RoundingMode.HALF_UP);
        }
        return null;
    }

    /** Earliest BUY date per ticker — used for unrealised ST/LT classification. */
    private Map<String, LocalDate> buildEarliestBuyDateMap(List<Transaction> txns) {
        Map<String, LocalDate> map = new HashMap<>();
        for (Transaction t : txns) {
            if (!"BUY".equalsIgnoreCase(t.getTransactionType())) continue;
            if (t.getTicker() == null) continue;
            map.merge(t.getTicker(), t.getTransactionDate(),
                    (existing, newDate) -> newDate.isBefore(existing) ? newDate : existing);
        }
        return map;
    }

    private String buildHarvestRecommendation(
            String ticker, String secName,
            BigDecimal loss, BigDecimal savings,
            boolean shortTerm, boolean washSaleRisk) {

        StringBuilder sb = new StringBuilder();
        sb.append(String.format(
                "Sell %s (%s) to lock in a %s loss, saving ~%s in %s-term taxes.",
                ticker, secName, formatUsd(loss), formatUsd(savings),
                shortTerm ? "short" : "long"
        ));
        if (washSaleRisk) {
            sb.append(String.format(
                    " ⚠️ Wash-sale risk: you purchased %s within the last 30 days. "
                  + "Wait 31+ days since your last buy, or the loss may be disallowed.",
                    ticker
            ));
        } else {
            sb.append(String.format(
                    " Wait 31+ days before rebuying %s to avoid the wash-sale rule.",
                    ticker
            ));
        }
        return sb.toString();
    }

    private BigDecimal sum(List<BigDecimal> values) {
        return values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String formatUsd(BigDecimal v) {
        return "$" + String.format("%,.2f", v.abs());
    }

    // ── Inner mutable tax-lot ─────────────────────────────────────────────────

    private static class TaxLot {
        private final LocalDate  purchaseDate;
        private       BigDecimal remaining;
        private final BigDecimal costPerShare;
        private final String     accountName;
        private final String     securityName;

        TaxLot(LocalDate purchaseDate, BigDecimal quantity,
               BigDecimal costPerShare, String accountName, String securityName) {
            this.purchaseDate = purchaseDate;
            this.remaining    = quantity;
            this.costPerShare = costPerShare;
            this.accountName  = accountName;
            this.securityName = securityName;
        }

        LocalDate  purchaseDate() { return purchaseDate; }
        BigDecimal remaining()    { return remaining;    }
        BigDecimal costPerShare() { return costPerShare; }
        String     accountName()  { return accountName;  }
        String     securityName() { return securityName; }

        void deduct(BigDecimal qty) {
            remaining = remaining.subtract(qty);
        }
    }
}
