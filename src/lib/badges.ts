export type Rarity = "legendary" | "epic" | "rare" | "common";

export const RARITY: Record<Rarity, { label: string; color: string; glow: string }> = {
  legendary: { label: "Легендарный", color: "#fbbf24", glow: "#f59e0b" },
  epic: { label: "Эпический", color: "#c084fc", glow: "#a855f7" },
  rare: { label: "Редкий", color: "#38bdf8", glow: "#0ea5e9" },
  common: { label: "Обычный", color: "#94a3b8", glow: "#64748b" },
};

export const BADGE_TITLES: Record<string, string> = {
  star: "Звезда Nova", legend: "Легенда", crown: "Корона", champion: "Чемпион",
  crystal: "Кристалл", cosmos: "Космос", first1000: "Первые 1000", lightning: "Молния",
  sakura: "Сакура", heart: "Сердце", winter: "Зима 2026", pro: "Nova Pro",
  verified: "Подтверждён", streak: "Серия 30 дней", beta: "Бета-тестер", dev: "Разработчик", voice: "Голос",
};

export const badgeSrc = (code: string) => `/badges/${code}.svg`;
export const isKnownBadge = (code: string) => code in BADGE_TITLES;

export const BADGE_RARITY: Record<string, Rarity> = {
  star: "legendary", legend: "legendary", crown: "legendary", champion: "legendary",
  crystal: "epic", cosmos: "epic", first1000: "epic", pro: "epic",
  lightning: "rare", sakura: "rare", verified: "rare", streak: "rare", beta: "rare", dev: "rare",
  heart: "common", winter: "common", voice: "common",
};

export const BADGE_DESC: Record<string, string> = {
  star: "Самый редкий коллекционный значок Nova — всего 100 экземпляров",
  legend: "Коллекционный значок для настоящих легенд",
  crown: "Королевский коллекционный значок",
  champion: "Значок победителя",
  crystal: "Чистый и редкий коллекционный значок",
  cosmos: "Значок для мечтателей",
  first1000: "Один из первых 1000 пользователей Nova",
  lightning: "Быстрый как молния",
  sakura: "Весенний значок",
  heart: "С любовью",
  winter: "Сезонный значок зимы 2026",
  pro: "Подписчик Nova Pro — поддерживает развитие мессенджера",
  verified: "Личность подтверждена командой Nova",
  streak: "Заходил в Nova 30 дней подряд",
  beta: "Помогал тестировать новые функции Nova до релиза",
  dev: "Участник команды разработки Nova",
  voice: "Провёл 10 звонков в Nova",
};
