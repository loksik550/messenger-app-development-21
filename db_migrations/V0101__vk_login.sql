ALTER TABLE t_p67547116_messenger_app_develo.users ADD COLUMN IF NOT EXISTS vk_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS users_vk_id_uniq ON t_p67547116_messenger_app_develo.users (vk_id) WHERE vk_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.vk_logins (
    id SERIAL PRIMARY KEY,
    state TEXT NOT NULL UNIQUE,
    code_verifier TEXT NOT NULL,
    poll_key_hash TEXT NOT NULL,
    user_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    is_native BOOLEAN NOT NULL DEFAULT FALSE,
    created_at INTEGER NOT NULL
);