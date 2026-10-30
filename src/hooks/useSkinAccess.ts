import { useEffect, useState } from "react";
import { applySkin, getStoredSkinId, loadSkins, type Skin } from "@/lib/skins";

/** Доступ к тестовым темам. При запуске включает сохранённую тему, без доступа — сбрасывает. */
export function useSkinAccess(userId?: number | null) {
  const [state, setState] = useState<{ allowed: boolean; skins: Skin[] }>({ allowed: false, skins: [] });
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    loadSkins(userId).then((r) => {
      if (!alive) return;
      setState(r);
      const id = getStoredSkinId();
      applySkin(r.allowed ? r.skins.find((s) => s.id === id) || null : null);
    });
    return () => { alive = false; };
  }, [userId]);
  return state;
}

/** Текущая включённая тема (для бегущей строки и т.п.). */
export function useActiveSkin() {
  const [skin, setSkin] = useState<Skin | null>(null);
  useEffect(() => {
    const on = (e: Event) => setSkin((e as CustomEvent<Skin | null>).detail || null);
    window.addEventListener("nova:skin", on);
    return () => window.removeEventListener("nova:skin", on);
  }, []);
  return skin;
}
