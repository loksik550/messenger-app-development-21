CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.user_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    read_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);

CREATE INDEX IF NOT EXISTS idx_user_notif ON t_p67547116_messenger_app_develo.user_notifications(user_id, created_at DESC);
