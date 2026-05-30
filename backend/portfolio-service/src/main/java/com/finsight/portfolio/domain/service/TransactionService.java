package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.dto.response.TransactionResponse;
import com.finsight.portfolio.domain.model.Account;
import com.finsight.portfolio.domain.model.PlaidItem;
import com.finsight.portfolio.domain.model.SpendingCategory;
import com.finsight.portfolio.domain.model.Transaction;
import com.finsight.portfolio.domain.repository.AccountRepository;
import com.finsight.portfolio.domain.repository.TransactionRepository;
import com.finsight.portfolio.infrastructure.plaid.PlaidGateway;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Manages both investment and bank transaction history.
 *
 * Sync is idempotent: Plaid transaction IDs are used as natural keys, so
 * re-running sync for a window that already has data is safe — duplicates
 * are simply skipped.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository              transactionRepository;
    private final AccountRepository                  accountRepository;
    private final TransactionCategorizationService   categorizationService;

    // ── Sync (called from scheduler / PlaidService) ───────────────────────────

    /**
     * Fetches investment transactions for the last 90 days for a single PlaidItem
     * and persists any new ones.
     *
     * @param item        the PlaidItem to sync
     * @param accessToken decrypted Plaid access token (never stored here)
     * @param gateway     PlaidGateway instance (injected at call site to avoid circular dep)
     */
    @Transactional
    public void syncTransactions(PlaidItem item, String accessToken, PlaidGateway gateway) {
        LocalDate endDate   = LocalDate.now();
        LocalDate startDate = endDate.minusDays(90);

        List<PlaidGateway.TransactionData> txns;
        try {
            txns = gateway.fetchInvestmentTransactions(accessToken, startDate, endDate);
        } catch (Exception e) {
            log.warn("Transaction fetch skipped for item={} (may not support investment transactions): {}",
                    item.getId(), e.getMessage());
            return;
        }

        log.debug("Fetched {} transactions for item={}", txns.size(), item.getId());
        int saved = 0;

        for (PlaidGateway.TransactionData data : txns) {
            // Idempotent — skip already-persisted transactions
            if (transactionRepository.existsByPlaidTransactionId(data.plaidTransactionId())) {
                continue;
            }

            Account account = accountRepository.findByPlaidAccountId(data.plaidAccountId())
                    .orElse(null);
            if (account == null) {
                log.warn("Skipping txn {} — account {} not found in DB",
                        data.plaidTransactionId(), data.plaidAccountId());
                continue;
            }

            transactionRepository.save(Transaction.builder()
                    .account(account)
                    .plaidTransactionId(data.plaidTransactionId())
                    .ticker(data.ticker())
                    .securityName(data.securityName())
                    .transactionType(data.type().toUpperCase())
                    .quantity(data.quantity())
                    .price(data.price())
                    .amount(data.amount())
                    .transactionDate(data.date())
                    .build());
            saved++;
        }

        log.info("Transaction sync for item={}: {}/{} new transactions persisted",
                item.getId(), saved, txns.size());
    }

    // ── Bank transaction sync ─────────────────────────────────────────────────

    /**
     * Fetches bank (checking/savings) transactions for the last 90 days and persists
     * any new ones with spending categories and merchant names.
     *
     * <p>Only processes transactions for depository accounts (checking/savings).
     * Investment accounts are handled by {@link #syncTransactions}.
     */
    @Transactional
    public void syncBankTransactions(PlaidItem item, String accessToken, PlaidGateway gateway) {
        LocalDate endDate   = LocalDate.now();
        LocalDate startDate = endDate.minusDays(90);

        List<PlaidGateway.BankTransactionData> txns;
        try {
            txns = gateway.fetchBankTransactions(accessToken, startDate, endDate);
        } catch (Exception e) {
            log.warn("Bank transaction fetch skipped for item={} (TRANSACTIONS product may not be enabled): {}",
                    item.getId(), e.getMessage());
            return;
        }

        log.debug("Fetched {} bank transactions for item={}", txns.size(), item.getId());
        int saved = 0;

        for (PlaidGateway.BankTransactionData data : txns) {
            // Idempotent — skip already-persisted transactions
            if (transactionRepository.existsByPlaidTransactionId(data.plaidTransactionId())) {
                continue;
            }

            Account account = accountRepository.findByPlaidAccountId(data.plaidAccountId())
                    .orElse(null);
            if (account == null) {
                log.warn("Skipping bank txn {} — account {} not found",
                        data.plaidTransactionId(), data.plaidAccountId());
                continue;
            }

            // Only process depository accounts here
            if (!"depository".equalsIgnoreCase(account.getType())) {
                continue;
            }

            // Categorise
            SpendingCategory category = categorizationService.classify(
                    data.merchantName(), data.name(), data.plaidCategories());

            // Determine transaction type from amount sign
            // Normalised: negative = expense (DEBIT), positive = income (CREDIT)
            String txnType = data.amount().compareTo(BigDecimal.ZERO) >= 0 ? "CREDIT" : "DEBIT";

            transactionRepository.save(Transaction.builder()
                    .account(account)
                    .plaidTransactionId(data.plaidTransactionId())
                    .merchantName(data.merchantName())
                    .securityName(data.name())    // raw name as fallback description
                    .transactionType(txnType)
                    .amount(data.amount())
                    .transactionDate(data.date())
                    .source("BANK")
                    .category(category.name())
                    .recurring(false)              // recurring flag set by CashFlowService later
                    .build());
            saved++;
        }

        log.info("Bank transaction sync for item={}: {}/{} new transactions persisted",
                item.getId(), saved, txns.size());
    }

    // ── Query ─────────────────────────────────────────────────────────────────

    /**
     * Returns paginated transaction history for a user, newest-first.
     * Page size is capped at 100 regardless of the requested value.
     */
    @Transactional(readOnly = true)
    public Page<TransactionResponse> getTransactions(UUID userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        return transactionRepository.findByUserIdOrderByDateDesc(userId, pageable)
                .map(this::toResponse);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private TransactionResponse toResponse(Transaction t) {
        return new TransactionResponse(
                t.getId(),
                t.getTicker(),
                t.getMerchantName() != null ? t.getMerchantName() : t.getSecurityName(),
                t.getTransactionType(),
                t.getQuantity(),
                t.getPrice(),
                t.getAmount(),
                t.getTransactionDate(),
                t.getAccount().getName(),
                t.getAccount().getPlaidItem().getInstitutionName(),
                t.getSource(),
                t.getCategory(),
                t.getMerchantName()
        );
    }
}
