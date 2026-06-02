// Чистые утилиты профиля. Вынесено из Panels.tsx для уменьшения размера.

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const BD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Дата рождения в читаемом виде, либо "Не указана". */
export function formatBirthdate(iso?: string | null): string {
  if (!iso) return "Не указана";
  const m = BD_RE.exec(iso);
  if (!m) return "Не указана";
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return "Не указана";
  return `${day} ${MONTHS_RU[month - 1]} ${year} г.`;
}

/** Возраст по дате рождения, либо null если дата некорректна. */
export function calcAge(iso?: string | null): number | null {
  if (!iso) return null;
  const m = BD_RE.exec(iso);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (year < 1900 || year > 2100) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  const dm = now.getMonth() + 1 - month;
  if (dm < 0 || (dm === 0 && now.getDate() < day)) age--;
  if (age < 0 || age > 150) return null;
  return age;
}

/** Разбор ISO-даты в день/месяц/год (с дефолтом 01.01.2000). */
export function parseBd(iso?: string | null): { d: number; mo: number; y: number } {
  const m = iso ? BD_RE.exec(iso) : null;
  return m ? { d: parseInt(m[3]), mo: parseInt(m[2]), y: parseInt(m[1]) } : { d: 1, mo: 1, y: 2000 };
}

/** Форматирование российского номера телефона. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
  return phone;
}
