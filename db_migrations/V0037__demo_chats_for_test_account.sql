-- Демо-переписки для тестового аккаунта модерации RuStore (user id=39, 79001112233)
-- Создаём двух собеседников и осмысленные диалоги.

-- 1. Собеседники
INSERT INTO t_p67547116_messenger_app_develo.users (phone, name, is_bot, last_seen, created_at)
VALUES
  ('79001112201', 'Анна', TRUE, (EXTRACT(epoch FROM now()))::bigint - 300, (EXTRACT(epoch FROM now()))::bigint - 604800),
  ('79001112202', 'Максим', TRUE, (EXTRACT(epoch FROM now()))::bigint - 3600, (EXTRACT(epoch FROM now()))::bigint - 604800)
ON CONFLICT (phone) DO NOTHING;

-- 2. Чаты тестового аккаунта (id=39) с собеседниками
INSERT INTO t_p67547116_messenger_app_develo.chats (user1_id, user2_id, last_message, last_message_at, created_at)
SELECT a.id, 39, 'Отлично, договорились!', (EXTRACT(epoch FROM now()))::bigint - 1800, (EXTRACT(epoch FROM now()))::bigint - 259200
FROM t_p67547116_messenger_app_develo.users a WHERE a.phone='79001112201'
ON CONFLICT (user1_id, user2_id) DO NOTHING;

INSERT INTO t_p67547116_messenger_app_develo.chats (user1_id, user2_id, last_message, last_message_at, created_at)
SELECT m.id, 39, 'Скинул файл, посмотри', (EXTRACT(epoch FROM now()))::bigint - 900, (EXTRACT(epoch FROM now()))::bigint - 172800
FROM t_p67547116_messenger_app_develo.users m WHERE m.phone='79001112202'
ON CONFLICT (user1_id, user2_id) DO NOTHING;

-- 3. Сообщения диалога с Анной
INSERT INTO t_p67547116_messenger_app_develo.messages (chat_id, sender_id, text, created_at, read_at, kind)
SELECT c.id, msg.sender_id, msg.text,
       (EXTRACT(epoch FROM now()))::bigint - msg.ago,
       (EXTRACT(epoch FROM now()))::bigint - msg.ago + 30, 'text'
FROM t_p67547116_messenger_app_develo.chats c
JOIN t_p67547116_messenger_app_develo.users a ON a.phone='79001112201'
CROSS JOIN (VALUES
  ((SELECT id FROM t_p67547116_messenger_app_develo.users WHERE phone='79001112201'), 'Привет! Как дела?', 7200),
  (39, 'Привет! Всё хорошо, спасибо 🙂', 7100),
  ((SELECT id FROM t_p67547116_messenger_app_develo.users WHERE phone='79001112201'), 'Встречаемся завтра в 15:00?', 3600),
  (39, 'Да, мне удобно', 3400),
  ((SELECT id FROM t_p67547116_messenger_app_develo.users WHERE phone='79001112201'), 'Отлично, договорились!', 1800)
) AS msg(sender_id, text, ago)
WHERE c.user1_id = a.id AND c.user2_id = 39;

-- 4. Сообщения диалога с Максимом
INSERT INTO t_p67547116_messenger_app_develo.messages (chat_id, sender_id, text, created_at, read_at, kind)
SELECT c.id, msg.sender_id, msg.text,
       (EXTRACT(epoch FROM now()))::bigint - msg.ago,
       (EXTRACT(epoch FROM now()))::bigint - msg.ago + 30, 'text'
FROM t_p67547116_messenger_app_develo.chats c
JOIN t_p67547116_messenger_app_develo.users m ON m.phone='79001112202'
CROSS JOIN (VALUES
  (39, 'Максим, привет! Готов материал?', 5400),
  ((SELECT id FROM t_p67547116_messenger_app_develo.users WHERE phone='79001112202'), 'Привет! Да, почти закончил', 5200),
  (39, 'Супер, жду', 4000),
  ((SELECT id FROM t_p67547116_messenger_app_develo.users WHERE phone='79001112202'), 'Скинул файл, посмотри', 900)
) AS msg(sender_id, text, ago)
WHERE c.user1_id = m.id AND c.user2_id = 39;