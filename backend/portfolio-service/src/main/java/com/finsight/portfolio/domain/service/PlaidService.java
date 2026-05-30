package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.exception.ResourceNotFoundException;
import com.finsight.portfolio.domain.model.Account;
import com.finsight.portfolio.domain.model.PlaidItem;
import com.finsight.portfolio.domain.model.Position;
import com.finsight.portfolio.domain.repository.AccountRepository;
import com.finsight.portfolio.domain.repository.PlaidItemRepository;
import com.finsight.portfolio.domain.repository.PositionRepository;
import com.finsight.portfolio.domain.repository.UserRepository;
import com.finsight.portfolio.infrastructure.crypto.EncryptionService;
import com.finsight.portfolio.infrastructure.market.PriceEnrichmentService;
import com.finsight.portfolio.infrastructure.plaid.PlaidGateway;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Orchestrates all Plaid-related business logic.
 *
 * Transaction design:
 *   - savePlaidItem()    → own REQUIRES_NEW transaction; always commits independently
 *   - connectBrokerage() → NOT @Transactional; calls savePlaidItem then best-effort sync
 *   - syncItem()         → own transaction; catches per-step errors so partial failures
 *                          don't roll back the whole sync
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlaidService {

    private final PlaidGateway           plaidGateway;
    private final EncryptionService      encryptionService;
    private final PlaidItemRepository    plaidItemRepository;
    private final AccountRepository      accountRepository;
    private final PositionRepository     positionRepository;
    private final UserRepository         userRepository;
    private final PriceEnrichmentService priceEnrichmentService;
    private final TransactionService     transactionService;

    // ── Public API ───────────────────────────────────────────────────────────

    public String createLinkToken(String userId) {
        return plaidGateway.createLinkToken(userId);
    }

    /**
     * Called after Plaid Link completes in the browser.
     * NOT @Transactional — we commit the PlaidItem save first, then sync best-effort.
     * This ensures the brokerage always appears as "connected" even if the first sync
     * fails (e.g. account doesn't support investments, Plaid rate limit, etc.).
     */
    public void connectBrokerage(UUID userId, String publicToken,
                                  String institutionId, String institutionName) {
        log.info("Connecting brokerage for user={} institution={}", userId, institutionName);

        // 1. Exchange short-lived public token → permanent access token (Plaid API call)
        PlaidGateway.ExchangeResult exchange = plaidGateway.exchangePublicToken(publicToken);

        // 2. Encrypt before touching DB — plaintext never persisted
        String encryptedToken = encryptionService.encrypt(exchange.accessToken());

        // 3. Persist PlaidItem in its own committed transaction
        PlaidItem item = savePlaidItem(userId, encryptedToken, exchange.itemId(),
                                       institutionId, institutionName);
        log.info("PlaidItem saved id={}", item.getId());

        // 4. Best-effort initial sync — failure here does NOT undo the connection
        try {
            syncItemInternal(item, exchange.accessToken());
        } catch (Exception e) {
            log.warn("Initial sync incomplete for item={} — will retry on next schedule. Reason: {}",
                    item.getId(), e.getMessage());
        }

        // 5. Kick off an immediate async Polygon price refresh so the dashboard shows
        //    real market values straight away instead of waiting for the 4-hour scheduler.
        //    Runs on a background thread — connectBrokerage() returns immediately.
        priceEnrichmentService.enrichAllPricesAsync();
        log.info("Polygon quick price refresh queued for item={}", item.getId());
    }

    /**
     * Removes a connected brokerage item for the given user.
     * DB cascades handle deletion of associated accounts and positions automatically.
     *
     * Security: itemId must belong to the requesting userId — throws 404 if not found
     * or if the item belongs to a different user (prevents IDOR).
     */
    @Transactional
    public void disconnectItem(UUID userId, UUID itemId) {
        PlaidItem item = plaidItemRepository.findByIdAndUserId(itemId, userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Brokerage connection not found: " + itemId));
        log.info("Disconnecting PlaidItem id={} institution={} for user={}",
                item.getId(), item.getInstitutionName(), userId);
        plaidItemRepository.delete(item);
        log.info("PlaidItem id={} deleted — accounts and positions cascade-removed", itemId);
    }

    /**
     * Forces a full re-sync of all active PlaidItems for a given user.
     * Called from the manual /portfolio/sync endpoint — useful after initial
     * connection to populate transactions without waiting for the scheduler.
     */
    public void syncAllItemsForUser(UUID userId) {
        List<PlaidItem> items = plaidItemRepository
                .findByUserIdAndStatus(userId, PlaidItem.PlaidItemStatus.ACTIVE);

        log.info("Manual sync triggered for user={} ({} active items)", userId, items.size());
        for (PlaidItem item : items) {
            try {
                syncItem(item);
            } catch (Exception e) {
                log.warn("Manual sync failed for item={}: {}", item.getId(), e.getMessage());
            }
        }
        log.info("Manual sync complete for user={}", userId);
    }

    /**
     * Syncs a single PlaidItem — decrypts token, refreshes accounts + holdings + transactions.
     * Called from the scheduler for periodic background updates.
     */
    @Transactional
    public void syncItem(PlaidItem item) {
        String accessToken = encryptionService.decrypt(item.getAccessTokenEncrypted());
        syncItemInternal(item, accessToken);
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    /** Persists a new PlaidItem in a dedicated transaction that commits immediately. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PlaidItem savePlaidItem(UUID userId, String encryptedToken, String plaidItemId,
                                    String institutionId, String institutionName) {
        PlaidItem item = PlaidItem.builder()
                .user(userRepository.getReferenceById(userId))
                .accessTokenEncrypted(encryptedToken)
                .plaidItemId(plaidItemId)
                .institutionId(institutionId)
                .institutionName(institutionName)
                .build();
        return plaidItemRepository.save(item);
    }

    /**
     * Core sync logic. Each step is wrapped in its own try-catch so that:
     *   - a failing accounts sync doesn't block a holdings sync
     *   - a missing investments product doesn't roll back successfully synced accounts
     *   - lastSyncedAt is always stamped regardless of partial failures
     */
    @Transactional
    public void syncItemInternal(PlaidItem item, String accessToken) {
        log.info("Syncing PlaidItem id={} institution={}", item.getId(), item.getInstitutionName());

        try {
            syncAccounts(item, accessToken);
        } catch (Exception e) {
            log.error("Account sync failed for item={}: {}", item.getId(), e.getMessage(), e);
        }

        try {
            syncHoldings(item, accessToken);
        } catch (Exception e) {
            // Plaid returns PRODUCTS_NOT_SUPPORTED when the connected account has no
            // investment holdings — this is expected for checking/savings-only items.
            log.warn("Holdings sync skipped for item={} (account may not support investments): {}",
                    item.getId(), e.getMessage());
        }

        // ── Investment transaction sync ────────────────────────────────────────
        // Must run AFTER syncAccounts so account rows exist for FK lookups.
        // Idempotent: skips already-stored plaid_transaction_id values.
        try {
            transactionService.syncTransactions(item, accessToken, plaidGateway);
        } catch (Exception e) {
            log.warn("Transaction sync skipped for item={}: {}", item.getId(), e.getMessage());
        }

        // ── Bank transaction sync (checking / savings) ─────────────────────────
        // Requires TRANSACTIONS Plaid product. Gracefully skipped if not available.
        try {
            transactionService.syncBankTransactions(item, accessToken, plaidGateway);
        } catch (Exception e) {
            log.warn("Bank transaction sync skipped for item={}: {}", item.getId(), e.getMessage());
        }

        item.setLastSyncedAt(Instant.now());
        plaidItemRepository.save(item);
        log.info("Sync complete for item={}", item.getId());
    }

    private void syncAccounts(PlaidItem item, String accessToken) {
        List<PlaidGateway.AccountData> accounts = plaidGateway.fetchAccounts(accessToken);
        log.debug("Upserting {} accounts for item={}", accounts.size(), item.getId());

        for (PlaidGateway.AccountData data : accounts) {
            Account account = accountRepository.findByPlaidAccountId(data.plaidAccountId())
                    .orElseGet(() -> Account.builder()
                            .plaidItem(item)
                            .plaidAccountId(data.plaidAccountId())
                            .build());

            account.setName(data.name());
            account.setType(data.type());
            account.setSubtype(data.subtype());
            account.setBalanceCurrent(data.balanceCurrent());
            account.setBalanceAvailable(data.balanceAvailable());
            account.setCurrency(Objects.requireNonNullElse(data.currency(), "USD"));
            accountRepository.save(account);
        }
    }

    private void syncHoldings(PlaidItem item, String accessToken) {
        List<PlaidGateway.HoldingData> holdings = plaidGateway.fetchHoldings(accessToken);
        log.debug("Upserting {} holdings for item={}", holdings.size(), item.getId());

        for (PlaidGateway.HoldingData data : holdings) {
            Account account = accountRepository.findByPlaidAccountId(data.plaidAccountId())
                    .orElse(null);
            if (account == null) {
                log.warn("Skipping holding {} — account {} not found", data.ticker(), data.plaidAccountId());
                continue;
            }

            Position position = positionRepository
                    .findByAccountIdAndTicker(account.getId(), data.ticker())
                    .orElseGet(() -> Position.builder()
                            .account(account)
                            .ticker(data.ticker())
                            .build());

            position.setName(data.name());
            position.setQuantity(data.quantity());
            position.setCostBasis(data.costBasis());
            position.setCurrentPrice(data.currentPrice());
            position.setCurrentValue(computeValue(data.quantity(), data.currentPrice()));
            positionRepository.save(position);
        }
    }

    private BigDecimal computeValue(BigDecimal quantity, BigDecimal price) {
        if (quantity == null || price == null) return null;
        return quantity.multiply(price).setScale(4, RoundingMode.HALF_UP);
    }
}
