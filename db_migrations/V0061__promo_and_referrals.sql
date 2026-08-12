-- Промокоды
CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.promo_codes (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'discount',
    discount_percent INT NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    free_days INT NOT NULL DEFAULT 0,
    plan_code TEXT NOT NULL DEFAULT '',
    max_activations INT NOT NULL DEFAULT 0,
    used_count INT NOT NULL DEFAULT 0,
    per_user_limit INT NOT NULL DEFAULT 1,
    starts_at BIGINT,
    expires_at BIGINT,
    active BOOLEAN NOT NULL DEFAULT true,
    note TEXT NOT NULL DEFAULT '',
    created_by BIGINT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);

-- Кто и когда активировал промокод
CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.promo_activations (
    id BIGSERIAL PRIMARY KEY,
    promo_id BIGINT NOT NULL,
    code TEXT NOT NULL,
    user_id BIGINT NOT NULL,
    granted_days INT NOT NULL DEFAULT 0,
    discount_applied NUMERIC(10,2) NOT NULL DEFAULT 0,
    ip_addr TEXT NOT NULL DEFAULT '',
    suspicious BOOLEAN NOT NULL DEFAULT false,
    suspicious_reason TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);

CREATE INDEX IF NOT EXISTS idx_promo_act_user
    ON t_p67547116_messenger_app_develo.promo_activations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promo_act_promo
    ON t_p67547116_messenger_app_develo.promo_activations(promo_id);

-- Реферальная программа
CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.referrals (
    id BIGSERIAL PRIMARY KEY,
    inviter_id BIGINT NOT NULL,
    invited_id BIGINT NOT NULL UNIQUE,
    reward_days INT NOT NULL DEFAULT 0,
    rewarded BOOLEAN NOT NULL DEFAULT false,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);

CREATE INDEX IF NOT EXISTS idx_referrals_inviter
    ON t_p67547116_messenger_app_develo.referrals(inviter_id);

ALTER TABLE t_p67547116_messenger_app_develo.users
    ADD COLUMN IF NOT EXISTS referral_code TEXT,
    ADD COLUMN IF NOT EXISTS referred_by BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ref_code
    ON t_p67547116_messenger_app_develo.users(referral_code)
    WHERE referral_code IS NOT NULL;

-- Настройки реферальной программы и подарков
INSERT INTO t_p67547116_messenger_app_develo.dev_settings (key, value)
VALUES
    ('referral_enabled', 'true'),
    ('referral_inviter_days', '7'),
    ('referral_invited_days', '7'),
    ('referral_min_actions', '1')
ON CONFLICT (key) DO NOTHING;
