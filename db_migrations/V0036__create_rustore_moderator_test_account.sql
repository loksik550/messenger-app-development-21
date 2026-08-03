-- Тестовый аккаунт для модерации RuStore
-- Телефон: 79001112233, пароль: RuStore2026, имя: Тестовый аккаунт
INSERT INTO t_p67547116_messenger_app_develo.users (phone, name, password_hash, last_seen, created_at)
VALUES (
  '79001112233',
  'Тестовый аккаунт',
  'pbkdf2$0ccbcc7de1aeb11364d45cfae3630cee$001160a507e29f9007c46df82759f4c2469038aecb5991730ec4ee66154b2a33',
  (EXTRACT(epoch FROM now()))::bigint,
  (EXTRACT(epoch FROM now()))::bigint
)
ON CONFLICT (phone) DO NOTHING;