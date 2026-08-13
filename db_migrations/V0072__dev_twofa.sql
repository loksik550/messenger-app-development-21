ALTER TABLE t_p67547116_messenger_app_develo.dev_admins
    ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS twofa_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.dev_login_codes (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at BIGINT NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    ip_addr TEXT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);

CREATE INDEX IF NOT EXISTS idx_dev_login_codes_admin
    ON t_p67547116_messenger_app_develo.dev_login_codes(admin_id, used);
