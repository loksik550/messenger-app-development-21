UPDATE t_p67547116_messenger_app_develo.dev_admins
SET disabled = true
WHERE email = 'probe@nova.test';

UPDATE t_p67547116_messenger_app_develo.dev_sessions
SET expires_at = 0
WHERE admin_id IN (
    SELECT id FROM t_p67547116_messenger_app_develo.dev_admins WHERE email = 'probe@nova.test'
);

UPDATE t_p67547116_messenger_app_develo.dev_invites
SET used_by = NULL, used_at = NULL, note = 'Код владельца панели'
WHERE code = 'NOVA-OWNER-2026';
