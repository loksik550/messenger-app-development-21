CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.broadcasts (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    audience VARCHAR(30) NOT NULL DEFAULT 'all',
    sent_count INTEGER NOT NULL DEFAULT 0,
    admin_id BIGINT,
    admin_email TEXT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.moderation_rules (
    id BIGSERIAL PRIMARY KEY,
    word TEXT NOT NULL UNIQUE,
    action VARCHAR(20) NOT NULL DEFAULT 'block',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.moderation_hits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    word TEXT NOT NULL,
    action VARCHAR(20) NOT NULL,
    snippet TEXT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);

CREATE INDEX IF NOT EXISTS idx_mod_hits_created
    ON t_p67547116_messenger_app_develo.moderation_hits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created
    ON t_p67547116_messenger_app_develo.broadcasts(created_at DESC);

INSERT INTO t_p67547116_messenger_app_develo.dev_settings (key, value)
VALUES
    ('maintenance_enabled', '0'),
    ('maintenance_title', 'Технические работы'),
    ('maintenance_text', 'Мы улучшаем Nova и скоро вернёмся. Спасибо за терпение!'),
    ('antispam_enabled', '1'),
    ('antispam_max_per_min', '30'),
    ('moderation_enabled', '1')
ON CONFLICT (key) DO NOTHING;
