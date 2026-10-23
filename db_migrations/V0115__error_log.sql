CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.error_log (
  id BIGSERIAL PRIMARY KEY,
  source VARCHAR(40) NOT NULL,
  action VARCHAR(60),
  kind VARCHAR(80) NOT NULL,
  message TEXT,
  user_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_error_log_created ON t_p67547116_messenger_app_develo.error_log (created_at DESC);