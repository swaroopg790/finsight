package com.finsight.portfolio.infrastructure.plaid;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Mock PlaidGateway — returns realistic but synthetic portfolio data.
 * Active when PLAID_MODE=mock (or when PLAID_MODE is not set).
 *
 * Useful for local development without Plaid credentials.
 * Switch to real Plaid: set PLAID_MODE=sandbox + PLAID_CLIENT_ID + PLAID_SECRET.
 *
 * Each "connection" generates a unique access token whose trailing chars seed
 * unique account IDs, so multiple mock connects produce distinct accounts.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "finsight.plaid.mode", havingValue = "mock", matchIfMissing = true)
public class PlaidClient implements PlaidGateway {

    @Override
    public String createLinkToken(String userId) {
        log.info("[MOCK] Creating link token for user {}", userId);
        return "link-mock-sandbox-" + userId;
    }

    @Override
    public ExchangeResult exchangePublicToken(String publicToken) {
        log.info("[MOCK] Exchanging public token: {}", publicToken);
        String accessToken = "mock-access-token-" + UUID.randomUUID();
        String itemId      = "mock-item-id-"      + UUID.randomUUID();
        return new ExchangeResult(accessToken, itemId);
    }

    @Override
    public List<AccountData> fetchAccounts(String accessToken) {
        String suffix = suffix(accessToken);
        log.info("[MOCK] Fetching accounts for token suffix={}", suffix);
        return List.of(
                new AccountData("mock-brokerage-" + suffix, "Brokerage Account",
                        "investment", "brokerage",
                        new BigDecimal("145890.45"), new BigDecimal("145890.45"), "USD"),
                new AccountData("mock-roth-" + suffix, "Roth IRA",
                        "investment", "ira",
                        new BigDecimal("78234.12"), new BigDecimal("78234.12"), "USD")
        );
    }

    @Override
    public List<HoldingData> fetchHoldings(String accessToken) {
        String suffix    = suffix(accessToken);
        String brokerage = "mock-brokerage-" + suffix;
        String roth      = "mock-roth-"      + suffix;
        log.info("[MOCK] Fetching holdings for token suffix={}", suffix);

        return List.of(
                // ── Brokerage Account ─────────────────────────────────────────────
                holding(brokerage, "AAPL",  "Apple Inc.",         50,  148.00,  189.30),
                holding(brokerage, "MSFT",  "Microsoft Corp.",    25,  265.00,  415.50),
                holding(brokerage, "NVDA",  "NVIDIA Corp.",       20,  425.00,  875.20),
                holding(brokerage, "VTI",   "Vanguard Total Mkt", 150, 198.00,  238.40),
                holding(brokerage, "AMZN",  "Amazon.com Inc.",    15,  128.00,  192.50),
                // ── Roth IRA ─────────────────────────────────────────────────────
                holding(roth,      "GOOGL", "Alphabet Inc.",      30,  122.00,  172.80),
                holding(roth,      "BND",   "Vanguard Total Bond",200,  71.50,   73.50),
                holding(roth,      "VXUS",  "Vanguard Intl ETF", 100,   53.00,   58.20),
                holding(roth,      "FBTC",  "Fidelity Bitcoin",    5,   42.00,   98.50)
        );
    }

    @Override
    public List<TransactionData> fetchInvestmentTransactions(String accessToken,
                                                              LocalDate startDate,
                                                              LocalDate endDate) {
        String suffix    = suffix(accessToken);
        String brokerage = "mock-brokerage-" + suffix;
        String roth      = "mock-roth-"      + suffix;
        log.info("[MOCK] Fetching investment transactions for token suffix={}", suffix);

        List<TransactionData> txns = new ArrayList<>();
        // Generate realistic mock transactions spread over the last 90 days
        LocalDate base = LocalDate.now();
        String prefix  = "mock-txn-" + suffix + "-";

        txns.add(new TransactionData(brokerage, prefix + "1",  "AAPL",  "Apple Inc.",      "buy",      new BigDecimal("10"),  new BigDecimal("148.00"), new BigDecimal("-1480.00"), base.minusDays(85)));
        txns.add(new TransactionData(brokerage, prefix + "2",  "MSFT",  "Microsoft Corp.", "buy",      new BigDecimal("5"),   new BigDecimal("265.00"), new BigDecimal("-1325.00"), base.minusDays(80)));
        txns.add(new TransactionData(brokerage, prefix + "3",  "NVDA",  "NVIDIA Corp.",    "buy",      new BigDecimal("10"),  new BigDecimal("425.00"), new BigDecimal("-4250.00"), base.minusDays(75)));
        txns.add(new TransactionData(brokerage, prefix + "4",  "VTI",   "Vanguard Total",  "buy",      new BigDecimal("50"),  new BigDecimal("198.00"), new BigDecimal("-9900.00"), base.minusDays(70)));
        txns.add(new TransactionData(brokerage, prefix + "5",  "AAPL",  "Apple Inc.",      "buy",      new BigDecimal("40"),  new BigDecimal("152.00"), new BigDecimal("-6080.00"), base.minusDays(60)));
        txns.add(new TransactionData(brokerage, prefix + "6",  "AMZN",  "Amazon.com Inc.", "buy",      new BigDecimal("15"),  new BigDecimal("128.00"), new BigDecimal("-1920.00"), base.minusDays(55)));
        txns.add(new TransactionData(brokerage, prefix + "7",  "VTI",   "Vanguard Total",  "dividend", null,                  null,                     new BigDecimal("47.20"),   base.minusDays(45)));
        txns.add(new TransactionData(brokerage, prefix + "8",  "VTI",   "Vanguard Total",  "buy",      new BigDecimal("100"), new BigDecimal("200.00"), new BigDecimal("-20000.00"),base.minusDays(40)));
        txns.add(new TransactionData(roth,      prefix + "9",  "GOOGL", "Alphabet Inc.",   "buy",      new BigDecimal("30"),  new BigDecimal("122.00"), new BigDecimal("-3660.00"), base.minusDays(35)));
        txns.add(new TransactionData(roth,      prefix + "10", "BND",   "Vanguard Bond",   "buy",      new BigDecimal("200"), new BigDecimal("71.50"),  new BigDecimal("-14300.00"),base.minusDays(30)));
        txns.add(new TransactionData(roth,      prefix + "11", "BND",   "Vanguard Bond",   "dividend", null,                  null,                     new BigDecimal("32.50"),   base.minusDays(20)));
        txns.add(new TransactionData(roth,      prefix + "12", "VXUS",  "Vanguard Intl",   "buy",      new BigDecimal("100"), new BigDecimal("53.00"),  new BigDecimal("-5300.00"), base.minusDays(15)));
        txns.add(new TransactionData(roth,      prefix + "13", "FBTC",  "Fidelity Bitcoin","buy",      new BigDecimal("5"),   new BigDecimal("42.00"),  new BigDecimal("-210.00"),  base.minusDays(10)));
        txns.add(new TransactionData(brokerage, prefix + "14", "NVDA",  "NVIDIA Corp.",    "buy",      new BigDecimal("10"),  new BigDecimal("850.00"), new BigDecimal("-8500.00"), base.minusDays(5)));

        // Filter to requested date range
        return txns.stream()
                .filter(t -> !t.date().isBefore(startDate) && !t.date().isAfter(endDate))
                .toList();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private HoldingData holding(String accountId, String ticker, String name,
                                 double qty, double costPerShare, double currentPrice) {
        BigDecimal quantity     = BigDecimal.valueOf(qty);
        BigDecimal totalCost    = BigDecimal.valueOf(qty * costPerShare);
        BigDecimal price        = BigDecimal.valueOf(currentPrice);
        return new HoldingData(accountId, ticker, name, quantity, totalCost, price);
    }

    /** Last 8 chars of the access token — unique per connection, stable across calls. */
    private String suffix(String accessToken) {
        return accessToken.substring(Math.max(0, accessToken.length() - 8));
    }
}
