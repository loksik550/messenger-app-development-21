CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.dev_admins (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'admin',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint,
    last_login BIGINT,
    disabled BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.dev_sessions (
    token TEXT PRIMARY KEY,
    admin_id BIGINT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint,
    expires_at BIGINT NOT NULL,
    ip_addr TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_dev_sessions_admin ON t_p67547116_messenger_app_develo.dev_sessions(admin_id);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.dev_invites (
    code TEXT PRIMARY KEY,
    created_by BIGINT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint,
    used_by BIGINT,
    used_at BIGINT,
    note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.dev_audit (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT,
    admin_email TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    ip_addr TEXT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);

CREATE INDEX IF NOT EXISTS idx_dev_audit_created ON t_p67547116_messenger_app_develo.dev_audit(created_at DESC);

INSERT INTO t_p67547116_messenger_app_develo.dev_invites (code, note)
VALUES ('NOVA-OWNER-2026', 'Первый код для владельца')
ON CONFLICT (code) DO NOTHING;
