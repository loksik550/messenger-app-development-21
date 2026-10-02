import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { api, type User, type View } from "@/lib/api";

/** Проверка блокировки аккаунта, обновление профиля и отметка присутствия. */
export function useAccountStatus({
  currentUser,
  setCurrentUser,
  view,
}: {
  currentUser: User | null;
  setCurrentUser: Dispatch<SetStateAction<User | null>>;
  view: View;
}) {
  const [banInfo, setBanInfo] = useState<{ banned_until: number | null; banned_reason: string; forever?: boolean } | null>(null);

  // Проверка блокировки аккаунта
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.id;
    let alive = true;
    const check = async () => {
      const r = await api("ban_status", {}, uid);
      if (!alive || !r) return;
      if (r.banned) {
        setBanInfo({
          banned_until: r.banned_until ?? null,
          banned_reason: r.banned_reason || "",
          forever: r.forever,
        });
      } else if (r.banned === false) {
        setBanInfo(null);
      }
    };
    check();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") check();
    }, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [currentUser?.id]);

  // Свежие данные профиля (баланс, галочка) при открытии профиля
  useEffect(() => {
    if (!currentUser || view !== "profile") return;
    let alive = true;
    api("refresh_me", {}, currentUser.id).then(r => {
      if (!alive || !r || r.error || !r.user) return;
      setCurrentUser(prev => (prev ? { ...prev, ...r.user } : prev));
    });
    return () => { alive = false; };
  }, [view, currentUser?.id]);

  // Отметка присутствия: сразу «в сети», при уходе — «не в сети»
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.id;
    const beat = (online: boolean) => { api("heartbeat", { online }, uid); };
    beat(true);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") beat(true);
    }, 30000);
    const onVis = () => beat(document.visibilityState === "visible");
    const onLeave = () => beat(false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onLeave);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onLeave);
      beat(false);
    };
  }, [currentUser?.id]);

  return { banInfo, setBanInfo };
}
