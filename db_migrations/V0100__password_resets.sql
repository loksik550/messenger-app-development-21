CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.password_resets (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL,
    new_password_hash text NOT NULL,
    poll_key_hash text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    route text NOT NULL DEFAULT 'device',
    device_name text NOT NULL DEFAULT '',
    ip_addr text NOT NULL DEFAULT '',
    created_at bigint NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint,
    decided_at bigint NULL,
    decided_by text NULL,
    expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON t_p67547116_messenger_app_develo.password_resets (user_id, status);
CREATE INDEX IF NOT EXISTS password_resets_status_idx ON t_p67547116_messenger_app_develo.password_resets (status, route);