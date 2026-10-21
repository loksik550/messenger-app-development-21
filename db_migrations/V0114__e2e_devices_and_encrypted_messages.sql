CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.e2e_devices (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  device_id TEXT NOT NULL,
  pub TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL,
  revoked_at BIGINT NULL,
  UNIQUE (user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_e2e_devices_user ON t_p67547116_messenger_app_develo.e2e_devices(user_id);
ALTER TABLE t_p67547116_messenger_app_develo.messages ADD COLUMN IF NOT EXISTS enc TEXT NULL;
ALTER TABLE t_p67547116_messenger_app_develo.scheduled_messages ADD COLUMN IF NOT EXISTS enc TEXT NULL;