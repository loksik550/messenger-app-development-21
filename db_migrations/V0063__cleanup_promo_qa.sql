UPDATE t_p67547116_messenger_app_develo.dev_admins
SET disabled = true
WHERE email = 'qa11@nova.test';

UPDATE t_p67547116_messenger_app_develo.dev_sessions
SET expires_at = 0
WHERE admin_id IN (
    SELECT id FROM t_p67547116_messenger_app_develo.dev_admins WHERE email = 'qa11@nova.test'
);

UPDATE t_p67547116_messenger_app_develo.dev_invites
SET used_at = (EXTRACT(epoch FROM now()))::bigint,
    note = 'Использован (проверка завершена)'
WHERE code = 'NOVA-QA-PROMO' AND used_at IS NULL;

UPDATE t_p67547116_messenger_app_develo.promo_codes
SET active = false, note = 'Тестовый промокод проверки'
WHERE code = 'LETO2026';
