-- Настройка: оповещать ли о входах с нового устройства
ALTER TABLE t_p67547116_messenger_app_develo.users
    ADD COLUMN IF NOT EXISTS notify_new_login BOOLEAN NOT NULL DEFAULT TRUE;

-- Журнал входов: какое устройство, когда, откуда
CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.login_events (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    device_key TEXT NOT NULL,
    device_name TEXT,
    ip_addr TEXT,
    is_new BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);
CREATE INDEX IF NOT EXISTS idx_login_events_user
    ON t_p67547116_messenger_app_develo.login_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_device
    ON t_p67547116_messenger_app_develo.login_events (user_id, device_key);
