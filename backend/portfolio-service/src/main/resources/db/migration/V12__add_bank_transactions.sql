-- Budgeting & Cash Flow: extend transactions for bank/spending data
-- and add per-user budget targets

-- ── Extend transactions table ──────────────────────────────────────────────────
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS source        VARCHAR(20)   NOT NULL DEFAULT 'INVESTMENT',
    ADD COLUMN IF NOT EXISTS category      VARCHAR(50),
    ADD COLUMN IF NOT EXISTS merchant_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS is_recurring  BOOLEAN       NOT NULL DEFAULT FALSE;

-- Back-fill existing investment rows
UPDATE transactions SET source = 'INVESTMENT' WHERE source IS NULL OR source = '';

CREATE INDEX IF NOT EXISTS idx_transactions_source   ON transactions(source);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_date_cat ON transactions(transaction_date DESC, category);

-- ── Budget targets (per-user, per-category monthly spending goal) ──────────────
CREATE TABLE IF NOT EXISTS budget_targets (
    id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category       VARCHAR(50)     NOT NULL,
    monthly_budget NUMERIC(18, 4)  NOT NULL DEFAULT 0,
    UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_budget_targets_user ON budget_targets(user_id);
