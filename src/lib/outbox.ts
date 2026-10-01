import { api } from "@/lib/api";
import { onConnectionChange, isOnline } from "@/lib/connection";

export interface OutboxItem {
  localId: number;
  chatId: number;
  kind?: "chat" | "group";
  userId: number;
  text: string;
  replyToId?: number;
  createdAt: number;
  failed?: boolean;
}

export interface OutboxSent {
  localId: number;
  chatId: number;
  kind?: "chat" | "group";
  id: number;
  created_at: number;
}

const KEY = "nova_outbox_v1";
type Listener = (e: { type: "sent"; item: OutboxSent } | { type: "change" }) => void;
const listeners = new Set<Listener>();
let flushing = false;

function load(): OutboxItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

function save(items: OutboxItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  listeners.forEach(l => l({ type: "change" }));
}

export function getPending(chatId: number, kind: "chat" | "group" = "chat"): OutboxItem[] {
  return load().filter(i => i.chatId === chatId && (i.kind || "chat") === kind);
}

export function subscribeOutbox(cb: Listener) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function enqueue(item: Omit<OutboxItem, "localId" | "createdAt">): OutboxItem {
  const full: OutboxItem = { ...item, localId: -Date.now() - Math.floor(Math.random() * 1000), createdAt: Math.floor(Date.now() / 1000) };
  save([...load(), full]);
  flush();
  return full;
}

export function removeFromOutbox(localId: number) {
  save(load().filter(i => i.localId !== localId));
}

export function retry(localId: number) {
  save(load().map(i => i.localId === localId ? { ...i, failed: false } : i));
  flush();
}

let again = false;

function isTemporary(data: { error?: string } | null | undefined) {
  const e = (data?.error || "").toLowerCase();
  return !data || e === "bad_response" || e.includes("слишком быстро") || e.includes("timeout") || e.includes("internal");
}

export async function flush() {
  if (!isOnline()) return;
  if (flushing) { again = true; return; }
  flushing = true;
  try {
    do {
      again = false;
      for (const item of load()) {
        if (item.failed) continue;
        let data: { id?: number; created_at?: number; error?: string };
        try {
          data = (item.kind || "chat") === "group"
            ? await api("send_group_message", { group_id: item.chatId, text: item.text, reply_to_id: item.replyToId, client_id: item.localId }, item.userId)
            : await api("send_message", { chat_id: item.chatId, text: item.text, reply_to_id: item.replyToId, client_id: item.localId }, item.userId);
        } catch {
          return;
        }
        if (data?.id) {
          save(load().filter(i => i.localId !== item.localId));
          listeners.forEach(l => l({ type: "sent", item: { localId: item.localId, chatId: item.chatId, kind: item.kind || "chat", id: data.id!, created_at: data.created_at || item.createdAt } }));
        } else if (isTemporary(data)) {
          again = false;
          setTimeout(flush, 5000);
          return;
        } else {
          save(load().map(i => i.localId === item.localId ? { ...i, failed: true } : i));
        }
      }
    } while (again);
  } finally {
    flushing = false;
  }
}

onConnectionChange(on => { if (on) flush(); });
if (typeof window !== "undefined") {
  setTimeout(flush, 1500);
  setInterval(() => { if (load().some(i => !i.failed)) flush(); }, 15000);
}
