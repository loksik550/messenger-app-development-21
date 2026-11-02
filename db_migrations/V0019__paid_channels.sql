ALTER TABLE t_p67547116_messenger_app_develo.groups ADD COLUMN IF NOT EXISTS sub_price NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.channel_subscriptions (
    group_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    paid_until BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.channel_payments (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    owner_id BIGINT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    fee NUMERIC(12,2) NOT NULL,
    author_amount NUMERIC(12,2) NOT NULL,
    created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_channel_payments_group ON t_p67547116_messenger_app_develo.channel_payments (group_id, created_at);

INSERT INTO t_p67547116_messenger_app_develo.dev_settings (key, value)
SELECT 'paid_channel_fee', '15'
WHERE NOT EXISTS (SELECT 1 FROM t_p67547116_messenger_app_develo.dev_settings WHERE key = 'paid_channel_fee');