-- Investment transactions synced from Plaid
CREATE TABLE transactions (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id           UUID         NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plaid_transaction_id VARCHAR(255) UNIQUE,
    ticker               VARCHAR(20),
    security_name        VARCHAR(255),
    transaction_type     VARCHAR(50)  NOT NULL, -- BUY, SELL, DIVIDEND, FEE, TRANSFER, OTHER
    quantity             NUMERIC(18, 6),
    price                NUMERIC(18, 4),
    amount               NUMERIC(18, 4) NOT NULL, -- negative = cash out (buy), positive = cash in (sell/dividend)
    transaction_date     DATE         NOT NULL,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_account_id   ON transactions(account_id);
CREATE INDEX idx_transactions_date         ON transactions(transaction_date DESC);
