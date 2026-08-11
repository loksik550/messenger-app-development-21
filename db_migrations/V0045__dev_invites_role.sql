ALTER TABLE t_p67547116_messenger_app_develo.dev_invites
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'moderator';

UPDATE t_p67547116_messenger_app_develo.dev_invites
SET role = 'owner'
WHERE code = 'NOVA-OWNER-2026';
