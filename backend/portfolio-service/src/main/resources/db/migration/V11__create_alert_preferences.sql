-- User alert preferences (one row per user per alert type)
CREATE TABLE alert_preferences (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type           VARCHAR(50)  NOT NULL, -- PORTFOLIO_DROP, WEEKLY_SUMMARY
    enabled              BOOLEAN      NOT NULL DEFAULT true,
    threshold_pct        NUMERIC(5, 2),         -- for PORTFOLIO_DROP: trigger % (e.g. 3.00)
    notification_email   VARCHAR(255),           -- overrides account email if set
    last_triggered_at    TIMESTAMPTZ,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_alert_preferences_user_type UNIQUE (user_id, alert_type)
);
