ALTER TABLE t_p67547116_messenger_app_develo.users
    ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS verified_at BIGINT,
    ADD COLUMN IF NOT EXISTS verified_kind TEXT NOT NULL DEFAULT '';

ALTER TABLE t_p67547116_messenger_app_develo.groups
    ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS verified_at BIGINT;

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.verification_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'user',
    target_id BIGINT,
    full_name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    links TEXT NOT NULL DEFAULT '',
    comment TEXT NOT NULL DEFAULT '',
    doc_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    reviewer_id BIGINT,
    reviewer_note TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint,
    reviewed_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_verif_status ON t_p67547116_messenger_app_develo.verification_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verif_user ON t_p67547116_messenger_app_develo.verification_requests(user_id);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.dev_notifications (
    id BIGSERIAL PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link_section TEXT NOT NULL DEFAULT '',
    read_by TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);

CREATE INDEX IF NOT EXISTS idx_dev_notif_created ON t_p67547116_messenger_app_develo.dev_notifications(created_at DESC);

INSERT INTO t_p67547116_messenger_app_develo.dev_settings (key, value)
VALUES ('panel_bg_style', 'aurora'), ('panel_bg_image', '')
ON CONFLICT (key) DO NOTHING;
