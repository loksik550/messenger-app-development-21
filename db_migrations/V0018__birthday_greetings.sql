CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.birthday_greetings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    friend_id BIGINT NOT NULL,
    year INTEGER NOT NULL,
    card VARCHAR(32) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_birthday_greetings ON t_p67547116_messenger_app_develo.birthday_greetings (user_id, friend_id, year);