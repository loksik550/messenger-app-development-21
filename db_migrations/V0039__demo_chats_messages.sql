-- Демо-переписки для модератора: чаты должны быть непустыми,
-- иначе приложение выглядит как незавершённый продукт.

INSERT INTO t_p67547116_messenger_app_develo.chats (user1_id, user2_id, created_at, last_message, last_message_at)
SELECT m.id, c.id, EXTRACT(EPOCH FROM NOW())::bigint - 432000, '', 0
FROM t_p67547116_messenger_app_develo.users m
CROSS JOIN t_p67547116_messenger_app_develo.users c
WHERE m.phone = '79991234567'
  AND c.phone IN ('79992223344', '79993334455', '79994445566')
  AND NOT EXISTS (
    SELECT 1 FROM t_p67547116_messenger_app_develo.chats x
    WHERE (x.user1_id = m.id AND x.user2_id = c.id)
       OR (x.user1_id = c.id AND x.user2_id = m.id)
  );

-- Переписка с Анной
INSERT INTO t_p67547116_messenger_app_develo.messages (chat_id, sender_id, text, created_at, read_at)
SELECT ch.id, s.sender, s.txt, EXTRACT(EPOCH FROM NOW())::bigint - s.ago, EXTRACT(EPOCH FROM NOW())::bigint - s.ago + 60
FROM t_p67547116_messenger_app_develo.users m
JOIN t_p67547116_messenger_app_develo.users c ON c.phone = '79992223344'
JOIN t_p67547116_messenger_app_develo.chats ch
  ON (ch.user1_id = m.id AND ch.user2_id = c.id) OR (ch.user1_id = c.id AND ch.user2_id = m.id)
CROSS JOIN LATERAL (VALUES
  (c.id, 'Привет! Как продвигается проект?', 9000),
  (m.id, 'Привет! Отлично, почти закончил макеты', 8700),
  (c.id, 'Здорово, покажешь вечером?', 8400),
  (m.id, 'Конечно, скину после шести', 8100),
  (c.id, 'Договорились 👍', 7800)
) AS s(sender, txt, ago)
WHERE m.phone = '79991234567'
  AND NOT EXISTS (SELECT 1 FROM t_p67547116_messenger_app_develo.messages x WHERE x.chat_id = ch.id);

-- Переписка с Дмитрием
INSERT INTO t_p67547116_messenger_app_develo.messages (chat_id, sender_id, text, created_at, read_at)
SELECT ch.id, s.sender, s.txt, EXTRACT(EPOCH FROM NOW())::bigint - s.ago, EXTRACT(EPOCH FROM NOW())::bigint - s.ago + 60
FROM t_p67547116_messenger_app_develo.users m
JOIN t_p67547116_messenger_app_develo.users c ON c.phone = '79993334455'
JOIN t_p67547116_messenger_app_develo.chats ch
  ON (ch.user1_id = m.id AND ch.user2_id = c.id) OR (ch.user1_id = c.id AND ch.user2_id = m.id)
CROSS JOIN LATERAL (VALUES
  (m.id, 'Дим, ты уже вернулся из поездки?', 20000),
  (c.id, 'Да, вчера прилетел! Впечатлений море', 19700),
  (m.id, 'Расскажешь при встрече?', 19400),
  (c.id, 'Обязательно, давай в выходные', 19100)
) AS s(sender, txt, ago)
WHERE m.phone = '79991234567'
  AND NOT EXISTS (SELECT 1 FROM t_p67547116_messenger_app_develo.messages x WHERE x.chat_id = ch.id);

-- Переписка с Марией
INSERT INTO t_p67547116_messenger_app_develo.messages (chat_id, sender_id, text, created_at, read_at)
SELECT ch.id, s.sender, s.txt, EXTRACT(EPOCH FROM NOW())::bigint - s.ago, NULL
FROM t_p67547116_messenger_app_develo.users m
JOIN t_p67547116_messenger_app_develo.users c ON c.phone = '79994445566'
JOIN t_p67547116_messenger_app_develo.chats ch
  ON (ch.user1_id = m.id AND ch.user2_id = c.id) OR (ch.user1_id = c.id AND ch.user2_id = m.id)
CROSS JOIN LATERAL (VALUES
  (c.id, 'Доброе утро! Не забудь про созвон в 15:00', 3600),
  (m.id, 'Помню, буду вовремя', 3300),
  (c.id, 'Отлично, до связи ☕', 3000)
) AS s(sender, txt, ago)
WHERE m.phone = '79991234567'
  AND NOT EXISTS (SELECT 1 FROM t_p67547116_messenger_app_develo.messages x WHERE x.chat_id = ch.id);

-- Обновляем превью последнего сообщения в списке чатов
UPDATE t_p67547116_messenger_app_develo.chats ch
SET last_message = lm.text, last_message_at = lm.created_at
FROM (
  SELECT DISTINCT ON (chat_id) chat_id, text, created_at
  FROM t_p67547116_messenger_app_develo.messages
  ORDER BY chat_id, created_at DESC
) lm
WHERE ch.id = lm.chat_id;
