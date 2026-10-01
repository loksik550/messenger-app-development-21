import { CHAT_API } from "@/lib/api";

const queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let userId: number | null = null;

export function setTrackUser(id: number | null) {
  userId = id;
}

function flush() {
  timer = null;
  if (!queue.length) return;
  const features = queue.splice(0, 30);
  fetch(CHAT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(userId ? { "X-User-Id": String(userId) } : {}) },
    body: JSON.stringify({ action: "track", features }),
    keepalive: true,
  }).catch(() => { /* статистика не критична */ });
}

export function track(feature: string) {
  if (!feature) return;
  queue.push(feature);
  if (queue.length >= 20) { if (timer) clearTimeout(timer); flush(); return; }
  if (!timer) timer = setTimeout(flush, 5000);
}
