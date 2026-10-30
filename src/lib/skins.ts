import { api } from "@/lib/api";

export type SkinId = "rain" | "cyber" | "sakura";

export const SKINS: { id: SkinId; name: string; desc: string; preview: string }[] = [
  { id: "rain", name: "Дождь", desc: "Матовое стекло и капли на фоне вокзала", preview: "/themes/rain.webp" },
  { id: "cyber", name: "Неон-сити", desc: "Жёлтые неоновые акценты и ночной город", preview: "/themes/cyber.webp" },
  { id: "sakura", name: "Сакура", desc: "Светлая пастельная тема со свечами", preview: "/themes/sakura.webp" },
];

const KEY = "nova_skin";
const ALL = SKINS.map((s) => `skin-${s.id}`);

export function getStoredSkin(): SkinId | null {
  try {
    const v = localStorage.getItem(KEY);
    return SKINS.some((s) => s.id === v) ? (v as SkinId) : null;
  } catch { return null; }
}

export function applySkin(id: SkinId | null) {
  const root = document.documentElement;
  ALL.forEach((c) => root.classList.remove(c));
  if (id) root.classList.add(`skin-${id}`);
  try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); } catch { /* ignore */ }
}

const access = new Map<number, Promise<boolean>>();

/** Доступ к тестовым темам выдаётся в Dev-панели. Проверяем один раз за запуск приложения. */
export function checkSkinAccess(userId: number): Promise<boolean> {
  let p = access.get(userId);
  if (!p) {
    p = api("test_themes_access", {}, userId).then((r) => !!r?.allowed).catch(() => false);
    access.set(userId, p);
  }
  return p;
}
