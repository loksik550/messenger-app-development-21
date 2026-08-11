ALTER TABLE t_p67547116_messenger_app_develo.wallet_transactions
    ALTER COLUMN created_at SET DEFAULT (EXTRACT(epoch FROM now()))::bigint;

ALTER TABLE t_p67547116_messenger_app_develo.groups
    ADD COLUMN IF NOT EXISTS removed_at BIGINT;

INSERT INTO t_p67547116_messenger_app_develo.dev_settings (key, value)
VALUES ('panel_logo_url', ''), ('panel_logo_icon', 'Terminal')
ON CONFLICT (key) DO NOTHING;
