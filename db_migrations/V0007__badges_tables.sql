CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.badges (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    rarity TEXT NOT NULL DEFAULT 'common',
    price_lightning INTEGER NULL,
    supply INTEGER NULL,
    issued INTEGER NOT NULL DEFAULT 0,
    on_sale BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.user_badges (
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

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.name_effects (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_lightning INTEGER NOT NULL,
    duration_days INTEGER NULL,
    on_sale BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.user_name_effects (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    effect_code TEXT NOT NULL,
    expires_at BIGINT NULL,
    created_at BIGINT NOT NULL,
    UNIQUE (user_id, effect_code)
);