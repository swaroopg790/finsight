CREATE TABLE plaid_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token_encrypted  TEXT NOT NULL,
    plaid_item_id           VARCHAR(255) NOT NULL UNIQUE,
    institution_id          VARCHAR(100),
    institution_name        VARCHAR(255),
    status                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    last_synced_at          TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plaid_items_user_id ON plaid_items (user_id);
CREATE INDEX idx_plaid_items_status  ON plaid_items (status);
