export const NAME_ERROR = "Имя может содержать только буквы — без точек, тире, цифр и других символов";

export function filterNameInput(v: string): string {
  return v.replace(/[^A-Za-zА-Яа-яЁё ]/g, "").replace(/ {2,}/g, " ").replace(/^ /, "").slice(0, 40);
}

export function nameError(raw: string): string | null {
  const n = raw.trim();
  if (n.length < 2) return "Имя слишком короткое";
  if (!/^[A-Za-zА-Яа-яЁё]+( [A-Za-zА-Яа-яЁё]+)*$/.test(n)) return NAME_ERROR;
  return null;
}
