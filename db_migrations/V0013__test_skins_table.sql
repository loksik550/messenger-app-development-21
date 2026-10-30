CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.test_skins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_style TEXT NOT NULL DEFAULT 'rain',
    image_url TEXT NOT NULL,
    ticker TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at BIGINT NOT NULL DEFAULT 0
);

INSERT INTO t_p67547116_messenger_app_develo.test_skins (id, name, base_style, image_url, ticker, sort_order) VALUES
('rain', 'Дождь', 'rain', '/themes/rain.webp', '', 10),
('cyber', 'Неон-сити', 'cyber', '/themes/cyber.webp', 'NOVA NEWS: Магазин открыт — коллекционные значки за Молнии  •  Новые эффекты имени: огонь, неон и радужная обводка  •  Коллекция значков теперь в профиле  •  Nova 1.1.8 уже в RuStore', 20),
('sakura', 'Сакура', 'sakura', '/themes/sakura.webp', '', 30)
ON CONFLICT (id) DO NOTHING;