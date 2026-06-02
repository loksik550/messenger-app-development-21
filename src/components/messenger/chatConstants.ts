// Магические числа/строки чата в одном месте.
// Вынесено из ChatComponents.tsx для читаемости и переиспользования.

export const SCROLL_NEAR_BOTTOM_PX = 120;
export const SCROLL_SHOW_DOWN_PX = 200;
export const SCROLL_RESET_NEW_PX = 50;
export const TYPING_THROTTLE_MS = 3000;

export const MEDIA_PLACEHOLDERS = ["📷 Фото", "🎥 Видео", "🎵 Голосовое"] as const;

export const isMediaPlaceholder = (text: string): boolean =>
  (MEDIA_PLACEHOLDERS as readonly string[]).includes(text) || text.startsWith("📎");
