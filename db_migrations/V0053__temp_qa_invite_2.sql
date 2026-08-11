INSERT INTO t_p67547116_messenger_app_develo.dev_invites (code, note, role)
VALUES ('NOVA-QA-CHECK2', 'Временный код для проверки', 'admin')
ON CONFLICT (code) DO UPDATE SET used_by = NULL, used_at = NULL, role = 'admin';
