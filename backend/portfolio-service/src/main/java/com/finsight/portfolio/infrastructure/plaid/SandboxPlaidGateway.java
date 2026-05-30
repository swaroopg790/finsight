package com.finsight.portfolio.infrastructure.plaid;

import com.plaid.client.model.*;
import com.plaid.client.request.PlaidApi;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import retrofit2.Response;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Real Plaid API gateway — active when PLAID_MODE=sandbox (or production).
 *
 * All calls are synchronous (retrofit .execute()).
 * Error responses throw IllegalStateException with the Plaid error code for upstream handling.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "finsight.plaid.mode", havingValue = "sandbox")
public class SandboxPlaidGateway implements PlaidGateway {

    private final PlaidApi plaidApi;

    @Override
    public String createLinkToken(String userId) {
        log.debug("Creating Plaid link token for user {}", userId);
        try {
            LinkTokenCreateRequest request = new LinkTokenCreateRequest()
                    .user(new LinkTokenCreateRequestUser().clientUserId(userId))
                    .clientName("FinSight")
                    .products(List.of(Products.INVESTMENTS, Products.TRANSACTIONS))
                    .countryCodes(List.of(CountryCode.US))
                    .language("en");

            Response<LinkTokenCreateResponse> response = plaidApi.linkTokenCreate(request).execute();
            return requireBody(response, "linkTokenCreate").getLinkToken();
        } catch (IOException e) {
            throw new IllegalStateException("Plaid linkTokenCreate failed", e);
        }
    }

    @Override
    public ExchangeResult exchangePublicToken(String publicToken) {
        log.debug("Exchanging Plaid public token");
        try {
            ItemPublicTokenExchangeRequest request = new ItemPublicTokenExchangeRequest()
                    .publicToken(publicToken);

            Response<ItemPublicTokenExchangeResponse> response =
                    plaidApi.itemPublicTokenExchange(request).execute();

            ItemPublicTokenExchangeResponse body = requireBody(response, "itemPublicTokenExchange");
            return new ExchangeResult(body.getAccessToken(), body.getItemId());
        } catch (IOException e) {
            throw new IllegalStateException("Plaid itemPublicTokenExchange failed", e);
        }
    }

    @Override
    public List<AccountData> fetchAccounts(String accessToken) {
        log.debug("Fetching Plaid accounts");
        try {
            AccountsGetRequest request = new AccountsGetRequest().accessToken(accessToken);
            Response<AccountsGetResponse> response = plaidApi.accountsGet(request).execute();
            List<AccountBase> accounts = requireBody(response, "accountsGet").getAccounts();

            return accounts.stream()
                    .map(a -> new AccountData(
                            a.getAccountId(),
                            a.getName(),
                            a.getType() != null ? a.getType().getValue() : "unknown",
                            a.getSubtype() != null ? a.getSubtype().getValue() : null,
                            toBigDecimal(a.getBalances().getCurrent()),
                            toBigDecimal(a.getBalances().getAvailable()),
                            Objects.requireNonNullElse(a.getBalances().getIsoCurrencyCode(), "USD")
                    ))
                    .toList();
        } catch (IOException e) {
            throw new IllegalStateException("Plaid accountsGet failed", e);
        }
    }

    @Override
    public List<HoldingData> fetchHoldings(String accessToken) {
        log.debug("Fetching Plaid investment holdings");
        try {
            InvestmentsHoldingsGetRequest request =
                    new InvestmentsHoldingsGetRequest().accessToken(accessToken);
            Response<InvestmentsHoldingsGetResponse> response =
                    plaidApi.investmentsHoldingsGet(request).execute();

            InvestmentsHoldingsGetResponse body = requireBody(response, "investmentsHoldingsGet");

            // Build a lookup map: securityId → Security
            Map<String, Security> securityMap = body.getSecurities().stream()
                    .collect(Collectors.toMap(Security::getSecurityId, Function.identity()));

            return body.getHoldings().stream()
                    .map(h -> {
                        Security sec = securityMap.get(h.getSecurityId());
                        if (sec == null) {
                            log.warn("Security not found for holding securityId={}", h.getSecurityId());
                            return null;
                        }
                        String ticker = sec.getTickerSymbol() != null
                                ? sec.getTickerSymbol()
                                : sec.getName(); // mutual funds often have no ticker
                        if (ticker == null || ticker.isBlank()) return null;

                        return new HoldingData(
                                h.getAccountId(),
                                ticker.toUpperCase(),
                                sec.getName(),
                                toBigDecimal(h.getQuantity()),
                                toBigDecimal(h.getCostBasis()),       // total cost basis
                                toBigDecimal(sec.getClosePrice())     // latest close price
                        );
                    })
                    .filter(Objects::nonNull)
                    .toList();
        } catch (IOException e) {
            throw new IllegalStateException("Plaid investmentsHoldingsGet failed", e);
        }
    }

    @Override
    public List<TransactionData> fetchInvestmentTransactions(String accessToken,
                                                              LocalDate startDate,
                                                              LocalDate endDate) {
        log.debug("Fetching Plaid investment transactions {} → {}", startDate, endDate);
        try {
            InvestmentsTransactionsGetRequest request = new InvestmentsTransactionsGetRequest()
                    .accessToken(accessToken)
                    .startDate(startDate)
                    .endDate(endDate);

            Response<InvestmentsTransactionsGetResponse> response =
                    plaidApi.investmentsTransactionsGet(request).execute();

            InvestmentsTransactionsGetResponse body =
                    requireBody(response, "investmentsTransactionsGet");

            Map<String, Security> securityMap = body.getSecurities().stream()
                    .collect(Collectors.toMap(Security::getSecurityId, Function.identity()));

            return body.getInvestmentTransactions().stream()
                    .map(t -> {
                        Security sec = t.getSecurityId() != null
                                ? securityMap.get(t.getSecurityId()) : null;
                        String ticker = sec != null && sec.getTickerSymbol() != null
                                ? sec.getTickerSymbol().toUpperCase() : null;
                        String name   = sec != null ? sec.getName() : t.getName();

                        return new TransactionData(
                                t.getAccountId(),
                                t.getInvestmentTransactionId(),
                                ticker,
                                name,
                                t.getType() != null ? t.getType().getValue() : "other",
                                toBigDecimal(t.getQuantity()),
                                toBigDecimal(t.getPrice()),
                                toBigDecimal(t.getAmount()),
                                t.getDate()
                        );
                    })
                    .toList();

        } catch (IOException e) {
            throw new IllegalStateException("Plaid investmentsTransactionsGet failed", e);
        }
    }

    @Override
    public List<BankTransactionData> fetchBankTransactions(String accessToken,
                                                            LocalDate startDate,
                                                            LocalDate endDate) {
        log.debug("Fetching Plaid bank transactions {} → {}", startDate, endDate);
        try {
            com.plaid.client.model.TransactionsGetRequest request =
                    new com.plaid.client.model.TransactionsGetRequest()
                            .accessToken(accessToken)
                            .startDate(startDate)
                            .endDate(endDate);

            Response<com.plaid.client.model.TransactionsGetResponse> response =
                    plaidApi.transactionsGet(request).execute();

            com.plaid.client.model.TransactionsGetResponse body =
                    requireBody(response, "transactionsGet");

            return body.getTransactions().stream()
                    .map(t -> {
                        // Plaid sign: positive = money out (debit); negative = money in (credit)
                        // We normalise: negative = expense, positive = income
                        BigDecimal amount = t.getAmount() != null
                                ? BigDecimal.valueOf(t.getAmount()).negate()
                                : BigDecimal.ZERO;

                        String merchant = t.getMerchantName() != null
                                ? t.getMerchantName()
                                : t.getName();

                        List<String> cats = t.getCategory() != null
                                ? t.getCategory()
                                : List.of();

                        return new BankTransactionData(
                                t.getAccountId(),
                                t.getTransactionId(),
                                merchant,
                                t.getName(),
                                amount,
                                t.getDate(),
                                cats
                        );
                    })
                    .toList();

        } catch (IOException e) {
            throw new IllegalStateException("Plaid transactionsGet failed", e);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private <T> T requireBody(Response<T> response, String operation) throws IOException {
        if (!response.isSuccessful()) {
            String errorBody = response.errorBody() != null ? response.errorBody().string() : "no body";
            throw new IllegalStateException(
                    "Plaid " + operation + " returned HTTP " + response.code() + ": " + errorBody);
        }
        T body = response.body();
        if (body == null) throw new IllegalStateException("Plaid " + operation + " returned null body");
        return body;
    }

    private BigDecimal toBigDecimal(Double value) {
        return value != null ? BigDecimal.valueOf(value) : null;
    }
}
