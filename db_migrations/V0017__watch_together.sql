CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.watch_sessions (
    chat_id BIGINT PRIMARY KEY,
    source VARCHAR(16) NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    started_by BIGINT NOT NULL,
    playing BOOLEAN NOT NULL DEFAULT FALSE,
    position DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_ms BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL,
    ended_at BIGINT
);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.watch_reactions (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    emoji VARCHAR(8) NOT NULL,
    created_ms BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_watch_reactions_chat ON t_p67547116_messenger_app_develo.watch_reactions (chat_id, id);