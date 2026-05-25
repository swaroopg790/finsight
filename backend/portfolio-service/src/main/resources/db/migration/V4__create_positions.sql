CREATE TABLE positions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    ticker          VARCHAR(20) NOT NULL,
    name            VARCHAR(255),
    quantity        NUMERIC(18, 8) NOT NULL,
    cost_basis      NUMERIC(18, 4),
    current_price   NUMERIC(18, 4),
    current_value   NUMERIC(18, 4),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_positions_account_id ON positions (account_id);
CREATE INDEX idx_positions_ticker     ON positions (ticker);
