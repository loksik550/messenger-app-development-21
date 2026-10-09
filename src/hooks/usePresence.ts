import { useEffect } from "react";
import { api } from "@/lib/api";
import { authHeaders, getAuthToken } from "@/lib/authToken";

/**
 * Поддерживает онлайн-статус пользователя:
 * - каждые 30 секунд шлёт ping (обновляет last_seen)
 * - при закрытии вкладки шлёт set_offline (помечает оффлайн сразу)
 * - при сворачивании страницы — тоже set_offline
 */
export function usePresence(userId: number | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    // Сразу шлём ping чтобы пометить как онлайн
    api("ping", {}, userId).catch(() => { /* ignore */ });

    const interval = setInterval(() => {
      // Не шлём, если вкладка скрыта
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      api("ping", {}, userId).catch(() => { /* ignore */ });
    }, 30000);

    const goOffline = () => {
      try {
        // navigator.sendBeacon работает даже при закрытии вкладки
        const url = "https://functions.poehali.dev/b97ade88-cc88-4702-a461-4c386efd5ca3";
        const blob = new Blob(
          [JSON.stringify({ action: "set_offline" })],
          { type: "application/json" }
        );
        if (navigator.sendBeacon) {
          // sendBeacon не позволяет кастомные заголовки, поэтому ID шлём в теле
          const blobWithId = new Blob(
            [JSON.stringify({ action: "set_offline", user_id: userId })],
            { type: "application/json" }
          );
          const tk = getAuthToken();
          navigator.sendBeacon(url + `?user_id=${userId}` + (tk ? `&token=${encodeURIComponent(tk)}` : ""), blobWithId);
        } else {
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders(userId) },
            body: JSON.stringify({ action: "set_offline" }),
            keepalive: true,
          }).catch(() => { /* ignore */ });
        }
        void blob;
      } catch { /* ignore */ }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        goOffline();
      } else {
        api("ping", {}, userId).catch(() => { /* ignore */ });
      }
    };

    window.addEventListener("beforeunload", goOffline);
    window.addEventListener("pagehide", goOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", goOffline);
      window.removeEventListener("pagehide", goOffline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId]);
}

export default usePresence;
