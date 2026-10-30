ALTER TABLE t_p67547116_messenger_app_develo.user_shop_badges ADD COLUMN IF NOT EXISTS note TEXT NULL;

UPDATE t_p67547116_messenger_app_develo.badges SET description = 'Подписчик Nova Pro — поддерживает развитие мессенджера' WHERE code = 'pro';
UPDATE t_p67547116_messenger_app_develo.badges SET description = 'Личность подтверждена командой Nova' WHERE code = 'verified';
UPDATE t_p67547116_messenger_app_develo.badges SET description = 'Заходил в Nova 30 дней подряд' WHERE code = 'streak';
UPDATE t_p67547116_messenger_app_develo.badges SET description = 'Помогал тестировать новые функции Nova до релиза' WHERE code = 'beta';
UPDATE t_p67547116_messenger_app_develo.badges SET description = 'Участник команды разработки Nova' WHERE code = 'dev';
UPDATE t_p67547116_messenger_app_develo.badges SET description = 'Провёл 10 звонков в Nova' WHERE code = 'voice';
UPDATE t_p67547116_messenger_app_develo.badges SET description = 'Один из первых 1000 пользователей Nova' WHERE code = 'first1000';
UPDATE t_p67547116_messenger_app_develo.badges SET description = 'Самый редкий коллекционный значок Nova — всего 100 экземпляров' WHERE code = 'star';

CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.test_themes_access (
    user_id BIGINT PRIMARY KEY,
    granted_by BIGINT NULL,
    created_at BIGINT NOT NULL
);