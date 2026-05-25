CREATE TABLE accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plaid_item_id       UUID NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
    plaid_account_id    VARCHAR(255) NOT NULL UNIQUE,
    name                VARCHAR(255) NOT NULL,
    type                VARCHAR(50) NOT NULL,
    subtype             VARCHAR(50),
    balance_current     NUMERIC(18, 4),
    balance_available   NUMERIC(18, 4),
    currency            CHAR(3) NOT NULL DEFAULT 'USD',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_plaid_item_id ON accounts (plaid_item_id);
