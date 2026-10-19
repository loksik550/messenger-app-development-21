ALTER TABLE t_p67547116_messenger_app_develo.users ADD COLUMN IF NOT EXISTS nova_id TEXT;

UPDATE t_p67547116_messenger_app_develo.users u
SET nova_id = t.nid
FROM (
  SELECT id, (10000000 + ((id::bigint * 48271 + 1299709) % 89999999))::text AS nid
  FROM t_p67547116_messenger_app_develo.users
) t
WHERE u.id = t.id AND u.nova_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_nova_id_uniq ON t_p67547116_messenger_app_develo.users (nova_id);