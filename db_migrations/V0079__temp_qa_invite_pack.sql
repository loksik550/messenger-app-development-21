INSERT INTO t_p67547116_messenger_app_develo.dev_invites (code, note, role)
VALUES ('NOVA-QA-PACK', 'Временный код для проверки пакета улучшений', 'owner')
ON CONFLICT (code) DO UPDATE SET used_by = NULL, used_at = NULL, role = 'owner';
