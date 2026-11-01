UPDATE t_p67547116_messenger_app_develo.users
SET name_fix_deadline = EXTRACT(EPOCH FROM NOW())::bigint + 72 * 3600
WHERE id = 111 AND name = 'Ririirriririririirororoeiforori';