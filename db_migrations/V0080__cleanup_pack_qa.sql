UPDATE t_p67547116_messenger_app_develo.users
SET pro_until = pro_until - (7 * 86400)
WHERE id IN (46, 47) AND COALESCE(pro_until, 0) > 0;

UPDATE t_p67547116_messenger_app_develo.dev_admins
SET disabled = true WHERE email = 'qa17@nova.test';
UPDATE t_p67547116_messenger_app_develo.dev_sessions
SET expires_at = 0
WHERE admin_id IN (
    SELECT id FROM t_p67547116_messenger_app_develo.dev_admins WHERE email = 'qa17@nova.test'
);
UPDATE t_p67547116_messenger_app_develo.dev_invites
SET used_at = (EXTRACT(epoch FROM now()))::bigint,
    note = 'Использован (проверка завершена)'
WHERE code = 'NOVA-QA-PACK' AND used_at IS NULL;
