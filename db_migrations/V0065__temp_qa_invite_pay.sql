INSERT INTO t_p67547116_messenger_app_develo.dev_invites (code, note, role)
VALUES ('NOVA-QA-PAYCHK', 'Временный код для проверки платежей', 'owner')
ON CONFLICT (code) DO UPDATE SET used_by = NULL, used_at = NULL, role = 'owner';
