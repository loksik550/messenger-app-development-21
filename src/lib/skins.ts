import { api } from "@/lib/api";

export type SkinBase = "rain" | "cyber" | "sakura";
export interface Skin { id: string; name: string; base: SkinBase; image: string; ticker: string }

export const SKIN_BASES: { id: SkinBase; name: string; desc: string }[] = [
  { id: "rain", name: "Стекло", desc: "Матовое стекло поверх фона" },
  { id: "cyber", name: "Неон", desc: "Жёлтые неоновые акценты, тёмные плашки" },
  { id: "sakura", name: "Пастель", desc: "Светлая тема с изящным шрифтом" },
];

const KEY = "nova_skin";
const BASES: SkinBase[] = ["rain", "cyber", "sakura"];

export function getStoredSkinId(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/** Включает тему: класс стиля на <html> + картинка фона через CSS-переменную. */
export function applySkin(skin: Skin | null) {
  const root = document.documentElement;
  BASES.forEach((b) => root.classList.remove(`skin-${b}`));
  if (skin) {
    root.classList.add(`skin-${skin.base}`);
    root.style.setProperty("--skin-img", `url("${skin.image.replace(/"/g, "")}")`);
  } else {
    root.style.removeProperty("--skin-img");
  }
  try { skin ? localStorage.setItem(KEY, skin.id) : localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("nova:skin", { detail: skin }));
}

const access = new Map<number, Promise<{ allowed: boolean; skins: Skin[] }>>();

/** Доступ к тестовым темам и их список — выдаётся в Dev-панели. Проверяем один раз за запуск. */
export function loadSkins(userId: number, force = false) {
  let p = access.get(userId);
  if (!p || force) {
    p = api("test_themes_access", {}, userId)
      .then((r) => ({ allowed: !!r?.allowed, skins: (r?.skins as Skin[]) || [] }))
      .catch(() => ({ allowed: false, skins: [] as Skin[] }));
    access.set(userId, p);
  }
  return p;
}
