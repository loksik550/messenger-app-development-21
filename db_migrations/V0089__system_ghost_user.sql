-- Системный аккаунт-заглушка.
-- На него переводятся сообщения тех, кто закрыл свой аккаунт,
-- чтобы переписка у собеседников не рассыпалась.
INSERT INTO t_p67547116_messenger_app_develo.users (id, phone, name, created_at, last_seen)
VALUES (0, 'system-ghost', 'Пользователь удалён',
        (EXTRACT(epoch FROM now()))::bigint, 0)
ON CONFLICT (id) DO UPDATE SET name = 'Пользователь удалён';
