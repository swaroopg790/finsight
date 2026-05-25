-- Enables upsert-by-account+ticker in PortfolioSyncScheduler
-- Each (account, ticker) pair is unique; sync updates in place rather than duplicating
ALTER TABLE positions
    ADD CONSTRAINT uq_positions_account_ticker UNIQUE (account_id, ticker);
