-- Daily closing values for benchmark indices (SPY = S&P 500, QQQ = Nasdaq-100)
CREATE TABLE benchmark_snapshots (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker         VARCHAR(20)  NOT NULL,  -- 'SPY' or 'QQQ'
    snapshot_date  DATE         NOT NULL,
    close_price    NUMERIC(18, 4) NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_benchmark_ticker_date UNIQUE (ticker, snapshot_date)
);

CREATE INDEX idx_benchmark_ticker_date ON benchmark_snapshots(ticker, snapshot_date DESC);
