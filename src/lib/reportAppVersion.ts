import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { api } from "@/lib/api";
import { APP_VERSION } from "@/lib/version";

const KEY = "nova_reported_version";

export async function reportAppVersion(userId: number) {
  try {
    const native = Capacitor.isNativePlatform();
    const version = native ? (await App.getInfo()).version : APP_VERSION;
    const platform = native ? Capacitor.getPlatform() : "web";
    const sig = `${userId}:${platform}:${version}`;
    const last = JSON.parse(localStorage.getItem(KEY) || "null") as { sig: string; at: number } | null;
    if (last && last.sig === sig && Date.now() - last.at < 12 * 3600 * 1000) return;
    await api("report_version", { version, platform }, userId);
    localStorage.setItem(KEY, JSON.stringify({ sig, at: Date.now() }));
  } catch { /* не критично */ }
}
