UPDATE t_p67547116_messenger_app_develo.dev_admins
SET disabled = true
WHERE email IN ('qa3@nova.test', 'dbg@nova.test');

UPDATE t_p67547116_messenger_app_develo.dev_sessions
SET expires_at = 0
WHERE admin_id IN (
    SELECT id FROM t_p67547116_messenger_app_develo.dev_admins
    WHERE email IN ('qa3@nova.test', 'dbg@nova.test')
);

UPDATE t_p67547116_messenger_app_develo.dev_invites
SET used_by = NULL, used_at = NULL, note = 'Свободный код (модератор)'
WHERE code IN ('NOVA-BDF74E9C', 'NOVA-7CC1ED03');
