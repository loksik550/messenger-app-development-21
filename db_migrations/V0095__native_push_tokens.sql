CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.native_push_tokens (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'android',
  created_at bigint NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);
CREATE INDEX IF NOT EXISTS native_push_tokens_user_idx ON t_p67547116_messenger_app_develo.native_push_tokens (user_id);