ALTER TABLE t_p67547116_messenger_app_develo.dev_admins
    ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.dev_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint,
    updated_by BIGINT
);

INSERT INTO t_p67547116_messenger_app_develo.dev_settings (key, value)
VALUES ('panel_name', 'Nova Dev Panel'), ('panel_subtitle', 'Панель управления мессенджером')
ON CONFLICT (key) DO NOTHING;

UPDATE t_p67547116_messenger_app_develo.dev_admins
SET title = 'Основатель'
WHERE role = 'owner' AND title = '';
