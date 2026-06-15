ALTER TABLE t_p67547116_messenger_app_develo.group_members
ADD COLUMN IF NOT EXISTS cleared_at BIGINT NOT NULL DEFAULT 0;