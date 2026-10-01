ALTER TABLE t_p67547116_messenger_app_develo.messages ADD COLUMN IF NOT EXISTS client_id bigint NULL;
CREATE UNIQUE INDEX IF NOT EXISTS messages_sender_client_uidx ON t_p67547116_messenger_app_develo.messages (sender_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_chat_created_idx ON t_p67547116_messenger_app_develo.messages (chat_id, created_at, id);