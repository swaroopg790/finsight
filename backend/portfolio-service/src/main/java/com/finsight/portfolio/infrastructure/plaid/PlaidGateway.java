package com.finsight.portfolio.infrastructure.plaid;

import java.math.BigDecimal;
import java.util.List;

/**
 * Abstraction over the Plaid API.
 *
 * Two implementations exist:
 *   - SandboxPlaidGateway  — real Plaid calls (activated when finsight.plaid.mode=sandbox)
 *   - MockPlaidGateway     — deterministic fake data (activated when finsight.plaid.mode=mock)
 *
 * Switch modes via the PLAID_MODE environment variable.
 */
public interface PlaidGateway {

    /** Creates a Plaid Link token for the given user. Returned to the frontend to open Plaid Link. */
    String createLinkToken(String userId);

    /** Exchanges the short-lived public_token (from Plaid Link) for a permanent access_token. */
    ExchangeResult exchangePublicToken(String publicToken);

    /** Fetches all accounts for an item using its (decrypted) access token. */
    List<AccountData> fetchAccounts(String accessToken);

    /**
     * Fetches all investment holdings for an item.
     * Ticker and name are resolved from the corresponding Security object.
     */
    List<HoldingData> fetchHoldings(String accessToken);

    /**
     * Fetches investment transactions for an item within a date range.
     * Returns at most 500 transactions per call (paging not implemented for MVP).
     */
    List<TransactionData> fetchInvestmentTransactions(String accessToken,
                                                       java.time.LocalDate startDate,
                                                       java.time.LocalDate endDate);

    /**
     * Fetches bank/spending transactions (checking, savings) for an item.
     * Requires the item to have been connected with the TRANSACTIONS Plaid product.
     * Returns at most 500 transactions per call.
     */
    List<BankTransactionData> fetchBankTransactions(String accessToken,
                                                     java.time.LocalDate startDate,
                                                     java.time.LocalDate endDate);

    // ── Value objects ────────────────────────────────────────────────────────

    record ExchangeResult(String accessToken, String itemId) {}

    record AccountData(
            String plaidAccountId,
            String name,
            String type,
            String subtype,
            BigDecimal balanceCurrent,
            BigDecimal balanceAvailable,
            String currency
    ) {}

    record HoldingData(
            String plaidAccountId,
            String ticker,
            String name,
            BigDecimal quantity,
            BigDecimal costBasis,       // total cost basis (not per-share)
            BigDecimal currentPrice
    ) {}

    /**
     * A single bank/spending transaction from Plaid's /transactions/get endpoint.
     *
     * <p>Amount convention (normalised — opposite of Plaid's raw sign):<br>
     * &nbsp;&bull; Negative = debit / expense (money leaving the account)<br>
     * &nbsp;&bull; Positive = credit / income (money entering the account)
     */
    record BankTransactionData(
            String              plaidAccountId,
            String              plaidTransactionId,
            String              merchantName,       // cleaned merchant/payee name
            String              name,               // raw transaction name (fallback)
            java.math.BigDecimal amount,             // normalised: negative=expense, positive=income
            java.time.LocalDate date,
            java.util.List<String> plaidCategories  // e.g. ["Food and Drink", "Restaurants"]
    ) {}

    record TransactionData(
            String     plaidAccountId,
            String     plaidTransactionId,
            String     ticker,
            String     securityName,
            String     type,            // buy, sell, dividend, fee, transfer, other
            BigDecimal quantity,
            BigDecimal price,
            BigDecimal amount,          // negative = cash out (buy)
            java.time.LocalDate date
    ) {}
}
