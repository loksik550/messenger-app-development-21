ALTER TABLE t_p67547116_messenger_app_develo.users ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE t_p67547116_messenger_app_develo.users ADD COLUMN IF NOT EXISTS notify_preview BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE t_p67547116_messenger_app_develo.groups ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE t_p67547116_messenger_app_develo.users SET is_test = TRUE WHERE id IN (28, 40, 41, 45, 46, 47, 48, 51, 52);
UPDATE t_p67547116_messenger_app_develo.groups SET is_test = TRUE, removed_at = COALESCE(removed_at, EXTRACT(EPOCH FROM NOW())::bigint), invite_link = NULL WHERE id <> 13;
UPDATE t_p67547116_messenger_app_develo.group_messages SET removed_at = COALESCE(removed_at, EXTRACT(EPOCH FROM NOW())::bigint) WHERE group_id <> 13;
UPDATE t_p67547116_messenger_app_develo.group_members SET role = 'removed' WHERE group_id <> 13;
UPDATE t_p67547116_messenger_app_develo.groups SET is_channel = TRUE WHERE id = 13;