export const NAME_ERROR = "Имя может содержать только буквы — без точек, тире, цифр и других символов";

export function filterNameInput(v: string): string {
  return v.replace(/[^A-Za-zА-Яа-яЁё ]/g, "").replace(/ {2,}/g, " ").replace(/^ /, "").slice(0, 40);
}

export function nameError(raw: string): string | null {
  const n = raw.trim();
  if (n.length < 2) return "Имя слишком короткое";
  if (!/^[A-Za-zА-Яа-яЁё]+( [A-Za-zА-Яа-яЁё]+)*$/.test(n)) return NAME_ERROR;
  return gibberishError(n);
}

const VOWELS = /[аеёиоуыэюяaeiouy]/;

export function gibberishError(name: string): string | null {
  for (const word of name.split(" ").filter(Boolean)) {
    const w = word.toLowerCase();
    if (w.length > 15) return "Слово в имени слишком длинное — не больше 15 букв";
    if (/(.)\1\1/.test(w)) return "Имя не должно состоять из повторяющихся букв";
    if (/(..+?)\1\1/.test(w)) return "Имя не должно состоять из повторяющихся слогов";
    if (w.length >= 4 && !VOWELS.test(w)) return "Похоже на случайный набор букв. Укажите настоящее имя";
    if (w.length >= 6 && new Set(w).size <= 2) return "Похоже на случайный набор букв. Укажите настоящее имя";
  }
  return null;
}
