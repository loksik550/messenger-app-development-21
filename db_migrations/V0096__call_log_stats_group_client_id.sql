CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.call_log (
  id bigserial PRIMARY KEY,
  call_id text NOT NULL UNIQUE,
  caller_id bigint NOT NULL,
  callee_id bigint NOT NULL,
  is_video boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ringing',
  started_at bigint NOT NULL,
  answered_at bigint NULL,
  ended_at bigint NULL,
  duration integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS call_log_caller_idx ON t_p67547116_messenger_app_develo.call_log (caller_id, started_at DESC);
CREATE INDEX IF NOT EXISTS call_log_callee_idx ON t_p67547116_messenger_app_develo.call_log (callee_id, started_at DESC);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.feature_events (
  id bigserial PRIMARY KEY,
  user_id bigint NULL,
  feature text NOT NULL,
  created_at bigint NOT NULL DEFAULT (EXTRACT(epoch FROM now()))::bigint
);
CREATE INDEX IF NOT EXISTS feature_events_created_idx ON t_p67547116_messenger_app_develo.feature_events (created_at);
CREATE INDEX IF NOT EXISTS feature_events_feature_idx ON t_p67547116_messenger_app_develo.feature_events (feature, created_at);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.daily_active (
  day date NOT NULL,
  user_id bigint NOT NULL,
  PRIMARY KEY (day, user_id)
);

ALTER TABLE t_p67547116_messenger_app_develo.group_messages ADD COLUMN IF NOT EXISTS client_id bigint NULL;
CREATE UNIQUE INDEX IF NOT EXISTS group_messages_sender_client_uidx ON t_p67547116_messenger_app_develo.group_messages (sender_id, client_id) WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_phone_idx ON t_p67547116_messenger_app_develo.users (phone);