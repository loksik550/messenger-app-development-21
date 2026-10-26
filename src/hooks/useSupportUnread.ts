import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export const SUPPORT_UNREAD_EVENT = "nova-support-unread-refresh";

export function refreshSupportUnread() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SUPPORT_UNREAD_EVENT));
}

export function useSupportUnread(userId: number | undefined) {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!userId) return;
    const r = await api("support_my_tickets", {}, userId).catch(() => null);
    if (!Array.isArray(r?.tickets)) return;
    const total = r.tickets.reduce((sum: number, t: { unread?: number }) => sum + (Number(t.unread) || 0), 0);
    setCount(total);
  }, [userId]);

  useEffect(() => {
    load();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    const t = setInterval(onVis, 60000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(SUPPORT_UNREAD_EVENT, load);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(SUPPORT_UNREAD_EVENT, load);
    };
  }, [load]);

  return count;
}
