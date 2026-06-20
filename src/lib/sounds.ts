// Звуки уведомлений и звонков. Web Audio для стандартных, HTMLAudio для кастомных.

export type RingtoneId = "nova" | "classic" | "chime" | "pulse" | "marimba" | "custom";
export type NotifyId = "ping" | "drop" | "pop" | "click" | "soft";

export const RINGTONES: { id: RingtoneId; name: string }[] = [
  { id: "nova",    name: "Nova" },
  { id: "classic", name: "Классика" },
  { id: "chime",   name: "Колокольчики" },
  { id: "pulse",   name: "Пульс" },
  { id: "marimba", name: "Маримба" },
  { id: "custom",  name: "Своя музыка" },
];

export const NOTIFY_SOUNDS: { id: NotifyId; name: string }[] = [
  { id: "ping",  name: "Звон" },
  { id: "drop",  name: "Капля" },
  { id: "pop",   name: "Поп" },
  { id: "click", name: "Клик" },
  { id: "soft",  name: "Мягкий" },
];

const LS_RINGTONE = "nova_ringtone";       // RingtoneId
const LS_NOTIFY   = "nova_notify_sound";   // NotifyId
const LS_VOLUME   = "nova_sound_volume";   // 0..1
const LS_NOTIFY_ON = "nova_sec_notifications"; // "1"|"0"

export function getRingtoneId(): RingtoneId {
  return (localStorage.getItem(LS_RINGTONE) as RingtoneId) || "nova";
}
export function setRingtoneId(id: RingtoneId) { localStorage.setItem(LS_RINGTONE, id); }

export function getNotifyId(): NotifyId {
  return (localStorage.getItem(LS_NOTIFY) as NotifyId) || "ping";
}
export function setNotifyId(id: NotifyId) { localStorage.setItem(LS_NOTIFY, id); }

export function getVolume(): number {
  const v = Number(localStorage.getItem(LS_VOLUME));
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 1.0;
}
export function setVolume(v: number) { localStorage.setItem(LS_VOLUME, String(v)); }

export function isNotifyOn(): boolean {
  return localStorage.getItem(LS_NOTIFY_ON) !== "0";
}

// ─── Custom ringtone (IndexedDB) ──────────────────────────────────────────
const DB_NAME = "nova_audio";
const STORE = "ringtones";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomRingtone(file: File): Promise<{ name: string; size: number }> {
  const db = await openDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, "ringtone");
    tx.objectStore(STORE).put({ name: file.name, size: file.size, type: file.type }, "ringtone_meta");
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  return { name: file.name, size: file.size };
}

export async function getCustomRingtoneBlob(): Promise<Blob | null> {
  try {
    const db = await openDB();
    return await new Promise<Blob | null>((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get("ringtone");
      req.onsuccess = () => res((req.result as Blob) || null);
      req.onerror = () => rej(req.error);
    });
  } catch { return null; }
}

export async function getCustomRingtoneMeta(): Promise<{ name: string; size: number; type: string } | null> {
  try {
    const db = await openDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get("ringtone_meta");
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  } catch { return null; }
}

export async function clearCustomRingtone() {
  try {
    const db = await openDB();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete("ringtone");
      tx.objectStore(STORE).delete("ringtone_meta");
      tx.oncomplete = () => res();
    });
  } catch { /* ignore */ }
}

// ─── Web Audio core ───────────────────────────────────────────────────────
let ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!ctx || ctx.state === "closed") {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  // На мобильных контекст создаётся в "suspended" — возобновляем,
  // иначе осцилляторы не играют (нет гудков/рингтона).
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => { /* ignore */ });
  }
  return ctx;
}

// Разблокировка аудио по первому жесту пользователя (тап/клик/клавиша).
// Без этого AudioContext остаётся suspended и звуки не играют.
export function unlockAudioContext(): void {
  try {
    const c = getCtx();
    if (c.state === "suspended") c.resume().catch(() => { /* ignore */ });
  } catch { /* ignore */ }
}

if (typeof window !== "undefined") {
  const unlock = () => unlockAudioContext();
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

type Note = { freq: number; dur: number; start: number; type?: OscillatorType; gain?: number };

function playSequence(notes: Note[], baseGain = 0.3): AudioNode[] {
  const c = getCtx();
  const vol = getVolume();
  const nodes: AudioNode[] = [];
  notes.forEach(n => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = n.type || "triangle";
    osc.frequency.value = n.freq;
    const g = (n.gain ?? baseGain) * vol;
    gain.gain.setValueAtTime(0, c.currentTime + n.start);
    gain.gain.linearRampToValueAtTime(g, c.currentTime + n.start + 0.01);
    gain.gain.linearRampToValueAtTime(0, c.currentTime + n.start + n.dur - 0.02);
    osc.start(c.currentTime + n.start);
    osc.stop(c.currentTime + n.start + n.dur);
    nodes.push(osc, gain);
  });
  return nodes;
}

// ─── Стандартные мелодии звонка ───────────────────────────────────────────
const RING_PATTERNS: Record<Exclude<RingtoneId, "custom">, () => Note[]> = {
  nova: () => [
    { freq: 880, dur: 0.12, start: 0.0,  type: "triangle" },
    { freq: 1109, dur: 0.12, start: 0.14, type: "triangle" },
    { freq: 1319, dur: 0.12, start: 0.28, type: "triangle" },
    { freq: 1109, dur: 0.12, start: 0.42, type: "triangle" },
    { freq: 880, dur: 0.22, start: 0.56, type: "triangle" },
    { freq: 1109, dur: 0.22, start: 0.82, type: "triangle" },
  ],
  classic: () => [
    { freq: 1318, dur: 0.18, start: 0.0,  type: "sine" },
    { freq: 1046, dur: 0.18, start: 0.22, type: "sine" },
    { freq: 1318, dur: 0.18, start: 0.6,  type: "sine" },
    { freq: 1046, dur: 0.18, start: 0.82, type: "sine" },
  ],
  chime: () => [
    { freq: 1567, dur: 0.3,  start: 0.0,  type: "sine", gain: 0.3 },
    { freq: 1318, dur: 0.3,  start: 0.18, type: "sine", gain: 0.3 },
    { freq: 1046, dur: 0.4,  start: 0.36, type: "sine", gain: 0.3 },
  ],
  pulse: () => [
    { freq: 660, dur: 0.1, start: 0.0,  type: "square", gain: 0.18 },
    { freq: 660, dur: 0.1, start: 0.2,  type: "square", gain: 0.18 },
    { freq: 880, dur: 0.1, start: 0.4,  type: "square", gain: 0.18 },
    { freq: 880, dur: 0.1, start: 0.6,  type: "square", gain: 0.18 },
  ],
  marimba: () => [
    { freq: 523, dur: 0.18, start: 0.0,  type: "triangle" },
    { freq: 659, dur: 0.18, start: 0.2,  type: "triangle" },
    { freq: 784, dur: 0.18, start: 0.4,  type: "triangle" },
    { freq: 1046, dur: 0.3, start: 0.6,  type: "triangle" },
  ],
};

// ─── Ringtone playback ────────────────────────────────────────────────────
let ringtoneInterval: ReturnType<typeof setInterval> | null = null;
let ringtoneNodes: AudioNode[] = [];
let customAudio: HTMLAudioElement | null = null;
let customUrl: string | null = null;

async function playCustomRingtoneLoop() {
  const blob = await getCustomRingtoneBlob();
  if (!blob) {
    // fallback to default
    playStandardRing("nova");
    return;
  }
  customUrl = URL.createObjectURL(blob);
  customAudio = new Audio(customUrl);
  customAudio.loop = true;
  customAudio.volume = getVolume();
  customAudio.play().catch(() => { /* autoplay blocked */ });
}

function playStandardRing(id: Exclude<RingtoneId, "custom">) {
  const fn = RING_PATTERNS[id] || RING_PATTERNS.nova;
  const once = () => { ringtoneNodes.push(...playSequence(fn(), 0.35)); };
  once();
  ringtoneInterval = setInterval(once, 2000);
}

export async function startRingtone(idOverride?: RingtoneId) {
  stopRingtone();
  const id = idOverride || getRingtoneId();
  if (id === "custom") {
    await playCustomRingtoneLoop();
  } else {
    playStandardRing(id as Exclude<RingtoneId, "custom">);
  }
}

export function stopRingtone() {
  if (ringtoneInterval) { clearInterval(ringtoneInterval); ringtoneInterval = null; }
  ringtoneNodes.forEach(n => { try { (n as OscillatorNode).stop?.(); } catch { /* ok */ } });
  ringtoneNodes = [];
  if (customAudio) { try { customAudio.pause(); } catch { /* ignore */ } customAudio = null; }
  if (customUrl) { URL.revokeObjectURL(customUrl); customUrl = null; }
}

// Превью мелодии (короткое — без зацикливания)
export async function previewRingtone(id: RingtoneId) {
  stopRingtone();
  if (id === "custom") {
    const blob = await getCustomRingtoneBlob();
    if (!blob) return;
    customUrl = URL.createObjectURL(blob);
    customAudio = new Audio(customUrl);
    customAudio.volume = getVolume();
    customAudio.play().catch(() => { /* ignore */ });
    setTimeout(() => stopRingtone(), 4000);
  } else {
    const fn = RING_PATTERNS[id as Exclude<RingtoneId, "custom">] || RING_PATTERNS.nova;
    ringtoneNodes.push(...playSequence(fn(), 0.35));
    setTimeout(() => stopRingtone(), 1800);
  }
}

// ─── Dial tone ────────────────────────────────────────────────────────────
let dialNodes: AudioNode[] = [];
let dialInterval: ReturnType<typeof setInterval> | null = null;

function dialBeep() {
  dialNodes.push(...playSequence([{ freq: 440, dur: 0.8, start: 0, type: "sine", gain: 0.2 }]));
}

export function startDialTone() {
  stopDialTone();
  dialBeep();
  dialInterval = setInterval(dialBeep, 2000);
}

export function stopDialTone() {
  if (dialInterval) { clearInterval(dialInterval); dialInterval = null; }
  dialNodes.forEach(n => { try { (n as OscillatorNode).stop?.(); } catch { /* ok */ } });
  dialNodes = [];
}

// ─── Notify sounds (короткие, для входящих сообщений) ─────────────────────
const NOTIFY_PATTERNS: Record<NotifyId, () => Note[]> = {
  ping:  () => [{ freq: 880, dur: 0.08, start: 0, type: "sine", gain: 0.18 }, { freq: 1320, dur: 0.1, start: 0.1, type: "sine", gain: 0.18 }],
  drop:  () => [{ freq: 600, dur: 0.05, start: 0, type: "sine", gain: 0.2 }, { freq: 1100, dur: 0.12, start: 0.05, type: "sine", gain: 0.2 }],
  pop:   () => [{ freq: 1200, dur: 0.06, start: 0, type: "triangle", gain: 0.22 }],
  click: () => [{ freq: 2000, dur: 0.03, start: 0, type: "square", gain: 0.1 }, { freq: 1500, dur: 0.04, start: 0.04, type: "square", gain: 0.1 }],
  soft:  () => [{ freq: 523, dur: 0.18, start: 0, type: "sine", gain: 0.15 }, { freq: 784, dur: 0.18, start: 0.1, type: "sine", gain: 0.15 }],
};

export function playMessageSound(idOverride?: NotifyId) {
  if (!isNotifyOn()) return;
  try {
    const id = idOverride || getNotifyId();
    const fn = NOTIFY_PATTERNS[id] || NOTIFY_PATTERNS.ping;
    playSequence(fn(), 0.18);
  } catch { /* ignore */ }
}

export function previewNotifySound(id: NotifyId) {
  try {
    const fn = NOTIFY_PATTERNS[id] || NOTIFY_PATTERNS.ping;
    playSequence(fn(), 0.18);
  } catch { /* ignore */ }
}

export function playHangupSound() {
  try {
    playSequence([{ freq: 320, dur: 0.4, start: 0, type: "sine", gain: 0.25 }]);
  } catch { /* ignore */ }
}