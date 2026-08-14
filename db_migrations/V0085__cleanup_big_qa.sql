-- Убираем тестовое правило и следы проверки
UPDATE t_p67547116_messenger_app_develo.auto_rules
SET enabled = FALSE, name = 'Проверка (можно удалить)'
WHERE name = 'Проверка спама';

UPDATE t_p67547116_messenger_app_develo.dev_undo
SET undone = TRUE
WHERE undone = FALSE;

-- Закрываем тестовый доступ
UPDATE t_p67547116_messenger_app_develo.dev_admins
SET disabled = true WHERE email = 'qa19@nova.test';

UPDATE t_p67547116_messenger_app_develo.dev_sessions
SET expires_at = 0
WHERE admin_id IN (
    SELECT id FROM t_p67547116_messenger_app_develo.dev_admins WHERE email = 'qa19@nova.test'
);

UPDATE t_p67547116_messenger_app_develo.dev_invites
SET used_at = (EXTRACT(epoch FROM now()))::bigint,
    note = 'Использован (проверка завершена)'
WHERE code = 'NOVA-QA-BIG' AND used_at IS NULL;
