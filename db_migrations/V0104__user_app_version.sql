ALTER TABLE t_p67547116_messenger_app_develo.users ADD COLUMN IF NOT EXISTS app_version TEXT;
ALTER TABLE t_p67547116_messenger_app_develo.users ADD COLUMN IF NOT EXISTS app_platform TEXT;
ALTER TABLE t_p67547116_messenger_app_develo.users ADD COLUMN IF NOT EXISTS app_version_at BIGINT;
ALTER TABLE t_p67547116_messenger_app_develo.users ADD COLUMN IF NOT EXISTS update_nudged_version TEXT;