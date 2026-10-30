import { registerPlugin, Capacitor } from "@capacitor/core";

export interface AppIconDef { id: string; title: string; src: string }

export const APP_ICONS: AppIconDef[] = [
  { id: "classic", title: "Классика", src: "/app-icons/classic.webp" },
  { id: "ocean", title: "Океан", src: "/app-icons/ocean.webp" },
  { id: "sunset", title: "Закат", src: "/app-icons/sunset.webp" },
  { id: "mono", title: "Монохром", src: "/app-icons/mono.webp" },
];

interface NovaAppIconPlugin {
  isSupported(): Promise<{ value: boolean }>;
  change(options: { name: string }): Promise<void>;
}

const NovaAppIcon = registerPlugin<NovaAppIconPlugin>("NovaAppIcon");

/** Поддерживает ли установленная версия приложения смену значка на телефоне. */
export async function appIconSupported(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const r = await NovaAppIcon.isSupported();
    return !!r?.value;
  } catch {
    return false;
  }
}

/** Меняет значок на рабочем столе телефона. false — если версия приложения ещё не умеет. */
export async function applyAppIcon(id: string): Promise<boolean> {
  if (!(await appIconSupported())) return false;
  try {
    await NovaAppIcon.change({ name: id });
    return true;
  } catch {
    return false;
  }
}
