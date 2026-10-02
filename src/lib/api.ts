import { reportNetworkError, reportNetworkOk } from "@/lib/connection";

export const CHAT_API = "https://functions.poehali.dev/b97ade88-cc88-4702-a461-4c386efd5ca3";
export const CHAT_POLL_API = "https://functions.poehali.dev/3fc067b7-d1b3-4aed-8ad9-98df81040f0a";
export const PUSH_API = "https://functions.poehali.dev/c9d141ca-3552-433f-a968-ac1e92da00af";
export const UPLOAD_API = "https://functions.poehali.dev/c0e361f0-438f-44b3-8886-26f5afb7d935";
export const YOOKASSA_PAY_API = "https://functions.poehali.dev/2feb7862-ee04-4945-8549-c0596f30bdc9";
export const SMS_API = "https://functions.poehali.dev/d5b81fb8-fe85-4a15-84a6-cc602997298c";
export const ICE_API = "https://functions.poehali.dev/b47750f2-27d7-416d-9a72-c9b855945258";

// Загружает ICE-серверы (STUN+TURN) для звонков с бэкенда.
// TURN нужен, чтобы голос проходил между устройствами за NAT (мобильный интернет).
const FALLBACK_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: [
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
      "turns:openrelay.metered.ca:443",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: [
      "turn:relay1.expressturn.com:3478",
      "turn:relay1.expressturn.com:3478?transport=tcp",
    ],
    username: "ef2X8ODBQZ8PXHNXQL",
    credential: "ymS3tZmVQ0kR6Xt3",
  },
];
export async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    // Таймаут: если сервер не ответил быстро — не тормозим звонок, берём запасной набор
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(ICE_API, { method: "GET", signal: ctrl.signal });
    clearTimeout(t);
    const data = await res.json();
    if (Array.isArray(data.iceServers) && data.iceServers.length) {
      return data.iceServers as RTCIceServer[];
    }
  } catch { /* сеть/таймаут — используем запасной список */ }
  return FALLBACK_ICE;
}

// Лёгкие polling-эндпоинты вынесены в отдельную функцию chat-poll
const POLL_ACTIONS = new Set(["get_typing", "get_call_signals", "poll_incoming_call", "scheduled_run_due"]);

export interface UploadResult {
  url: string;
  media_type: "image" | "video" | "audio" | "file";
  file_name: string;
  file_size: number;
}

export async function uploadMedia(file: File, userId: number): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        const res = await fetch(UPLOAD_API, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Id": String(userId) },
          body: JSON.stringify({ data: base64, mime: file.type, file_name: file.name, file_size: file.size }),
        });
        if (res.status === 413) { reject(new Error("Файл слишком большой для отправки")); return; }
        if (!res.ok) { reject(new Error(`Ошибка загрузки (${res.status})`)); return; }
        const data = await res.json().catch(() => ({}));
        if (data.url) resolve(data);
        else reject(new Error(data.error || "Ошибка загрузки"));
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file: File, userId: number): Promise<string> {
  const result = await uploadMedia(file, userId);
  return result.url;
}

async function fetchWithRetry(url: string, init: RequestInit, timeoutMs = 15000, retries = 1): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(tid);
      return res;
    } catch (e) {
      clearTimeout(tid);
      lastErr = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Network error");
}

export async function api(action: string, body: Record<string, unknown> = {}, userId?: number) {
  const url = POLL_ACTIONS.has(action) ? CHAT_POLL_API : CHAT_API;
  let res: Response;
  try {
    res = await fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(userId ? { "X-User-Id": String(userId) } : {}) },
      body: JSON.stringify({ action, ...body }),
    });
  } catch (e) {
    reportNetworkError();
    throw e;
  }
  reportNetworkOk();
  if (res.status >= 500) {
    try { await res.text(); } catch { /* ignore */ }
    return { error: "bad_response", status: res.status };
  }
  try {
    return await res.json();
  } catch {
    return { error: "bad_response" };
  }
}

export async function smsApi(action: string, body: Record<string, unknown> = {}) {
  const res = await fetchWithRetry(SMS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  try {
    return await res.json();
  } catch {
    return { error: "bad_response" };
  }
}

export async function pushApi(action: string, body: Record<string, unknown> = {}, userId?: number) {
  const res = await fetchWithRetry(PUSH_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(userId ? { "X-User-Id": String(userId) } : {}) },
    body: JSON.stringify({ action, ...body }),
  });
  try {
    return await res.json();
  } catch {
    return { error: "bad_response" };
  }
}

export function urlBase64ToUint8Array(base64String: string) {
  // Чистим ключ от лишних кавычек, запятых и пробелов (на случай, если
  // VAPID-ключ скопировали с обёрткой из вывода web-push).
  const cleaned = (base64String || "").trim().replace(/^[",\s]+|[",\s]+$/g, "");
  const padding = "=".repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = (cleaned + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Подписка браузера на push. Запрашивает разрешение, пересоздаёт подписку
// под актуальный VAPID-ключ и сохраняет её на сервере.
// Возвращает: "ok" | "denied" | "unsupported" | "error"
export async function subscribeToPush(userId: number): Promise<"ok" | "denied" | "unsupported" | "error"> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return "unsupported";
    }
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return "denied";
    }
    const keyData = await pushApi("vapid_key");
    const publicKey = keyData.public_key;
    if (!publicKey) return "error";

    const reg = await navigator.serviceWorker.ready;
    const appServerKey = urlBase64ToUint8Array(publicKey);
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      const existingKey = existing.options?.applicationServerKey;
      const sameKey = existingKey
        ? new Uint8Array(existingKey).length === appServerKey.length &&
          new Uint8Array(existingKey).every((b, i) => b === appServerKey[i])
        : false;
      if (!sameKey) {
        try { await existing.unsubscribe(); } catch { /* noop */ }
      }
    }
    const current = await reg.pushManager.getSubscription();
    const sub = current || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
    const subJson = sub.toJSON();
    await pushApi("subscribe", {
      endpoint: sub.endpoint,
      p256dh: (subJson.keys as Record<string, string>)?.p256dh || "",
      auth: (subJson.keys as Record<string, string>)?.auth || "",
    }, userId);
    return "ok";
  } catch {
    return "error";
  }
}

// ─── Свой аватар на звонок для контакта (локально, только на этом устройстве) ──
export function getCallAvatar(userId: number): string | null {
  try { return localStorage.getItem(`nova_call_avatar_${userId}`); } catch { return null; }
}
export function setCallAvatar(userId: number, dataUrl: string) {
  try { localStorage.setItem(`nova_call_avatar_${userId}`, dataUrl); } catch { /* quota */ }
}
export function clearCallAvatar(userId: number) {
  try { localStorage.removeItem(`nova_call_avatar_${userId}`); } catch { /* ignore */ }
}
// Читает файл-картинку, сжимает до ~256px и возвращает data-URL (JPEG)
export function fileToCallAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no canvas")); return; }
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("bad image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("read error"));
    reader.readAsDataURL(file);
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

export * from "@/lib/apiTypes";

export function formatLastSeen(lastSeen?: number | null): string {
  if (!lastSeen) return "был(а) недавно";
  const diff = Math.floor(Date.now() / 1000) - lastSeen;
  if (diff < 60) return "в сети";
  if (diff < 3600) { const m = Math.floor(diff / 60); return `был(а) ${m} мин назад`; }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return `был(а) ${h} ч назад`; }
  const d = Math.floor(diff / 86400);
  if (d === 1) return "был(а) вчера";
  if (d < 7) return `был(а) ${d} дн назад`;
  return "был(а) давно";
}

export const AVATAR_GRADS = [
  "from-violet-500 to-indigo-500",
  "from-pink-500 to-rose-400",
  "from-cyan-500 to-blue-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-violet-400 to-purple-600",
  "from-fuchsia-500 to-pink-500",
  "from-sky-400 to-cyan-500",
];

export function avatarGrad(id: number) {
  return AVATAR_GRADS[id % AVATAR_GRADS.length];
}