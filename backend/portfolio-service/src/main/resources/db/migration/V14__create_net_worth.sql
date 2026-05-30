-- V14: Net Worth Tracker
-- Manual assets, manual liabilities, and daily net-worth snapshots

-- ── Manual assets (real estate, vehicles, cash, other) ────────────────────────
CREATE TABLE manual_assets (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    asset_type  VARCHAR(50)  NOT NULL,   -- REAL_ESTATE, VEHICLE, CASH, CRYPTO, OTHER
    value       NUMERIC(18,4) NOT NULL DEFAULT 0,
    notes       TEXT,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_manual_assets_user_id ON manual_assets(user_id);

-- ── Manual liabilities (mortgage, student loan, other debts) ──────────────────
CREATE TABLE manual_liabilities (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             VARCHAR(255) NOT NULL,
    liability_type   VARCHAR(50)  NOT NULL,  -- MORTGAGE, STUDENT_LOAN, AUTO_LOAN, PERSONAL_LOAN, OTHER
    balance          NUMERIC(18,4) NOT NULL DEFAULT 0,
    interest_rate    NUMERIC(5,4),           -- optional, e.g. 0.0650 = 6.5%
    notes            TEXT,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_manual_liabilities_user_id ON manual_liabilities(user_id);

-- ── Net worth snapshots (one per day per user) ────────────────────────────────
CREATE TABLE net_worth_snapshots (
    id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_date            DATE         NOT NULL,
    -- asset components
    investment_value         NUMERIC(18,4) NOT NULL DEFAULT 0,
    depository_value         NUMERIC(18,4) NOT NULL DEFAULT 0,
    manual_asset_value       NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_assets             NUMERIC(18,4) NOT NULL DEFAULT 0,
    -- liability components
    credit_card_balance      NUMERIC(18,4) NOT NULL DEFAULT 0,
    loan_balance             NUMERIC(18,4) NOT NULL DEFAULT 0,
    manual_liability_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_liabilities        NUMERIC(18,4) NOT NULL DEFAULT 0,
    -- headline number
    net_worth                NUMERIC(18,4) NOT NULL DEFAULT 0,
    created_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_net_worth_snapshots_user_date
    ON net_worth_snapshots(user_id, snapshot_date);
CREATE INDEX idx_net_worth_snapshots_user_id_date_desc
    ON net_worth_snapshots(user_id, snapshot_date DESC);
