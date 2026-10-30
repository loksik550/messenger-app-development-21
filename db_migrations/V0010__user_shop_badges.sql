CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.user_shop_badges (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    badge_code TEXT NOT NULL,
    serial INTEGER NOT NULL,
    method TEXT NOT NULL DEFAULT 'lightning',
    price_lightning INTEGER NOT NULL DEFAULT 0,
    shown BOOLEAN NOT NULL DEFAULT TRUE,
    granted_by BIGINT NULL,
    created_at BIGINT NOT NULL,
    revoked_at BIGINT NULL,
    UNIQUE (badge_code, serial)
);
CREATE INDEX IF NOT EXISTS idx_user_shop_badges_user ON t_p67547116_messenger_app_develo.user_shop_badges (user_id);