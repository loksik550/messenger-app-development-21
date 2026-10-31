ALTER TABLE t_p67547116_messenger_app_develo.users ADD COLUMN IF NOT EXISTS name_fix_deadline BIGINT;
UPDATE t_p67547116_messenger_app_develo.users
SET name_fix_deadline = EXTRACT(EPOCH FROM NOW())::bigint + 72 * 3600
WHERE COALESCE(is_bot, FALSE) = FALSE AND COALESCE(is_service, FALSE) = FALSE
  AND name !~ '^[A-Za-zА-Яа-яЁё]{1,}( [A-Za-zА-Яа-яЁё]{1,})*$';