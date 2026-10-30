ALTER TABLE t_p67547116_messenger_app_develo.users ADD COLUMN IF NOT EXISTS avatar_video_url TEXT;

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.nova_id_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    nova_id TEXT NOT NULL,
    old_nova_id TEXT,
    method TEXT NOT NULL,
    price_lightning INTEGER NOT NULL DEFAULT 0,
    price_rub NUMERIC(10,2) NOT NULL DEFAULT 0,
    admin_id INTEGER,
    note TEXT,
    created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS nova_id_purchases_user_idx ON t_p67547116_messenger_app_develo.nova_id_purchases (user_id);
CREATE INDEX IF NOT EXISTS nova_id_purchases_created_idx ON t_p67547116_messenger_app_develo.nova_id_purchases (created_at DESC);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.nova_id_reservations (
    nova_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    order_id INTEGER,
    expires_at BIGINT NOT NULL
);

INSERT INTO t_p67547116_messenger_app_develo.dev_settings (key, value, updated_at) VALUES
('nova_id_price_3', '{"lightning":5000,"rub":4990}', 0),
('nova_id_price_4', '{"lightning":2000,"rub":1990}', 0),
('nova_id_price_5', '{"lightning":800,"rub":790}', 0),
('nova_id_price_6', '{"lightning":300,"rub":290}', 0),
('nova_id_price_7', '{"lightning":150,"rub":149}', 0),
('nova_id_beauty_mult', '2', 0),
('nova_id_reserved', '', 0),
('avatar_video_max_sec', '10', 0),
('avatar_video_max_mb', '15', 0)
ON CONFLICT (key) DO NOTHING;