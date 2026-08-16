-- Служебные аккаунты не должны попадаться обычным пользователям
ALTER TABLE t_p67547116_messenger_app_develo.users
    ADD COLUMN IF NOT EXISTS is_service BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE t_p67547116_messenger_app_develo.users
SET is_service = TRUE
WHERE id IN (0, 28, 37);
