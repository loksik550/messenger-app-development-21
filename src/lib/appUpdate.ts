import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export const RUSTORE_URL = "https://www.rustore.ru/catalog/app/ru.nova.messenger";

interface NovaUpdatePlugin {
  check(): Promise<{ available: boolean; downloaded: boolean; versionCode: number }>;
  start(): Promise<void>;
  complete(): Promise<void>;
  addListener(event: "state", cb: (s: { status: "pending" | "downloading" | "downloaded" | "failed"; progress: number }) => void): Promise<PluginListenerHandle>;
}

export const NovaUpdate = registerPlugin<NovaUpdatePlugin>("NovaUpdate");

/** Есть ли в установленном приложении модуль обновления внутри (появился в 1.1.8). */
export function hasInAppUpdate() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("NovaUpdate");
}

/** Сравнение версий вида 1.1.8: >0 если a новее b. */
export function cmpVersion(a: string, b: string) {
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
