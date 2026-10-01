// Унифицированная обёртка над Capacitor API.
// Работает и в браузере (фоллбеки на web), и в нативном Android (через Capacitor).
//
// Использование:
//   import { native } from "@/lib/native";
//   if (native.isNative) { ... }
//   await native.haptic.light();
//   await native.share({ title: "Nova", text: "Привет", url: "https://..." });

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Share } from "@capacitor/share";
import { Clipboard } from "@capacitor/clipboard";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import { Device } from "@capacitor/device";
import { Dialog } from "@capacitor/dialog";
import { Browser } from "@capacitor/browser";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Keyboard } from "@capacitor/keyboard";
import { StatusBar, Style } from "@capacitor/status-bar";
import { App } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Badge } from "@capawesome/capacitor-badge";
import { Contacts } from "@capacitor-community/contacts";

const isNative = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform(); // "android" | "ios" | "web"

// ── Хаптика (вибро) ─────────────────────────────────────────────────────────
const haptic = {
  async light() {
    try {
      if (isNative) return await Haptics.impact({ style: ImpactStyle.Light });
      if ("vibrate" in navigator) navigator.vibrate(10);
    } catch { /* ignore */ }
  },
  async medium() {
    try {
      if (isNative) return await Haptics.impact({ style: ImpactStyle.Medium });
      if ("vibrate" in navigator) navigator.vibrate(20);
    } catch { /* ignore */ }
  },
  async heavy() {
    try {
      if (isNative) return await Haptics.impact({ style: ImpactStyle.Heavy });
      if ("vibrate" in navigator) navigator.vibrate(40);
    } catch { /* ignore */ }
  },
  async success() {
    try {
      if (isNative) return await Haptics.notification({ type: NotificationType.Success });
      if ("vibrate" in navigator) navigator.vibrate([10, 50, 10]);
    } catch { /* ignore */ }
  },
  async error() {
    try {
      if (isNative) return await Haptics.notification({ type: NotificationType.Error });
      if ("vibrate" in navigator) navigator.vibrate([20, 60, 20, 60]);
    } catch { /* ignore */ }
  },
};

// ── Системный шаринг ────────────────────────────────────────────────────────
async function share(opts: { title?: string; text?: string; url?: string; dialogTitle?: string }) {
  try {
    if (isNative) {
      await Share.share({
        title: opts.title,
        text: opts.text,
        url: opts.url,
        dialogTitle: opts.dialogTitle,
      });
      return true;
    }
    // Web Share API
    const navAny = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (navAny.share) {
      await navAny.share({ title: opts.title, text: opts.text, url: opts.url });
      return true;
    }
    // Фоллбек — копируем в буфер
    const txt = [opts.title, opts.text, opts.url].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(txt);
    return false;
  } catch {
    return false;
  }
}

// ── Буфер обмена ────────────────────────────────────────────────────────────
const clipboard = {
  async write(text: string) {
    try {
      if (isNative) await Clipboard.write({ string: text });
      else await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },
  async read(): Promise<string> {
    try {
      if (isNative) {
        const r = await Clipboard.read();
        return r.value || "";
      }
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  },
};

// ── Сеть ────────────────────────────────────────────────────────────────────
const network = {
  async status() {
    try {
      if (isNative) {
        const s = await Network.getStatus();
        return { connected: s.connected, type: s.connectionType };
      }
      return { connected: navigator.onLine, type: "unknown" };
    } catch {
      return { connected: true, type: "unknown" };
    }
  },
  onChange(cb: (online: boolean) => void) {
    if (isNative) {
      const sub = Network.addListener("networkStatusChange", s => cb(s.connected));
      return () => { sub.then(s => s.remove()); };
    }
    const on = () => cb(true);
    const off = () => cb(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  },
};

// ── Долговременное хранилище (Preferences вместо localStorage) ──────────────
const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (isNative) {
        const r = await Preferences.get({ key });
        return r.value;
      }
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string) {
    try {
      if (isNative) await Preferences.set({ key, value });
      else localStorage.setItem(key, value);
    } catch { /* ignore */ }
  },
  async remove(key: string) {
    try {
      if (isNative) await Preferences.remove({ key });
      else localStorage.removeItem(key);
    } catch { /* ignore */ }
  },
};

// ── Устройство ──────────────────────────────────────────────────────────────
async function deviceInfo() {
  try {
    if (isNative) return await Device.getInfo();
    return {
      platform: "web",
      model: navigator.userAgent,
      operatingSystem: "web",
      osVersion: "",
      manufacturer: "browser",
      isVirtual: false,
    };
  } catch {
    return null;
  }
}

// ── Диалоги (alert/confirm/prompt) ──────────────────────────────────────────
const dialog = {
  async alert(message: string, title = "Nova") {
    if (isNative) await Dialog.alert({ title, message });
    else window.alert(message);
  },
  async confirm(message: string, title = "Подтверждение"): Promise<boolean> {
    if (isNative) {
      const r = await Dialog.confirm({ title, message });
      return !!r.value;
    }
    return window.confirm(message);
  },
  async prompt(message: string, title = "Ввод", defaultValue = ""): Promise<string | null> {
    if (isNative) {
      const r = await Dialog.prompt({ title, message, inputPlaceholder: defaultValue });
      return r.cancelled ? null : r.value;
    }
    return window.prompt(message, defaultValue);
  },
};

// ── Открыть внешний URL во встроенном браузере ──────────────────────────────
async function openUrl(url: string) {
  try {
    if (isNative) await Browser.open({ url, presentationStyle: "popover" });
    else window.open(url, "_blank", "noopener,noreferrer");
  } catch { /* ignore */ }
}

// ── Камера (фото) ───────────────────────────────────────────────────────────
async function takePhoto(opts?: { source?: "camera" | "gallery"; quality?: number }) {
  if (!isNative) return null;
  try {
    const photo = await Camera.getPhoto({
      quality: opts?.quality ?? 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source:
        opts?.source === "gallery" ? CameraSource.Photos :
          opts?.source === "camera" ? CameraSource.Camera : CameraSource.Prompt,
    });
    return photo.dataUrl || null;
  } catch {
    return null;
  }
}

// ── Клавиатура (только нативно) ─────────────────────────────────────────────
const keyboard = {
  async hide() { if (isNative) try { await Keyboard.hide(); } catch { /* ignore */ } },
  async show() { if (isNative) try { await Keyboard.show(); } catch { /* ignore */ } },
};

// ── Статус-бар ──────────────────────────────────────────────────────────────
const statusBar = {
  async setDark() {
    if (!isNative) return;
    try { await StatusBar.setStyle({ style: Style.Dark }); } catch { /* ignore */ }
  },
  async setLight() {
    if (!isNative) return;
    try { await StatusBar.setStyle({ style: Style.Light }); } catch { /* ignore */ }
  },
  async setColor(hex: string) {
    if (!isNative) return;
    try { await StatusBar.setBackgroundColor({ color: hex }); } catch { /* ignore */ }
  },
};

// ── Push-уведомления (FCM на Android) ───────────────────────────────────────
// FCM требует google-services.json в сборке. Пока его нет, обращение к
// PushNotifications падает на нативном уровне (JS try/catch такое не ловит и
// приложение аварийно закрывается). Включаем только когда Firebase подключён.
const FCM_ENABLED = Object.keys(import.meta.glob("/android/app/google-services.json")).length > 0;

let pushTokenCache: string | null = null;

const push = {
  enabled: FCM_ENABLED,
  get token() { return pushTokenCache; },
  async register(onToken: (token: string) => void, onMessage?: (data: unknown) => void, onTap?: (data: Record<string, string>) => void) {
    if (!isNative || !FCM_ENABLED) return;
    try {
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== "granted") return;
      try {
        await PushNotifications.createChannel({
          id: "messages", name: "Сообщения", description: "Новые сообщения",
          importance: 4, visibility: 1, sound: "default", vibration: true, lights: true, lightColor: "#8b5cf6",
        });
        await PushNotifications.createChannel({
          id: "calls", name: "Звонки", description: "Входящие звонки",
          importance: 5, visibility: 1, sound: "default", vibration: true, lights: true, lightColor: "#8b5cf6",
        });
      } catch { /* ignore */ }
      await PushNotifications.removeAllListeners();
      PushNotifications.addListener("registration", t => { pushTokenCache = t.value; onToken(t.value); });
      if (onMessage) PushNotifications.addListener("pushNotificationReceived", n => onMessage(n));
      PushNotifications.addListener("pushNotificationActionPerformed", a => {
        const data = (a.notification?.data || {}) as Record<string, string>;
        onTap?.(data);
      });
      await PushNotifications.register();
    } catch { /* ignore */ }
  },
};

// ── Локальные уведомления (бейдж, alarm) ────────────────────────────────────
const localNotify = {
  async show(title: string, body: string, id = Math.floor(Math.random() * 1_000_000)) {
    try {
      if (isNative) {
        await LocalNotifications.requestPermissions();
        await LocalNotifications.schedule({
          notifications: [{ id, title, body, schedule: { at: new Date(Date.now() + 100) } }],
        });
        return;
      }
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    } catch { /* ignore */ }
  },
};

// ── Счётчик на иконке приложения ────────────────────────────────────────────
let lastBadge = -1;
const badge = {
  async set(count: number) {
    const n = Math.max(0, Math.floor(count || 0));
    if (n === lastBadge) return;
    lastBadge = n;
    try {
      if (isNative) {
        if (n > 0) await Badge.set({ count: n }); else await Badge.clear();
        return;
      }
      const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
      if (n > 0) await nav.setAppBadge?.(n); else await nav.clearAppBadge?.();
    } catch { /* ignore */ }
  },
};

// ── Телефонная книга (только в приложении) ─────────────────────────────────
const phoneContacts = {
  supported: isNative,
  async read(): Promise<{ items: { phone: string; name?: string }[]; denied: boolean }> {
    if (!isNative) return { items: [], denied: false };
    try {
      let perm = await Contacts.checkPermissions();
      if (perm.contacts !== "granted") perm = await Contacts.requestPermissions();
      if (perm.contacts !== "granted") return { items: [], denied: true };
      const res = await Contacts.getContacts({ projection: { name: true, phones: true } });
      const items: { phone: string; name?: string }[] = [];
      for (const c of res.contacts || []) {
        const nm = c.name?.display || [c.name?.given, c.name?.family].filter(Boolean).join(" ") || undefined;
        for (const p of c.phones || []) {
          const num = (p.number || "").replace(/[^\d+]/g, "");
          if (num.length >= 10) items.push({ phone: num, name: nm });
        }
      }
      return { items, denied: false };
    } catch {
      return { items: [], denied: false };
    }
  },
};

// ── App lifecycle ───────────────────────────────────────────────────────────
const app = {
  async exit() { if (isNative) try { await App.exitApp(); } catch { /* ignore */ } },
  onBackButton(cb: () => void) {
    if (isNative) {
      const sub = App.addListener("backButton", cb);
      return () => { sub.then(s => s.remove()); };
    }
    return () => { /* noop */ };
  },
  onPause(cb: () => void) {
    if (isNative) {
      const sub = App.addListener("pause", cb);
      return () => { sub.then(s => s.remove()); };
    }
    const onHide = () => { if (document.visibilityState === "hidden") cb(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  },
  onUrlOpen(cb: (url: string) => void) {
    if (!isNative) return () => { /* noop */ };
    const sub = App.addListener("appUrlOpen", e => { if (e?.url) cb(e.url); });
    App.getLaunchUrl().then(r => { if (r?.url) cb(r.url); }).catch(() => { /* ignore */ });
    return () => { sub.then(s => s.remove()); };
  },
  onResume(cb: () => void) {
    if (isNative) {
      const sub = App.addListener("resume", cb);
      return () => { sub.then(s => s.remove()); };
    }
    const onShow = () => { if (document.visibilityState === "visible") cb(); };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  },
};

export const native = {
  isNative,
  platform,
  haptic,
  share,
  clipboard,
  network,
  storage,
  deviceInfo,
  dialog,
  openUrl,
  takePhoto,
  keyboard,
  statusBar,
  push,
  localNotify,
  badge,
  phoneContacts,
  app,
};

export default native;