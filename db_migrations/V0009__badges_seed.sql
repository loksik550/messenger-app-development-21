INSERT INTO t_p67547116_messenger_app_develo.badges (code, title, description, rarity, price_lightning, supply, on_sale, sort_order) VALUES
('star', 'Звезда Nova', 'Самый редкий значок Nova', 'legendary', 500, 100, TRUE, 10),
('legend', 'Легенда', 'Для настоящих легенд', 'legendary', 400, 300, TRUE, 20),
('crown', 'Корона', 'Королевский значок', 'legendary', 300, 500, TRUE, 30),
('champion', 'Чемпион', 'Значок победителя', 'legendary', 200, 1000, TRUE, 40),
('crystal', 'Кристалл', 'Чистый и редкий', 'epic', 250, 2000, TRUE, 50),
('cosmos', 'Космос', 'Для мечтателей', 'epic', 180, 3000, TRUE, 60),
('first1000', 'Первые 1000', 'Один из первых в Nova', 'epic', 50, 1000, TRUE, 70),
('lightning', 'Молния', 'Быстрый как молния', 'rare', 100, NULL, TRUE, 80),
('sakura', 'Сакура', 'Весенний значок', 'rare', 80, NULL, TRUE, 90),
('heart', 'Сердце', 'С любовью', 'common', 40, NULL, TRUE, 100),
('winter', 'Зима 2026', 'Сезонный значок', 'common', 30, NULL, TRUE, 110),
('pro', 'Nova Pro', 'Выдаётся вручную', 'epic', NULL, NULL, FALSE, 200),
('verified', 'Подтверждён', 'Выдаётся вручную', 'rare', NULL, NULL, FALSE, 210),
('streak', 'Серия 30 дней', 'За активность', 'rare', NULL, NULL, FALSE, 220),
('beta', 'Бета-тестер', 'За помощь в тестировании', 'rare', NULL, NULL, FALSE, 230),
('dev', 'Разработчик', 'Команда Nova', 'rare', NULL, NULL, FALSE, 240),
('voice', 'Голос', 'За 10 звонков', 'common', NULL, NULL, FALSE, 250)
ON CONFLICT (code) DO NOTHING;

INSERT INTO t_p67547116_messenger_app_develo.name_effects (code, title, description, price_lightning, duration_days, sort_order) VALUES
('shimmer', 'Переливы', 'Имя плавно переливается цветами', 150, NULL, 10),
('neon', 'Неон', 'Светящееся неоновое имя', 120, NULL, 20),
('crown', 'Корона', 'Корона перед именем на 30 дней', 90, 30, 30)
ON CONFLICT (code) DO NOTHING;