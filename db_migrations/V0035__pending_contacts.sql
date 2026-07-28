-- Отложенные контакты: номера, которые пользователь добавил, но их владелец ещё не в Nova.
-- При регистрации такого номера — уведомляем всех, кто его ждал.
CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.pending_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,          -- кто добавил номер
    phone TEXT NOT NULL,               -- нормализованный номер (без +, 8->7)
    name_override TEXT,                -- как назвал контакт
    notified INTEGER NOT NULL DEFAULT 0, -- 0 = ещё не уведомлён о регистрации
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_pending_contacts_phone ON t_p67547116_messenger_app_develo.pending_contacts(phone);