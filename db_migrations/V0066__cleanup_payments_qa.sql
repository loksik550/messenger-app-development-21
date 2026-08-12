UPDATE t_p67547116_messenger_app_develo.dev_admins
SET disabled = true
WHERE email = 'qa12@nova.test';

UPDATE t_p67547116_messenger_app_develo.dev_sessions
SET expires_at = 0
WHERE admin_id IN (
    SELECT id FROM t_p67547116_messenger_app_develo.dev_admins WHERE email = 'qa12@nova.test'
);

UPDATE t_p67547116_messenger_app_develo.dev_invites
SET used_at = (EXTRACT(epoch FROM now()))::bigint,
    note = 'Использован (проверка завершена)'
WHERE code = 'NOVA-QA-PAYCHK' AND used_at IS NULL;

UPDATE t_p67547116_messenger_app_develo.orders
SET status = 'canceled', cancel_reason = 'Тестовый платёж проверки'
WHERE status = 'pending' AND user_email = 'test@novaa.pro';
