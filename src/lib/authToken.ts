import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const KEY = "nova_auth_token";
let memo: string | null = null;
const expiredListeners = new Set<() => void>();

try { memo = localStorage.getItem(KEY); } catch { memo = null; }

export function getAuthToken(): string | null {
  return memo;
}

export async function setAuthToken(token: string | null) {
  memo = token;
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  try {
    if (Capacitor.isNativePlatform()) {
      if (token) await Preferences.set({ key: KEY, value: token });
      else await Preferences.remove({ key: KEY });
    }
  } catch { /* ignore */ }
  syncToServiceWorker();
}

export async function restoreAuthToken(): Promise<string | null> {
  if (memo) { syncToServiceWorker(); return memo; }
  try {
    if (Capacitor.isNativePlatform()) {
      const r = await Preferences.get({ key: KEY });
      if (r.value) {
        memo = r.value;
        try { localStorage.setItem(KEY, r.value); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  syncToServiceWorker();
  return memo;
}

export function authHeaders(userId?: number | string | null): Record<string, string> {
  const h: Record<string, string> = {};
  if (userId) {
    h["X-User-Id"] = String(userId);
    if (memo) h["X-Auth-Token"] = memo;
  }
  return h;
}

export function onAuthExpired(cb: () => void) {
  expiredListeners.add(cb);
  return () => { expiredListeners.delete(cb); };
}

let expiredFired = false;
export function reportAuthExpired() {
  if (!memo || expiredFired) return;
  expiredFired = true;
  setTimeout(() => { expiredFired = false; }, 3000);
  expiredListeners.forEach((cb) => cb());
}

function syncToServiceWorker() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const msg = { type: "AUTH_TOKEN", token: memo };
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage(msg)).catch(() => {});
    navigator.serviceWorker.controller?.postMessage(msg);
  } catch { /* ignore */ }
}
