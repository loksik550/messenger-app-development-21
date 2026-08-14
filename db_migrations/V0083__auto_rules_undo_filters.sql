-- Автоправила модерации: условие → действие
CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.auto_rules (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_kind TEXT NOT NULL,        -- reports | msg_rate | mod_hits | new_account_rate
    threshold INTEGER NOT NULL DEFAULT 3,
    window_hours INTEGER NOT NULL DEFAULT 24,
    action TEXT NOT NULL,              -- ban | freeze | notify
    action_days INTEGER NOT NULL DEFAULT 7,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    fired_count INTEGER NOT NULL DEFAULT 0,
    last_fired_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);

-- Журнал срабатываний автоправил
CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.auto_rule_hits (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT NOT NULL,
    user_id INTEGER NOT NULL,
    detail TEXT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);
CREATE INDEX IF NOT EXISTS idx_auto_rule_hits_created
    ON t_p67547116_messenger_app_develo.auto_rule_hits (created_at DESC);

-- История блокировок пользователей (для карточки)
CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.ban_history (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    until_ts BIGINT,
    reason TEXT,
    by_admin TEXT,
    kind TEXT NOT NULL DEFAULT 'ban',  -- ban | unban
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);
CREATE INDEX IF NOT EXISTS idx_ban_history_user
    ON t_p67547116_messenger_app_develo.ban_history (user_id, created_at DESC);

-- Отмена действий: что было изменено и как вернуть
CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.dev_undo (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    label TEXT NOT NULL,
    payload TEXT NOT NULL,             -- JSON со снимком прежнего состояния
    undone BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);
CREATE INDEX IF NOT EXISTS idx_dev_undo_admin
    ON t_p67547116_messenger_app_develo.dev_undo (admin_id, created_at DESC);

-- Сохранённые фильтры для списка пользователей
CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.dev_saved_filters (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT,
    name TEXT NOT NULL,
    filters TEXT NOT NULL,             -- JSON с условиями
    shared BOOLEAN NOT NULL DEFAULT TRUE,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);

-- Готовые автоправила, выключенные — включит владелец сам
INSERT INTO t_p67547116_messenger_app_develo.auto_rules
    (name, trigger_kind, threshold, window_hours, action, action_days, enabled)
VALUES
    ('Много жалоб — заблокировать', 'reports', 3, 24, 'ban', 7, FALSE),
    ('Спам сообщениями — заморозить', 'msg_rate', 60, 1, 'freeze', 1, FALSE),
    ('Повторные нарушения слов — предупредить', 'mod_hits', 5, 24, 'notify', 0, FALSE)
ON CONFLICT DO NOTHING;
