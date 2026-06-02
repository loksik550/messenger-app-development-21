// Утилиты для GroupProfilePanel. Вынесено для уменьшения размера компонента.

/**
 * Текст состояния уведомлений группы (заглушено / на сколько / включено).
 */
export function groupMuteLabel(muted: boolean, mutedUntil: number): string {
  if (!muted) return "Уведомления включены";
  if (!mutedUntil) return "Заглушено навсегда";
  const left = mutedUntil - Math.floor(Date.now() / 1000);
  if (left <= 0) return "Уведомления включены";
  const h = Math.floor(left / 3600);
  if (h >= 24) return `Заглушено ещё ${Math.floor(h / 24)} дн.`;
  if (h >= 1) return `Заглушено ещё ${h} ч.`;
  return `Заглушено ещё ${Math.floor(left / 60)} мин.`;
}
