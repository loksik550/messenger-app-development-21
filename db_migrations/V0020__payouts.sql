CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.payout_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    method VARCHAR(16) NOT NULL,
    details TEXT NOT NULL,
    holder TEXT NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    admin_note TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    decided_at BIGINT,
    decided_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_payout_requests_user ON t_p67547116_messenger_app_develo.payout_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON t_p67547116_messenger_app_develo.payout_requests (status, created_at DESC);

INSERT INTO t_p67547116_messenger_app_develo.dev_settings (key, value)
SELECT 'payout_min', '500'
WHERE NOT EXISTS (SELECT 1 FROM t_p67547116_messenger_app_develo.dev_settings WHERE key = 'payout_min');