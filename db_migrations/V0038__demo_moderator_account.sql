-- Демо-окружение для модерации RuStore.
-- Модератор входит по номеру 79991234567 с кодом 1234 и должен сразу
-- увидеть работающий мессенджер: контакты, переписки, группу и канал.

INSERT INTO t_p67547116_messenger_app_develo.users
      (phone, name, about, created_at, last_seen, emoji_status,
       wallet_balance, lightning_balance, xp, level, daily_streak,
       theme_id, accent_color, bubble_style, font_size,
       is_bot, pro_trial_used, app_lock_enabled, read_receipts_enabled,
       last_seen_visibility, profile_photo_visibility, phone_visibility,
       auto_clean_account_days, friends_count,
       notify_messages, notify_groups, notify_calls, notify_sound, notify_vibration)
SELECT '79991234567', 'Иван Петров', 'Тестирую Nova', EXTRACT(EPOCH FROM NOW())::bigint,
       EXTRACT(EPOCH FROM NOW())::bigint, '😎',
       500, 50, 120, 3, 4,
       'dark', 'violet', 'default', 16,
       false, false, false, true,
       'everyone', 'everyone', 'contacts',
       0, 3,
       true, true, true, 'default', true
WHERE NOT EXISTS (SELECT 1 FROM t_p67547116_messenger_app_develo.users WHERE phone = '79991234567');

INSERT INTO t_p67547116_messenger_app_develo.users
      (phone, name, about, created_at, last_seen, emoji_status,
       wallet_balance, lightning_balance, xp, level, daily_streak,
       theme_id, accent_color, bubble_style, font_size,
       is_bot, pro_trial_used, app_lock_enabled, read_receipts_enabled,
       last_seen_visibility, profile_photo_visibility, phone_visibility,
       auto_clean_account_days, friends_count,
       notify_messages, notify_groups, notify_calls, notify_sound, notify_vibration)
SELECT v.phone, v.name, v.about, EXTRACT(EPOCH FROM NOW())::bigint - 864000,
       EXTRACT(EPOCH FROM NOW())::bigint - v.seen_ago, v.emoji,
       0, 10, 60, 2, 1,
       'dark', 'violet', 'default', 16,
       false, false, false, true,
       'everyone', 'everyone', 'contacts',
       0, 2,
       true, true, true, 'default', true
FROM (VALUES
  ('79992223344', 'Анна Смирнова', 'Дизайнер', '🎨', 300),
  ('79993334455', 'Дмитрий Козлов', 'Люблю путешествия', '✈️', 7200),
  ('79994445566', 'Мария Иванова', 'Кофе и книги', '☕', 120)
) AS v(phone, name, about, emoji, seen_ago)
WHERE NOT EXISTS (SELECT 1 FROM t_p67547116_messenger_app_develo.users u WHERE u.phone = v.phone);

INSERT INTO t_p67547116_messenger_app_develo.contacts (user_id, contact_id, created_at)
SELECT m.id, c.id, EXTRACT(EPOCH FROM NOW())::bigint - 432000
FROM t_p67547116_messenger_app_develo.users m
CROSS JOIN t_p67547116_messenger_app_develo.users c
WHERE m.phone = '79991234567'
  AND c.phone IN ('79992223344', '79993334455', '79994445566')
  AND NOT EXISTS (
    SELECT 1 FROM t_p67547116_messenger_app_develo.contacts x
    WHERE x.user_id = m.id AND x.contact_id = c.id
  );

INSERT INTO t_p67547116_messenger_app_develo.contacts (user_id, contact_id, created_at)
SELECT c.id, m.id, EXTRACT(EPOCH FROM NOW())::bigint - 432000
FROM t_p67547116_messenger_app_develo.users m
CROSS JOIN t_p67547116_messenger_app_develo.users c
WHERE m.phone = '79991234567'
  AND c.phone IN ('79992223344', '79993334455', '79994445566')
  AND NOT EXISTS (
    SELECT 1 FROM t_p67547116_messenger_app_develo.contacts x
    WHERE x.user_id = c.id AND x.contact_id = m.id
  );
