import { useEffect, useRef, useState } from "react";

const KEY = "nova_drafts_v1";
type Store = Record<string, { text: string; at: number }>;
const listeners = new Set<() => void>();

function load(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

export function getDraft(key: string): string {
  return load()[key]?.text || "";
}

export function setDraft(key: string, text: string) {
  const s = load();
  const clean = text.replace(/\s+$/, "");
  if (!clean.trim()) {
    if (!(key in s)) return;
    delete s[key];
  } else {
    if (s[key]?.text === text) return;
    s[key] = { text, at: Math.floor(Date.now() / 1000) };
  }
  save(s);
}

export function useDraftsVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const on = () => setV(x => x + 1);
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, []);
  return v;
}

/** Хранит текст поля ввода как черновик для конкретного чата. */
export function useDraft(key: string, input: string, setInput: (v: string) => void, paused = false) {
  const loadedKey = useRef<string | null>(null);
  const latest = useRef({ key, input, paused });
  latest.current = { key, input, paused };

  useEffect(() => {
    loadedKey.current = key;
    setInput(getDraft(key));
    return () => {
      const l = latest.current;
      if (!l.paused && loadedKey.current === l.key) setDraft(l.key, l.input);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current && !paused && !latest.current.input) setInput(getDraft(key));
    wasPaused.current = paused;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  useEffect(() => {
    if (paused || loadedKey.current !== key) return;
    const t = setTimeout(() => setDraft(key, input), 300);
    return () => clearTimeout(t);
  }, [key, input, paused]);
}
