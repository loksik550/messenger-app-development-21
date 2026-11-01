ALTER TABLE t_p67547116_messenger_app_develo.users ADD COLUMN IF NOT EXISTS group_invite_approval BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.group_invites (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    inviter_id INTEGER NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at BIGINT NOT NULL,
    decided_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_group_invites_user ON t_p67547116_messenger_app_develo.group_invites (user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_invites_pending ON t_p67547116_messenger_app_develo.group_invites (group_id, user_id) WHERE status = 'pending';

UPDATE t_p67547116_messenger_app_develo.group_members
SET role = 'removed'
WHERE group_id IN (SELECT id FROM t_p67547116_messenger_app_develo.groups WHERE owner_id = 111)
  AND user_id <> 111;