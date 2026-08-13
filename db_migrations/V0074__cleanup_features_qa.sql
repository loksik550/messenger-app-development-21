UPDATE t_p67547116_messenger_app_develo.dev_settings
SET value = '0' WHERE key = 'maintenance_enabled';
UPDATE t_p67547116_messenger_app_develo.dev_settings
SET value = 'Технические работы' WHERE key = 'maintenance_title';
UPDATE t_p67547116_messenger_app_develo.dev_settings
SET value = 'Мы улучшаем Nova и скоро вернёмся. Спасибо за терпение!' WHERE key = 'maintenance_text';

UPDATE t_p67547116_messenger_app_develo.dev_admins
SET disabled = true WHERE email = 'qa15@nova.test';
UPDATE t_p67547116_messenger_app_develo.dev_sessions
SET expires_at = 0
WHERE admin_id IN (
    SELECT id FROM t_p67547116_messenger_app_develo.dev_admins WHERE email = 'qa15@nova.test'
);
UPDATE t_p67547116_messenger_app_develo.dev_invites
SET used_at = (EXTRACT(epoch FROM now()))::bigint,
    note = 'Использован (проверка завершена)'
WHERE code = 'NOVA-QA-FEAT' AND used_at IS NULL;
