ALTER TABLE t_p67547116_messenger_app_develo.dev_admins ADD COLUMN IF NOT EXISTS vk_id BIGINT;
ALTER TABLE t_p67547116_messenger_app_develo.dev_admins ADD COLUMN IF NOT EXISTS nova_user_id BIGINT;
ALTER TABLE t_p67547116_messenger_app_develo.vk_logins ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'app';
ALTER TABLE t_p67547116_messenger_app_develo.vk_logins ADD COLUMN IF NOT EXISTS vk_user_id BIGINT;
ALTER TABLE t_p67547116_messenger_app_develo.vk_logins ADD COLUMN IF NOT EXISTS admin_link_id BIGINT;