CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.chat_folders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'Folder',
    chat_ids TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_folders_user ON t_p67547116_messenger_app_develo.chat_folders (user_id);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.group_calls (
    id BIGSERIAL PRIMARY KEY,
    call_id TEXT NOT NULL UNIQUE,
    group_id BIGINT NOT NULL,
    started_by BIGINT NOT NULL,
    started_at BIGINT NOT NULL,
    ended_at BIGINT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_calls_group ON t_p67547116_messenger_app_develo.group_calls (group_id, ended_at);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.group_call_participants (
    id BIGSERIAL PRIMARY KEY,
    call_id TEXT NOT NULL,
    user_id BIGINT NOT NULL,
    joined_at BIGINT NOT NULL,
    last_ping BIGINT NOT NULL,
    left_at BIGINT NULL,
    muted BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (call_id, user_id)
);

INSERT INTO t_p67547116_messenger_app_develo.dev_settings (key, value, updated_at)
VALUES ('pin_limit_free', '5', EXTRACT(EPOCH FROM NOW())::bigint),
       ('pin_limit_pro', '20', EXTRACT(EPOCH FROM NOW())::bigint),
       ('folder_limit_free', '2', EXTRACT(EPOCH FROM NOW())::bigint),
       ('folder_limit_pro', '10', EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT (key) DO NOTHING;