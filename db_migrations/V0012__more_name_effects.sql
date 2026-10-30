INSERT INTO t_p67547116_messenger_app_develo.name_effects (code, title, description, price_lightning, duration_days, sort_order) VALUES
('fire', 'Огонь', 'Имя горит живым пламенем', 180, NULL, 40),
('rainbow', 'Радужная обводка', 'Переливающаяся радужная обводка букв', 160, NULL, 50),
('snow', 'Снежинка', 'Снежинка перед именем на 30 дней', 70, 30, 60)
ON CONFLICT (code) DO NOTHING;