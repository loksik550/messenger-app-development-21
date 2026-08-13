INSERT INTO t_p67547116_messenger_app_develo.dev_invites (code, note, role)
VALUES ('NOVA-QA-MAINT', 'Временный код для проверки техработ', 'owner')
ON CONFLICT (code) DO UPDATE SET used_by = NULL, used_at = NULL, role = 'owner';
