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
