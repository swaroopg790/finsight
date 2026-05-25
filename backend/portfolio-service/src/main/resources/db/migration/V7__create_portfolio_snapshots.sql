-- Daily portfolio value snapshots — one row per (user, date).
-- Upserted by the 4-hour scheduler after each price enrichment pass.
-- Feeds the performance chart on the dashboard.
CREATE TABLE portfolio_snapshots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_date DATE        NOT NULL,
    total_value   NUMERIC(18, 4) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_portfolio_snapshots_user_date UNIQUE (user_id, snapshot_date)
);

CREATE INDEX idx_portfolio_snapshots_user_date
    ON portfolio_snapshots (user_id, snapshot_date DESC);
