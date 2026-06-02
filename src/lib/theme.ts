export type ThemeId = "dark" | "midnight" | "violet" | "ocean" | "sunset" | "forest" | "rose" | "light";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  preview: string; // tailwind gradient classes
  pro?: boolean;   // требует Nova Pro
}

export const THEMES_META: ThemeMeta[] = [
  { id: "dark",     name: "Тёмная",   preview: "from-zinc-900 to-zinc-800" },
  { id: "midnight", name: "Полночь",  preview: "from-slate-900 to-indigo-950" },
  { id: "violet",   name: "Фиолет",   preview: "from-violet-900 to-fuchsia-900" },
  { id: "ocean",    name: "Океан",    preview: "from-sky-900 to-cyan-700", pro: true },
  { id: "sunset",   name: "Закат",    preview: "from-orange-700 via-pink-700 to-rose-900", pro: true },
  { id: "forest",   name: "Лес",      preview: "from-emerald-900 to-teal-800", pro: true },
  { id: "rose",     name: "Роза",     preview: "from-rose-700 to-pink-900", pro: true },
  { id: "light",    name: "Светлая",  preview: "from-zinc-200 to-zinc-100" },
];

const THEMES: ThemeId[] = THEMES_META.map(t => t.id);

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEMES as string[]).includes(v);
}

export function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem("nova_theme");
    return isThemeId(v) ? v : "dark";
  } catch {
    return "dark";
  }
}

export function getStoredFontSize(): number {
  try {
    const n = Number(localStorage.getItem("nova_font_size"));
    return Number.isFinite(n) && n >= 12 && n <= 24 ? n : 16;
  } catch {
    return 16;
  }
}

export function applyTheme(theme: ThemeId, fontSize?: number) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  THEMES.forEach(t => root.classList.remove(`theme-${t}`));
  root.classList.add(`theme-${theme}`);
  if (typeof fontSize === "number") {
    root.style.fontSize = `${fontSize}px`;
  }
  try { localStorage.setItem("nova_theme", theme); } catch { /* ignore */ }
}

export function applyFontSize(size: number) {
  document.documentElement.style.fontSize = `${size}px`;
  try { localStorage.setItem("nova_font_size", String(size)); } catch { /* ignore */ }
}

function hexToHslTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hh = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hh = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hh = (b - r) / d + 2; break;
      case b: hh = (r - g) / d + 4; break;
    }
    hh /= 6;
  }
  return `${Math.round(hh * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Затемнить/осветлить hex на заданный процент (-100..100)
function shadeHex(hex: string, percent: number): string {
  const h = hex.replace("#", "");
  let r = parseInt(h.slice(0, 2), 16);
  let g = parseInt(h.slice(2, 4), 16);
  let b = parseInt(h.slice(4, 6), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  r = Math.round((t - r) * p) + r;
  g = Math.round((t - g) * p) + g;
  b = Math.round((t - b) * p) + b;
  const to2 = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

export function applyAccent(hex: string) {
  const triplet = hexToHslTriplet(hex);
  const root = document.documentElement;
  root.style.setProperty("--primary", triplet);
  root.style.setProperty("--ring", triplet);
  root.style.setProperty("--accent-color", hex);
  // Градиенты кнопок и исходящих сообщений строим от выбранного акцента,
  // иначе выбор цвета не виден (кнопки используют --grad-primary).
  const light = shadeHex(hex, 18);
  const dark = shadeHex(hex, -22);
  root.style.setProperty("--grad-primary", `linear-gradient(135deg, ${dark} 0%, ${hex} 55%, ${light} 100%)`);
  root.style.setProperty("--grad-msg-out", `linear-gradient(135deg, ${dark} 0%, ${hex} 100%)`);
  try { localStorage.setItem("nova_accent_hex", hex); } catch { /* ignore */ }
}

export function getStoredAccentHex(): string | null {
  try { return localStorage.getItem("nova_accent_hex"); } catch { return null; }
}

// ─── Стиль сообщений (форма «бабблов») ───────────────────────────────────
export type BubbleStyle = "default" | "rounded" | "minimal";
const BUBBLE_STYLES: BubbleStyle[] = ["default", "rounded", "minimal"];

export function applyBubbleStyle(style: string) {
  const root = document.documentElement;
  BUBBLE_STYLES.forEach(s => root.classList.remove(`bubble-${s}`));
  const valid = (BUBBLE_STYLES as string[]).includes(style) ? style : "default";
  root.classList.add(`bubble-${valid}`);
  try { localStorage.setItem("nova_bubble_style", valid); } catch { /* ignore */ }
}

export function getStoredBubbleStyle(): string {
  try { return localStorage.getItem("nova_bubble_style") || "default"; } catch { return "default"; }
}

// ─── Авто-переключение темы ──────────────────────────────────────────────
export type AutoMode = "off" | "system" | "schedule";

export interface AutoConfig {
  mode: AutoMode;
  dayTheme: ThemeId;
  nightTheme: ThemeId;
  startHour: number; // час перехода в ночную (0..23)
  endHour: number;   // час перехода в дневную (0..23)
}

const AUTO_KEY = "nova_auto_theme";

export function getStoredAutoConfig(): AutoConfig {
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    if (raw) {
      const v = JSON.parse(raw) as AutoConfig;
      if (v && typeof v === "object" && "mode" in v) return v;
    }
  } catch { /* ignore */ }
  return { mode: "off", dayTheme: "light", nightTheme: "midnight", startHour: 22, endHour: 7 };
}

export function setStoredAutoConfig(cfg: AutoConfig) {
  try { localStorage.setItem(AUTO_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}

export function isNightNow(cfg: AutoConfig): boolean {
  const h = new Date().getHours();
  const { startHour, endHour } = cfg;
  if (startHour === endHour) return false;
  if (startHour < endHour) return h >= startHour && h < endHour;
  // переход через полночь (например 22 -> 7)
  return h >= startHour || h < endHour;
}

let autoTimer: ReturnType<typeof setInterval> | null = null;
let autoMql: MediaQueryList | null = null;
let autoMqlHandler: ((e: MediaQueryListEvent) => void) | null = null;

function applyAutoOnce(cfg: AutoConfig) {
  if (cfg.mode === "off") return;
  let target: ThemeId;
  if (cfg.mode === "system") {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    target = prefersDark ? cfg.nightTheme : cfg.dayTheme;
  } else {
    target = isNightNow(cfg) ? cfg.nightTheme : cfg.dayTheme;
  }
  if (getStoredTheme() !== target) applyTheme(target, getStoredFontSize());
}

export function startAutoTheme(cfg: AutoConfig) {
  stopAutoTheme();
  if (cfg.mode === "off") return;
  applyAutoOnce(cfg);
  if (cfg.mode === "schedule") {
    autoTimer = setInterval(() => applyAutoOnce(cfg), 60_000);
  } else if (cfg.mode === "system" && window.matchMedia) {
    autoMql = window.matchMedia("(prefers-color-scheme: dark)");
    autoMqlHandler = () => applyAutoOnce(cfg);
    autoMql.addEventListener?.("change", autoMqlHandler);
  }
}

export function stopAutoTheme() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  if (autoMql && autoMqlHandler) {
    autoMql.removeEventListener?.("change", autoMqlHandler);
    autoMql = null; autoMqlHandler = null;
  }
}