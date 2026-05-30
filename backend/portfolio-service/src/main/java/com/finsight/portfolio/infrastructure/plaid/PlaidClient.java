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
                        new BigDecimal("78234.12"), new BigDecimal("78234.12"), "USD"),
                new AccountData("mock-checking-" + suffix, "Chase Checking",
                        "depository", "checking",
                        new BigDecimal("8234.56"), new BigDecimal("7980.00"), "USD"),
                new AccountData("mock-savings-" + suffix, "Chase Savings",
                        "depository", "savings",
                        new BigDecimal("32150.00"), new BigDecimal("32150.00"), "USD")
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

    @Override
    public List<BankTransactionData> fetchBankTransactions(String accessToken,
                                                            LocalDate startDate,
                                                            LocalDate endDate) {
        String suffix   = suffix(accessToken);
        String checking = "mock-checking-" + suffix;
        log.info("[MOCK] Fetching bank transactions for token suffix={}", suffix);

        List<BankTransactionData> txns = new ArrayList<>();
        LocalDate base   = LocalDate.now();
        String    prefix = "mock-bank-txn-" + suffix + "-";

        // ── Groceries ──────────────────────────────────────────────────────────
        txns.add(bank(prefix + "g1",  checking, "Whole Foods Market",   new BigDecimal("-127.43"), base.minusDays(3),  List.of("Food and Drink", "Groceries")));
        txns.add(bank(prefix + "g2",  checking, "Trader Joe's",         new BigDecimal("-89.12"),  base.minusDays(10), List.of("Food and Drink", "Groceries")));
        txns.add(bank(prefix + "g3",  checking, "Whole Foods Market",   new BigDecimal("-134.67"), base.minusDays(33), List.of("Food and Drink", "Groceries")));
        txns.add(bank(prefix + "g4",  checking, "Trader Joe's",         new BigDecimal("-95.40"),  base.minusDays(40), List.of("Food and Drink", "Groceries")));
        txns.add(bank(prefix + "g5",  checking, "Kroger",               new BigDecimal("-68.22"),  base.minusDays(55), List.of("Food and Drink", "Groceries")));
        txns.add(bank(prefix + "g6",  checking, "Whole Foods Market",   new BigDecimal("-142.11"),  base.minusDays(64), List.of("Food and Drink", "Groceries")));

        // ── Dining & Coffee ────────────────────────────────────────────────────
        txns.add(bank(prefix + "d1",  checking, "Starbucks",            new BigDecimal("-7.45"),   base.minusDays(1),  List.of("Food and Drink", "Coffee Shop")));
        txns.add(bank(prefix + "d2",  checking, "Chipotle",             new BigDecimal("-14.85"),  base.minusDays(4),  List.of("Food and Drink", "Restaurants")));
        txns.add(bank(prefix + "d3",  checking, "Starbucks",            new BigDecimal("-6.95"),   base.minusDays(8),  List.of("Food and Drink", "Coffee Shop")));
        txns.add(bank(prefix + "d4",  checking, "DoorDash",             new BigDecimal("-38.50"),  base.minusDays(12), List.of("Food and Drink", "Food Delivery")));
        txns.add(bank(prefix + "d5",  checking, "Starbucks",            new BigDecimal("-8.20"),   base.minusDays(15), List.of("Food and Drink", "Coffee Shop")));
        txns.add(bank(prefix + "d6",  checking, "Sweetgreen",           new BigDecimal("-17.40"),  base.minusDays(18), List.of("Food and Drink", "Restaurants")));
        txns.add(bank(prefix + "d7",  checking, "Starbucks",            new BigDecimal("-7.65"),   base.minusDays(22), List.of("Food and Drink", "Coffee Shop")));
        txns.add(bank(prefix + "d8",  checking, "Chipotle",             new BigDecimal("-13.95"),  base.minusDays(25), List.of("Food and Drink", "Restaurants")));
        txns.add(bank(prefix + "d9",  checking, "DoorDash",             new BigDecimal("-42.80"),  base.minusDays(42), List.of("Food and Drink", "Food Delivery")));
        txns.add(bank(prefix + "d10", checking, "Starbucks",            new BigDecimal("-7.95"),   base.minusDays(50), List.of("Food and Drink", "Coffee Shop")));

        // ── Subscriptions (monthly recurring) ─────────────────────────────────
        txns.add(bank(prefix + "s1",  checking, "Netflix",              new BigDecimal("-22.99"),  base.minusDays(2),  List.of("Service", "Subscription")));
        txns.add(bank(prefix + "s2",  checking, "Spotify",              new BigDecimal("-10.99"),  base.minusDays(5),  List.of("Service", "Music")));
        txns.add(bank(prefix + "s3",  checking, "Amazon Prime",         new BigDecimal("-14.99"),  base.minusDays(7),  List.of("Service", "Subscription")));
        txns.add(bank(prefix + "s4",  checking, "Hulu",                 new BigDecimal("-17.99"),  base.minusDays(9),  List.of("Service", "Subscription")));
        txns.add(bank(prefix + "s5",  checking, "Adobe Creative Cloud", new BigDecimal("-54.99"),  base.minusDays(14), List.of("Service", "Software")));
        txns.add(bank(prefix + "s6",  checking, "Netflix",              new BigDecimal("-22.99"),  base.minusDays(32), List.of("Service", "Subscription")));
        txns.add(bank(prefix + "s7",  checking, "Spotify",              new BigDecimal("-10.99"),  base.minusDays(35), List.of("Service", "Music")));
        txns.add(bank(prefix + "s8",  checking, "Amazon Prime",         new BigDecimal("-14.99"),  base.minusDays(37), List.of("Service", "Subscription")));
        txns.add(bank(prefix + "s9",  checking, "Hulu",                 new BigDecimal("-17.99"),  base.minusDays(39), List.of("Service", "Subscription")));
        txns.add(bank(prefix + "s10", checking, "Adobe Creative Cloud", new BigDecimal("-54.99"),  base.minusDays(44), List.of("Service", "Software")));
        txns.add(bank(prefix + "s11", checking, "iCloud Storage",       new BigDecimal("-2.99"),   base.minusDays(6),  List.of("Service", "Subscription")));
        txns.add(bank(prefix + "s12", checking, "iCloud Storage",       new BigDecimal("-2.99"),   base.minusDays(36), List.of("Service", "Subscription")));
        txns.add(bank(prefix + "s13", checking, "ChatGPT Plus",         new BigDecimal("-20.00"),  base.minusDays(11), List.of("Service", "Software")));
        txns.add(bank(prefix + "s14", checking, "ChatGPT Plus",         new BigDecimal("-20.00"),  base.minusDays(41), List.of("Service", "Software")));
        txns.add(bank(prefix + "s15", checking, "LinkedIn Premium",     new BigDecimal("-39.99"),  base.minusDays(20), List.of("Service", "Subscription")));
        txns.add(bank(prefix + "s16", checking, "LinkedIn Premium",     new BigDecimal("-39.99"),  base.minusDays(50), List.of("Service", "Subscription")));

        // ── Utilities ──────────────────────────────────────────────────────────
        txns.add(bank(prefix + "u1",  checking, "PG&E Electric",        new BigDecimal("-148.32"), base.minusDays(16), List.of("Service", "Electric")));
        txns.add(bank(prefix + "u2",  checking, "AT&T Mobile",          new BigDecimal("-85.00"),  base.minusDays(18), List.of("Service", "Phone")));
        txns.add(bank(prefix + "u3",  checking, "City Water & Sewer",   new BigDecimal("-52.18"),  base.minusDays(22), List.of("Service", "Utilities")));
        txns.add(bank(prefix + "u4",  checking, "PG&E Electric",        new BigDecimal("-161.47"), base.minusDays(46), List.of("Service", "Electric")));
        txns.add(bank(prefix + "u5",  checking, "AT&T Mobile",          new BigDecimal("-85.00"),  base.minusDays(48), List.of("Service", "Phone")));
        txns.add(bank(prefix + "u6",  checking, "City Water & Sewer",   new BigDecimal("-49.88"),  base.minusDays(52), List.of("Service", "Utilities")));
        txns.add(bank(prefix + "u7",  checking, "Xfinity Internet",     new BigDecimal("-79.99"),  base.minusDays(23), List.of("Service", "Internet")));
        txns.add(bank(prefix + "u8",  checking, "Xfinity Internet",     new BigDecimal("-79.99"),  base.minusDays(53), List.of("Service", "Internet")));

        // ── Transport ──────────────────────────────────────────────────────────
        txns.add(bank(prefix + "t1",  checking, "Uber",                 new BigDecimal("-24.50"),  base.minusDays(2),  List.of("Travel", "Rideshare")));
        txns.add(bank(prefix + "t2",  checking, "Lyft",                 new BigDecimal("-18.75"),  base.minusDays(6),  List.of("Travel", "Rideshare")));
        txns.add(bank(prefix + "t3",  checking, "Shell Gas Station",    new BigDecimal("-67.40"),  base.minusDays(9),  List.of("Travel", "Gas")));
        txns.add(bank(prefix + "t4",  checking, "Uber",                 new BigDecimal("-31.20"),  base.minusDays(13), List.of("Travel", "Rideshare")));
        txns.add(bank(prefix + "t5",  checking, "Shell Gas Station",    new BigDecimal("-71.80"),  base.minusDays(39), List.of("Travel", "Gas")));

        // ── Shopping ───────────────────────────────────────────────────────────
        txns.add(bank(prefix + "sh1", checking, "Amazon",               new BigDecimal("-156.99"), base.minusDays(5),  List.of("Shopping")));
        txns.add(bank(prefix + "sh2", checking, "Target",               new BigDecimal("-89.43"),  base.minusDays(20), List.of("Shopping", "Department Stores")));
        txns.add(bank(prefix + "sh3", checking, "Amazon",               new BigDecimal("-43.20"),  base.minusDays(28), List.of("Shopping")));
        txns.add(bank(prefix + "sh4", checking, "Apple Store",          new BigDecimal("-399.00"), base.minusDays(45), List.of("Shopping", "Electronics")));
        txns.add(bank(prefix + "sh5", checking, "Amazon",               new BigDecimal("-78.50"),  base.minusDays(58), List.of("Shopping")));

        // ── Healthcare ─────────────────────────────────────────────────────────
        txns.add(bank(prefix + "h1",  checking, "CVS Pharmacy",         new BigDecimal("-38.72"),  base.minusDays(7),  List.of("Medical", "Pharmacies")));
        txns.add(bank(prefix + "h2",  checking, "Dr Smith Medical",     new BigDecimal("-85.00"),  base.minusDays(21), List.of("Medical", "Healthcare")));
        txns.add(bank(prefix + "h3",  checking, "Walgreens",            new BigDecimal("-22.45"),  base.minusDays(43), List.of("Medical", "Pharmacies")));

        // ── Entertainment ──────────────────────────────────────────────────────
        txns.add(bank(prefix + "e1",  checking, "AMC Theaters",         new BigDecimal("-42.50"),  base.minusDays(15), List.of("Entertainment")));
        txns.add(bank(prefix + "e2",  checking, "Ticketmaster",         new BigDecimal("-189.00"), base.minusDays(28), List.of("Entertainment", "Events")));

        // ── Income (Payroll) ───────────────────────────────────────────────────
        txns.add(bank(prefix + "i1",  checking, "Employer Payroll",     new BigDecimal("5400.00"), base.minusDays(1),  List.of("Payroll")));
        txns.add(bank(prefix + "i2",  checking, "Employer Payroll",     new BigDecimal("5400.00"), base.minusDays(15), List.of("Payroll")));
        txns.add(bank(prefix + "i3",  checking, "Employer Payroll",     new BigDecimal("5400.00"), base.minusDays(29), List.of("Payroll")));
        txns.add(bank(prefix + "i4",  checking, "Employer Payroll",     new BigDecimal("5400.00"), base.minusDays(43), List.of("Payroll")));
        txns.add(bank(prefix + "i5",  checking, "Employer Payroll",     new BigDecimal("5400.00"), base.minusDays(57), List.of("Payroll")));
        txns.add(bank(prefix + "i6",  checking, "Interest Income",      new BigDecimal("47.82"),   base.minusDays(3),  List.of("Income", "Interest")));
        txns.add(bank(prefix + "i7",  checking, "Interest Income",      new BigDecimal("47.82"),   base.minusDays(33), List.of("Income", "Interest")));

        return txns.stream()
                .filter(t -> !t.date().isBefore(startDate) && !t.date().isAfter(endDate))
                .toList();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private BankTransactionData bank(String id, String accountId, String merchant,
                                      BigDecimal amount, LocalDate date, List<String> categories) {
        return new BankTransactionData(accountId, id, merchant, merchant, amount, date, categories);
    }

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
