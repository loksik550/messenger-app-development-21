import { useEffect, useState } from "react";
import { native } from "@/lib/native";

const PING_URL = "https://functions.poehali.dev/3fc067b7-d1b3-4aed-8ad9-98df81040f0a?action=ping";

type Listener = (online: boolean) => void;

let online = typeof navigator === "undefined" ? true : navigator.onLine;
const listeners = new Set<Listener>();
let started = false;
let probeTimer: ReturnType<typeof setTimeout> | null = null;

function set(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach(l => l(online));
}

async function probe(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(PING_URL, { method: "GET", signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

function scheduleProbe(delay: number) {
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = setTimeout(async () => {
    const ok = await probe();
    set(ok);
    if (!ok) scheduleProbe(3000);
  }, delay);
}

function start() {
  if (started) return;
  started = true;
  native.network.status().then(s => { if (!s.connected) set(false); });
  native.network.onChange(isOn => {
    if (!isOn) set(false);
    else scheduleProbe(0);
  });
}

export function isOnline() {
  return online;
}

export function reportNetworkError() {
  set(false);
  scheduleProbe(2000);
}

export function reportNetworkOk() {
  set(true);
}

export function onConnectionChange(cb: Listener) {
  start();
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useOnline() {
  const [state, setState] = useState(online);
  useEffect(() => {
    setState(online);
    return onConnectionChange(setState);
  }, []);
  return state;
}
