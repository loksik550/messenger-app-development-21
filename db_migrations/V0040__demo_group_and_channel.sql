-- Демо-группа и демо-канал: без них разделы выглядят пустыми.

INSERT INTO t_p67547116_messenger_app_develo.groups
      (name, description, owner_id, is_channel, invite_link, created_at, last_message, last_message_at, only_admins_post, slow_mode_seconds)
SELECT 'Друзья', 'Общий чат для своих', m.id, false, 'nova-friends-demo',
       EXTRACT(EPOCH FROM NOW())::bigint - 604800, '', 0, false, 0
FROM t_p67547116_messenger_app_develo.users m
WHERE m.phone = '79991234567'
  AND NOT EXISTS (SELECT 1 FROM t_p67547116_messenger_app_develo.groups WHERE invite_link = 'nova-friends-demo');

INSERT INTO t_p67547116_messenger_app_develo.groups
      (name, description, owner_id, is_channel, invite_link, created_at, last_message, last_message_at, only_admins_post, slow_mode_seconds)
SELECT 'Новости Nova', 'Официальный канал обновлений мессенджера', m.id, true, 'nova-news-demo',
       EXTRACT(EPOCH FROM NOW())::bigint - 604800, '', 0, true, 0
FROM t_p67547116_messenger_app_develo.users m
WHERE m.phone = '79991234567'
  AND NOT EXISTS (SELECT 1 FROM t_p67547116_messenger_app_develo.groups WHERE invite_link = 'nova-news-demo');

-- Участники
INSERT INTO t_p67547116_messenger_app_develo.group_members (group_id, user_id, role, joined_at)
SELECT g.id, u.id,
       CASE WHEN u.id = g.owner_id THEN 'owner' ELSE 'member' END,
       EXTRACT(EPOCH FROM NOW())::bigint - 604800
FROM t_p67547116_messenger_app_develo.groups g
JOIN t_p67547116_messenger_app_develo.users u
  ON u.phone IN ('79991234567', '79992223344', '79993334455', '79994445566')
WHERE g.invite_link IN ('nova-friends-demo', 'nova-news-demo')
  AND NOT EXISTS (
    SELECT 1 FROM t_p67547116_messenger_app_develo.group_members x
    WHERE x.group_id = g.id AND x.user_id = u.id
  );

-- Сообщения в группе «Друзья»
INSERT INTO t_p67547116_messenger_app_develo.group_messages (group_id, sender_id, text, created_at)
SELECT g.id, s.sender, s.txt, EXTRACT(EPOCH FROM NOW())::bigint - s.ago
FROM t_p67547116_messenger_app_develo.groups g
JOIN t_p67547116_messenger_app_develo.users a ON a.phone = '79992223344'
JOIN t_p67547116_messenger_app_develo.users d ON d.phone = '79993334455'
JOIN t_p67547116_messenger_app_develo.users m ON m.phone = '79991234567'
CROSS JOIN LATERAL (VALUES
  (m.id, 'Всем привет! Создал чат, чтобы не теряться', 50000),
  (a.id, 'Отличная идея 🎉', 49700),
  (d.id, 'Поддерживаю! Когда встречаемся?', 49400),
  (m.id, '预 давайте в субботу в парке', 49100),
  (a.id, 'Мне подходит', 48800)
) AS s(sender, txt, ago)
WHERE g.invite_link = 'nova-friends-demo'
  AND NOT EXISTS (SELECT 1 FROM t_p67547116_messenger_app_develo.group_messages x WHERE x.group_id = g.id);

-- Публикации в канале «Новости Nova»
INSERT INTO t_p67547116_messenger_app_develo.group_messages (group_id, sender_id, text, created_at, views_count)
SELECT g.id, g.owner_id, s.txt, EXTRACT(EPOCH FROM NOW())::bigint - s.ago, s.views
FROM t_p67547116_messenger_app_develo.groups g
CROSS JOIN LATERAL (VALUES
  ('Добро пожаловать в официальный канал Nova! Здесь мы публикуем новости и обновления.', 100000, 128),
  ('Обновление: добавлены видеозвонки и голосовые сообщения.', 70000, 96),
  ('Теперь доступны истории — они исчезают через 24 часа.', 40000, 74),
  ('Добавлена тёмная тема и настройка оформления чатов.', 10000, 51)
) AS s(txt, ago, views)
WHERE g.invite_link = 'nova-news-demo'
  AND NOT EXISTS (SELECT 1 FROM t_p67547116_messenger_app_develo.group_messages x WHERE x.group_id = g.id);

-- Превью последних сообщений
UPDATE t_p67547116_messenger_app_develo.groups g
SET last_message = lm.text, last_message_at = lm.created_at
FROM (
  SELECT DISTINCT ON (group_id) group_id, text, created_at
  FROM t_p67547116_messenger_app_develo.group_messages
  ORDER BY group_id, created_at DESC
) lm
WHERE g.id = lm.group_id;
