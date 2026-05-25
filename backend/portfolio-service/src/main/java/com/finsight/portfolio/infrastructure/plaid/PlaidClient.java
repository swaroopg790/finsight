package com.finsight.portfolio.infrastructure.plaid;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
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
