-- V13: Financial goals + projection cache
-- Goal-based planning feature

CREATE TABLE financial_goals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    goal_type           VARCHAR(50)  NOT NULL,           -- RETIREMENT, HOME_PURCHASE, etc.
    target_amount       NUMERIC(18,4) NOT NULL,
    target_date         DATE NOT NULL,
    current_value       NUMERIC(18,4) NOT NULL DEFAULT 0,
    monthly_contribution NUMERIC(18,4) NOT NULL DEFAULT 0,
    expected_return_pct NUMERIC(6,4)  NOT NULL DEFAULT 0.07, -- e.g. 0.07 = 7%
    volatility_pct      NUMERIC(6,4)  NOT NULL DEFAULT 0.15, -- e.g. 0.15 = 15%
    notes               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_goals_user_id ON financial_goals(user_id);
CREATE INDEX idx_financial_goals_goal_type ON financial_goals(goal_type);

-- Cache Monte Carlo results so we don't re-run 5000 paths on every page load
CREATE TABLE goal_projections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id             UUID NOT NULL REFERENCES financial_goals(id) ON DELETE CASCADE,
    success_probability NUMERIC(5,4)  NOT NULL,  -- e.g. 0.7800 = 78%
    p10_final           NUMERIC(18,4) NOT NULL,
    p25_final           NUMERIC(18,4) NOT NULL,
    p50_final           NUMERIC(18,4) NOT NULL,
    p75_final           NUMERIC(18,4) NOT NULL,
    p90_final           NUMERIC(18,4) NOT NULL,
    yearly_bands        TEXT NOT NULL,            -- JSON: [{year,p10,p25,p50,p75,p90}]
    simulation_paths    INTEGER NOT NULL DEFAULT 5000,
    computed_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_goal_projections_goal_id ON goal_projections(goal_id);
