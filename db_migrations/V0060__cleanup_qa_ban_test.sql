UPDATE t_p67547116_messenger_app_develo.dev_admins
SET disabled = true
WHERE email IN ('qa8@nova.test', 'qa9@nova.test');

UPDATE t_p67547116_messenger_app_develo.dev_sessions
SET expires_at = 0
WHERE admin_id IN (
    SELECT id FROM t_p67547116_messenger_app_develo.dev_admins
    WHERE email IN ('qa8@nova.test', 'qa9@nova.test')
);

UPDATE t_p67547116_messenger_app_develo.users
SET banned_until = NULL, banned_reason = NULL
WHERE id = 46;
