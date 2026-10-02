import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from "react";
import { api, type User } from "@/lib/api";
import type { UserNotif } from "@/components/messenger/NotificationsBell";
import type { NovaToastItem } from "@/components/messenger/NovaToast";

/** Уведомления пользователя для колокольчика и всплывающих тостов. */
export function useUserNotifications({
  currentUser,
  setCurrentUser,
}: {
  currentUser: User | null;
  setCurrentUser: Dispatch<SetStateAction<User | null>>;
}) {
  const notifSeenRef = useRef<Set<number>>(new Set());
  const [notifs, setNotifs] = useState<UserNotif[]>([]);
  const [toasts, setToasts] = useState<NovaToastItem[]>([]);
  const [notifUnread, setNotifUnread] = useState(0);

  // Уведомления пользователя: копятся списком в колокольчике
  const loadNotifs = useCallback(async (announce = false) => {
    if (!currentUser) return;
    const r = await api("my_notifications", {}, currentUser.id);
    if (!r || r.error || !r.items) return;
    const items = r.items as UserNotif[];
    const prevIds = notifSeenRef.current;
    setNotifs(items);
    setNotifUnread(r.unread || 0);
    if (announce) {
      const fresh = items.filter(n => !n.read && !prevIds.has(n.id));
      if (fresh.length > 0) {
        setToasts(prev => [
          ...fresh.map(n => ({ id: n.id, kind: n.kind, title: n.title, body: n.body })),
          ...prev,
        ].slice(0, 3));
      }
      if (fresh.length > 0) {
        const me = await api("refresh_me", {}, currentUser.id);
        if (me?.user) setCurrentUser(prev => (prev ? { ...prev, ...me.user } : prev));
      }
    }
    notifSeenRef.current = new Set(items.map(n => n.id));
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;
    loadNotifs(true);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") loadNotifs(true);
    }, 45000);
    return () => clearInterval(t);
  }, [currentUser?.id, loadNotifs]);

  return { notifs, toasts, setToasts, notifUnread, loadNotifs };
}
