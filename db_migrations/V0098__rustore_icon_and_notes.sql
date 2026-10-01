CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.rustore_icon (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    mime VARCHAR(32) NOT NULL DEFAULT 'image/png',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.rustore_version_notes (
    version_id BIGINT PRIMARY KEY,
    note TEXT NOT NULL DEFAULT '',
    admin_email TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);