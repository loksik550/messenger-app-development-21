// Сквозное шифрование личных чатов.
// Ключи создаются на устройстве и никогда его не покидают (WebCrypto, неизвлекаемые
// закрытые ключи в IndexedDB). На сервер уходит только публичная часть.
// Сообщение: случайный ключ AES-256-GCM → шифрует текст; ключ упаковывается для
// каждого устройства собеседника и своих устройств через одноразовый ECDH P-256
// + HKDF-SHA-256; весь конверт подписывается ECDSA P-256 ключом устройства отправителя.
import { api } from "@/lib/api";

const DB = "nova_e2e";
const STORE = "keys";
const LS_DEV = "nova_e2e_device";
const LS_PINS = "nova_e2e_pins_";
const LS_STRICT = "nova_e2e_strict_";
const INFO = "nova-e2e-v1";

export const ENC_PLACEHOLDER = "🔒 Зашифрованное сообщение";

interface DeviceKeys {
  dev: string;
  ePriv: CryptoKey;
  sPriv: CryptoKey;
  pub: string;
}

interface DirDevice { id: string; pub: string; name: string; created_at: number; revoked: boolean }
interface Directory { me: number; partner_id: number; e2e: boolean; devices: Record<string, DirDevice[]>; at: number }

interface Envelope {
  v: 1;
  su: number;
  sd: string;
  c: number;
  ep: string;
  iv: string;
  ct: string;
  k: Record<string, { iv: string; w: string }>;
  sg: string;
}

export type DecryptState = "ok" | "nokey" | "bad";

const te = new TextEncoder();
const td = new TextDecoder();

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function e2eSupported(): boolean {
  return typeof window !== "undefined" && !!window.crypto?.subtle && typeof indexedDB !== "undefined";
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}
async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function deviceName(): string {
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return (window as unknown as { Capacitor?: unknown }).Capacitor ? "Приложение Android" : "Браузер Android";
  if (/iPhone|iPad/i.test(ua)) return "iPhone";
  if (/Windows/i.test(ua)) return "Компьютер Windows";
  if (/Mac OS/i.test(ua)) return "Компьютер Mac";
  return "Браузер";
}

const keysCache = new Map<number, Promise<DeviceKeys | null>>();

async function createKeys(userId: number): Promise<DeviceKeys> {
  const e = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const s = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const pub = JSON.stringify({
    e: b64(await crypto.subtle.exportKey("spki", e.publicKey)),
    s: b64(await crypto.subtle.exportKey("spki", s.publicKey)),
  });
  const rnd = crypto.getRandomValues(new Uint8Array(12));
  const dev = Array.from(rnd, (x) => x.toString(16).padStart(2, "0")).join("");
  const keys: DeviceKeys = { dev, ePriv: e.privateKey, sPriv: s.privateKey, pub };
  await idbPut(`u${userId}`, keys);
  return keys;
}

async function loadKeys(userId: number): Promise<DeviceKeys | null> {
  if (!e2eSupported()) return null;
  let keys = await idbGet<DeviceKeys>(`u${userId}`).catch(() => undefined);
  if (!keys) keys = await createKeys(userId);
  const r = await api("e2e_register", { device_id: keys.dev, pub: keys.pub, name: deviceName() }, userId);
  if (r?.error && /другим ключом/.test(r.error)) {
    keys = await createKeys(userId);
    await api("e2e_register", { device_id: keys.dev, pub: keys.pub, name: deviceName() }, userId);
  } else if (r?.error) {
    throw new Error(r.error);
  }
  try { localStorage.setItem(LS_DEV, keys.dev); } catch { /* ignore */ }
  return keys;
}

export function ensureDevice(userId: number): Promise<DeviceKeys | null> {
  let p = keysCache.get(userId);
  if (!p) {
    p = loadKeys(userId).catch((e) => { keysCache.delete(userId); throw e; });
    keysCache.set(userId, p);
  }
  return p;
}

export async function myDeviceFingerprint(userId: number): Promise<string | null> {
  const k = await ensureDevice(userId).catch(() => null);
  if (!k) return null;
  return groupDigits(await crypto.subtle.digest("SHA-256", te.encode(k.pub)), 6);
}

// ── Каталог ключей собеседников + защита от подмены ─────────────────────────
const dirCache = new Map<number, Directory>();

function readPins(me: number): Record<string, Record<string, string>> {
  try { return JSON.parse(localStorage.getItem(LS_PINS + me) || "{}"); } catch { return {}; }
}
function writePins(me: number, pins: Record<string, Record<string, string>>) {
  try { localStorage.setItem(LS_PINS + me, JSON.stringify(pins)); } catch { /* ignore */ }
}

export interface ChatSecurity {
  encrypted: boolean;
  reason?: "partner_old_app" | "service" | "unsupported";
  newDevices: string[];
  conflicts: string[];
}

async function getDirectory(chatId: number, userId: number, fresh = false): Promise<Directory> {
  const c = dirCache.get(chatId);
  if (c && !fresh && Date.now() - c.at < 60_000) return c;
  const r = await api("e2e_chat_devices", { chat_id: chatId }, userId);
  if (!r || r.error || !r.devices) throw new Error(r?.error || "Нет связи");
  const d: Directory = { ...(r as Omit<Directory, "at">), at: Date.now() };
  dirCache.set(chatId, d);
  return d;
}

function trustedDevices(d: Directory, uid: number, me: number, includeRevoked: boolean): { list: DirDevice[]; conflicts: string[]; fresh: string[] } {
  const pins = readPins(me);
  const pinned = pins[String(uid)] || {};
  const list: DirDevice[] = [];
  const conflicts: string[] = [];
  const fresh: string[] = [];
  for (const dev of d.devices[String(uid)] || []) {
    if (pinned[dev.id] && pinned[dev.id] !== dev.pub) { conflicts.push(dev.name || dev.id); continue; }
    if (!dev.revoked || includeRevoked) list.push(dev);
    if (!pinned[dev.id] && !dev.revoked) fresh.push(dev.name || dev.id);
  }
  return { list, conflicts, fresh };
}

function pinAll(d: Directory, me: number) {
  const pins = readPins(me);
  for (const [uid, devs] of Object.entries(d.devices)) {
    pins[uid] = pins[uid] || {};
    for (const dev of devs) if (!pins[uid][dev.id]) pins[uid][dev.id] = dev.pub;
  }
  writePins(me, pins);
}

export async function chatSecurity(chatId: number, userId: number, fresh = false): Promise<ChatSecurity> {
  if (!e2eSupported()) return { encrypted: false, reason: "unsupported", newDevices: [], conflicts: [] };
  await ensureDevice(userId);
  const d = await getDirectory(chatId, userId, fresh);
  if (!d.e2e) return { encrypted: false, reason: "service", newDevices: [], conflicts: [] };
  const p = trustedDevices(d, d.partner_id, userId, false);
  const strict = localStorage.getItem(LS_STRICT + chatId) === "1";
  if (!p.list.length && !strict) return { encrypted: false, reason: "partner_old_app", newDevices: [], conflicts: p.conflicts };
  return { encrypted: true, newDevices: p.fresh, conflicts: p.conflicts };
}

// ── Код безопасности (одинаковый у обоих собеседников) ──────────────────────
function groupDigits(buf: ArrayBuffer, groups: number): string {
  const b = new Uint8Array(buf);
  const out: string[] = [];
  for (let i = 0; i < groups; i++) {
    const n = ((b[i * 3] << 16) | (b[i * 3 + 1] << 8) | b[i * 3 + 2]) % 100000;
    out.push(String(n).padStart(5, "0"));
  }
  return out.join(" ");
}

export async function safetyCode(chatId: number, userId: number): Promise<{ code: string; devices: { mine: DirDevice[]; partner: DirDevice[] } }> {
  await ensureDevice(userId);
  const d = await getDirectory(chatId, userId, true);
  const parts: string[] = [];
  for (const uid of [d.me, d.partner_id].sort((a, b) => a - b)) {
    const devs = (d.devices[String(uid)] || []).filter((x) => !x.revoked).map((x) => `${uid}:${x.pub}`).sort();
    parts.push(...devs);
  }
  const code = groupDigits(await crypto.subtle.digest("SHA-256", te.encode(parts.join("|"))), 10);
  return {
    code,
    devices: {
      mine: (d.devices[String(d.me)] || []).filter((x) => !x.revoked),
      partner: (d.devices[String(d.partner_id)] || []).filter((x) => !x.revoked),
    },
  };
}

export function markVerified(chatId: number, userId: number) {
  const d = dirCache.get(chatId);
  if (d) {
    const pins = readPins(userId);
    for (const [uid, devs] of Object.entries(d.devices)) {
      pins[uid] = pins[uid] || {};
      for (const dev of devs) pins[uid][dev.id] = dev.pub;
    }
    writePins(userId, pins);
  }
  try { localStorage.setItem(`nova_e2e_verified_${userId}_${chatId}`, String(Date.now())); } catch { /* ignore */ }
}
export function isVerified(chatId: number, userId: number): boolean {
  try { return !!localStorage.getItem(`nova_e2e_verified_${userId}_${chatId}`); } catch { return false; }
}

// ── Криптография ────────────────────────────────────────────────────────────
async function wrapKeyFor(epPriv: CryptoKey, devPubE: string, salt: Uint8Array<ArrayBuffer>, label: string): Promise<CryptoKey> {
  const pub = await crypto.subtle.importKey("spki", unb64(devPubE), { name: "ECDH", namedCurve: "P-256" }, false, []);
  return deriveWrap(epPriv, pub, salt, label);
}
async function deriveWrap(priv: CryptoKey, pub: CryptoKey, salt: Uint8Array<ArrayBuffer>, label: string): Promise<CryptoKey> {
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256);
  const hk = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: te.encode(`${INFO}|${label}`) },
    hk, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

function signedBytes(e: Omit<Envelope, "sg">): Uint8Array<ArrayBuffer> {
  const keys = Object.keys(e.k).sort().map((k) => [k, e.k[k].iv, e.k[k].w]);
  return te.encode(JSON.stringify([e.v, e.su, e.sd, e.c, e.ep, e.iv, e.ct, keys])) as Uint8Array<ArrayBuffer>;
}

export interface MediaKey { k: string; iv: string; mime: string; name: string; size: number }

async function encryptText(chatId: number, userId: number, plain: string, media?: MediaKey): Promise<string | null> {
  const keys = await ensureDevice(userId);
  if (!keys) return null;
  let d = await getDirectory(chatId, userId);
  if (!d.e2e) return null;
  let partner = trustedDevices(d, d.partner_id, userId, false);
  if (!partner.list.length) {
    d = await getDirectory(chatId, userId, true);
    partner = trustedDevices(d, d.partner_id, userId, false);
  }
  const strictKey = LS_STRICT + chatId;
  if (!partner.list.length) {
    if (localStorage.getItem(strictKey) === "1") {
      throw new Error("У собеседника нет защищённых устройств — сообщение не отправлено открытым текстом");
    }
    return null;
  }
  const mine = trustedDevices(d, userId, userId, false).list;
  if (!mine.some((x) => x.id === keys.dev)) mine.push({ id: keys.dev, pub: keys.pub, name: "", created_at: 0, revoked: false });

  const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", k));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: te.encode(`${INFO}|${chatId}`) }, k, te.encode(JSON.stringify(media ? { t: plain, m: media } : { t: plain })));
  const ep = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const epRaw = await crypto.subtle.exportKey("spki", ep.publicKey);

  const wrapped: Envelope["k"] = {};
  const targets: [number, DirDevice][] = [
    ...partner.list.map((x) => [d.partner_id, x] as [number, DirDevice]),
    ...mine.map((x) => [userId, x] as [number, DirDevice]),
  ];
  for (const [uid, dev] of targets) {
    const label = `${uid}:${dev.id}`;
    if (wrapped[label]) continue;
    const pubE = (JSON.parse(dev.pub) as { e: string }).e;
    const wk = await wrapKeyFor(ep.privateKey, pubE, iv, label);
    const wiv = crypto.getRandomValues(new Uint8Array(12));
    const w = await crypto.subtle.encrypt({ name: "AES-GCM", iv: wiv }, wk, raw);
    wrapped[label] = { iv: b64(wiv), w: b64(w) };
  }
  raw.fill(0);
  const env: Omit<Envelope, "sg"> = { v: 1, su: userId, sd: keys.dev, c: chatId, ep: b64(epRaw), iv: b64(iv), ct: b64(ct), k: wrapped };
  const sg = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.sPriv, signedBytes(env));
  pinAll(d, userId);
  try { localStorage.setItem(strictKey, "1"); } catch { /* ignore */ }
  return JSON.stringify({ ...env, sg: b64(sg) });
}

type Plain = { text: string; state: DecryptState; media?: MediaKey };
const plainCache = new Map<string, Plain>();

async function decryptEnvelope(chatId: number, userId: number, senderId: number, enc: string): Promise<Plain> {
  const cacheKey = `${userId}|${chatId}|${senderId}|${enc}`;
  const hit = plainCache.get(cacheKey);
  if (hit) return hit;
  const res = await (async (): Promise<Plain> => {
    let env: Envelope;
    try { env = JSON.parse(enc); } catch { return { text: "⚠️ Повреждённое сообщение", state: "bad" }; }
    if (env.v !== 1 || env.c !== chatId || env.su !== senderId) return { text: "⚠️ Сообщение не прошло проверку подлинности", state: "bad" };
    const keys = await ensureDevice(userId);
    if (!keys) return { text: "🔒 Это устройство не поддерживает шифрование", state: "nokey" };
    const mineLabel = `${userId}:${keys.dev}`;
    const entry = env.k[mineLabel];
    if (!entry) return { text: "🔒 Сообщение отправлено до входа на этом устройстве", state: "nokey" };
    let d = await getDirectory(chatId, userId);
    let sender = trustedDevices(d, senderId, userId, true);
    let dev = sender.list.find((x) => x.id === env.sd);
    if (!dev) {
      d = await getDirectory(chatId, userId, true);
      sender = trustedDevices(d, senderId, userId, true);
      dev = sender.list.find((x) => x.id === env.sd);
    }
    if (!dev) return { text: "⚠️ Не удалось проверить отправителя", state: "bad" };
    const sPub = await crypto.subtle.importKey("spki", unb64((JSON.parse(dev.pub) as { s: string }).s), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const { sg, ...rest } = env;
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, sPub, unb64(sg), signedBytes(rest));
    if (!valid) return { text: "⚠️ Сообщение не прошло проверку подлинности", state: "bad" };
    try {
      const ep = await crypto.subtle.importKey("spki", unb64(env.ep), { name: "ECDH", namedCurve: "P-256" }, false, []);
      const wk = await deriveWrap(keys.ePriv, ep, unb64(env.iv), mineLabel);
      const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(entry.iv) }, wk, unb64(entry.w));
      const k = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(env.iv), additionalData: te.encode(`${INFO}|${chatId}`) }, k, unb64(env.ct));
      const obj = JSON.parse(td.decode(pt)) as { t?: string; m?: MediaKey };
      return { text: String(obj.t ?? ""), state: "ok", media: obj.m && typeof obj.m.k === "string" ? obj.m : undefined };
    } catch {
      return { text: "⚠️ Не удалось расшифровать сообщение", state: "bad" };
    }
  })().catch(() => ({ text: "🔒 Не удалось расшифровать — проверьте интернет", state: "nokey" as DecryptState }));
  if (res.state !== "nokey" || !/интернет/.test(res.text)) {
    if (plainCache.size > 3000) plainCache.clear();
    plainCache.set(cacheKey, res);
  }
  return res;
}

// ── Перехват запросов (вызывается из api) ───────────────────────────────────
const OUT_ACTIONS = new Set(["send_message", "edit_message", "schedule_message"]);

export function needsOutgoing(action: string, body: Record<string, unknown>): boolean {
  if (action === "send_message" && body.e2e_media && !body.enc) return true;
  if (!OUT_ACTIONS.has(action) || body.enc || !e2eSupported()) return false;
  if (typeof body.text !== "string" || !body.text.trim()) return false;
  if (body.media_url || body.image_url || body.payload) return false;
  if (body.kind && body.kind !== "text") return false;
  return typeof body.chat_id === "number" || (typeof body.chat_id === "string" && /^\d+$/.test(body.chat_id));
}

export async function processOutgoing(body: Record<string, unknown>, userId: number): Promise<Record<string, unknown>> {
  const chatId = Number(body.chat_id);
  if (body.e2e_media) {
    const { e2e_media, text: caption, ...rest } = body;
    const enc = await encryptText(chatId, userId, typeof caption === "string" ? caption : "", e2e_media as MediaKey);
    if (!enc) throw new Error("Не удалось зашифровать файл — сообщение не отправлено открытым текстом");
    return { ...rest, enc };
  }
  const enc = await encryptText(chatId, userId, String(body.text).trim());
  if (!enc) return body;
  const { text: _t, ...rest } = body;
  void _t;
  return { ...rest, enc };
}

interface RawMsg {
  sender_id?: number; text?: string; enc?: string | null; e2e?: DecryptState;
  media_type?: string | null; media_url?: string | null; image_url?: string | null; file_name?: string | null; file_size?: number | null;
  reply_to?: { text?: string; enc?: string | null; sender_name?: string } | null;
}

const MEDIA_LABEL: Record<string, string> = { image: "📷 Фото", video: "🎥 Видео", audio: "🎵 Голосовое", file: "📎 Файл" };

export async function processIncoming(action: string, body: Record<string, unknown>, data: Record<string, unknown>, userId: number) {
  if (!data || !e2eSupported()) return;
  const chatId = Number(body.chat_id);
  if (!chatId) return;
  if (action === "get_messages" && Array.isArray(data.messages)) {
    const list = data.messages as RawMsg[];
    await Promise.all(list.map(async (m) => {
      if (m.enc && m.sender_id) {
        const r = await decryptEnvelope(chatId, userId, m.sender_id, m.enc);
        m.e2e = r.state;
        delete m.enc;
        if (m.media_url) {
          const url = r.media && r.state === "ok" ? await openMedia(m.media_url, r.media).catch(() => null) : null;
          if (url && r.media) {
            m.media_url = url;
            m.image_url = m.media_type === "image" ? url : null;
            m.file_name = r.media.name;
            m.file_size = r.media.size;
            m.text = r.text || MEDIA_LABEL[m.media_type || ""] || "📎 Файл";
          } else {
            m.media_url = null;
            m.image_url = null;
            m.text = r.state === "ok" ? "⚠️ Не удалось загрузить зашифрованный файл" : r.text;
          }
        } else {
          m.text = r.text;
        }
      }
      if (m.reply_to?.enc) {
        const original = list.find((x) => x.enc === m.reply_to?.enc);
        const sid = original?.sender_id;
        if (sid) {
          const r = await decryptEnvelope(chatId, userId, sid, m.reply_to.enc);
          m.reply_to.text = r.text;
        } else {
          m.reply_to.text = await decryptAnySender(chatId, userId, m.reply_to.enc);
        }
        delete m.reply_to.enc;
      }
    }));
  }
  if (action === "get_pinned_message" && data.pinned && typeof data.pinned === "object") {
    const p = data.pinned as RawMsg;
    if (p.enc && p.sender_id) {
      p.text = (await decryptEnvelope(chatId, userId, p.sender_id, p.enc)).text;
      delete p.enc;
    }
  }
}

async function decryptAnySender(chatId: number, userId: number, enc: string): Promise<string> {
  try {
    const su = (JSON.parse(enc) as Envelope).su;
    return (await decryptEnvelope(chatId, userId, su, enc)).text;
  } catch {
    return ENC_PLACEHOLDER;
  }
}


// ── Файлы: шифр AES-256-GCM, ключ файла едет внутри зашифрованного конверта ──
export async function encryptFile(file: Blob, name: string): Promise<{ blob: Blob; key: MediaKey }> {
  const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await file.arrayBuffer();
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, data);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", k));
  const key: MediaKey = { k: b64(raw), iv: b64(iv), mime: (file.type || "application/octet-stream").split(";")[0], name: name.slice(0, 120), size: file.size };
  raw.fill(0);
  return { blob: new Blob([ct], { type: "application/octet-stream" }), key };
}

const mediaCache = new Map<string, Promise<string>>();

async function fetchAndDecrypt(url: string, key: MediaKey): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const k = await crypto.subtle.importKey("raw", unb64(key.k), "AES-GCM", false, ["decrypt"]);
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(key.iv) }, k, buf);
      return URL.createObjectURL(new Blob([pt], { type: key.mime || "application/octet-stream" }));
    } catch (e) {
      lastErr = e;
      if (e instanceof DOMException && e.name === "OperationError") break;
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("decrypt");
}

export function openMedia(url: string, key: MediaKey): Promise<string> {
  const id = `${url}#${key.k}`;
  let p = mediaCache.get(id);
  if (!p) {
    p = fetchAndDecrypt(url, key).catch((e) => { mediaCache.delete(id); throw e; });
    mediaCache.set(id, p);
  }
  return p;
}

export async function canEncryptChat(chatId: number, userId: number): Promise<boolean> {
  try {
    const s = await chatSecurity(chatId, userId);
    return s.encrypted;
  } catch {
    return false;
  }
}
