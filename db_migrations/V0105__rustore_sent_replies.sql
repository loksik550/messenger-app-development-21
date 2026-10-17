INSERT INTO t_p67547116_messenger_app_develo.dev_settings (key, value, updated_at)
SELECT 'rustore_sent_replies', '{}', extract(epoch from now())::bigint
WHERE NOT EXISTS (SELECT 1 FROM t_p67547116_messenger_app_develo.dev_settings WHERE key = 'rustore_sent_replies');