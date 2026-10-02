import { useEffect, useRef, useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { api, PUSH_API, subscribeToPush, type Chat, type User, type Group, type View } from "@/lib/api";
import type { ActiveCall } from "@/pages/index-hooks/useIncomingCalls";
import { native } from "@/lib/native";

/** Регистрация нативных (FCM) и web push-уведомлений, PWA-бейдж и заголовок вкладки. */
export function usePushSetup({
  currentUser,
  realChats,
  pendingOpenRef,
  tryOpenFromPush,
}: {
  currentUser: User | null;
  realChats: Chat[];
  pendingOpenRef: MutableRefObject<Record<string, string> | null>;
  tryOpenFromPush: () => void;
}) {
  // Push-подписка
  // Нативные push (FCM) на Android-приложении: регистрируем токен и показываем
  // локальное уведомление при получении пуша — чтобы уведомления приходили в фоне.
  useEffect(() => {
    if (!currentUser) return;
    if (!native.isNative) return;
    const uid = currentUser.id;
    native.push.register(
      (token) => {
        fetch(PUSH_API, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Id": String(uid) },
          body: JSON.stringify({ action: "register_native", token, platform: native.platform }),
        }).catch(() => { /* повторим при следующем запуске */ });
      },
      () => { /* приложение открыто — сообщение и так появится в чате */ },
      (data) => { pendingOpenRef.current = data; tryOpenFromPush(); }
    );
    const readTap = async () => {
      const raw = await native.storage.get("nova_push_open");
      if (!raw) return;
      await native.storage.remove("nova_push_open");
      try { pendingOpenRef.current = JSON.parse(raw); tryOpenFromPush(); } catch { /* ignore */ }
    };
    readTap();
    return native.app.onResume(readTap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const uid = currentUser.id;

    // Если уже granted — подписываемся сразу. Иначе ждём первого пользовательского жеста,
    // браузеры (особенно Safari) не дают вызвать requestPermission без тапа.
    if (Notification.permission === "granted") {
      subscribeToPush(uid);
      return;
    }
    if (Notification.permission === "default") {
      const onUserGesture = () => {
        subscribeToPush(uid);
        window.removeEventListener("pointerdown", onUserGesture);
        window.removeEventListener("keydown", onUserGesture);
      };
      window.addEventListener("pointerdown", onUserGesture, { once: true });
      window.addEventListener("keydown", onUserGesture, { once: true });
      return () => {
        window.removeEventListener("pointerdown", onUserGesture);
        window.removeEventListener("keydown", onUserGesture);
      };
    }
  }, [currentUser]);

  // PWA badge на иконке приложения — считаем без замьюченных чатов
  useEffect(() => {
    const total = realChats.reduce((s, c) => s + (c.muted ? 0 : (c.unread || 0)), 0);
    type NavWithBadge = Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    const nav = navigator as NavWithBadge;
    try {
      if (total > 0 && typeof nav.setAppBadge === "function") {
        nav.setAppBadge(total).catch(() => {});
      } else if (typeof nav.clearAppBadge === "function") {
        nav.clearAppBadge().catch(() => {});
      }
    } catch {
      /* badge api недоступен */
    }
    // Также обновляем title вкладки браузера
    const base = "Nova";
    document.title = total > 0 ? `(${total > 99 ? "99+" : total}) ${base}` : base;
  }, [realChats]);
}

/** Открытие чата/группы/звонка по тапу на пуш и нативный бейдж непрочитанных. */
export function usePushOpen({
  currentUserRef,
  realChatsRef,
  groupsRef,
  realChats,
  groups,
  setActiveCall,
  setSelectedChat,
  setSelectedGroup,
  setView,
  setShowSidebar,
}: {
  currentUserRef: MutableRefObject<User | null>;
  realChatsRef: MutableRefObject<Chat[]>;
  groupsRef: MutableRefObject<Group[]>;
  realChats: Chat[];
  groups: Group[];
  setActiveCall: Dispatch<SetStateAction<ActiveCall | null>>;
  setSelectedChat: Dispatch<SetStateAction<Chat | null>>;
  setSelectedGroup: Dispatch<SetStateAction<Group | null>>;
  setView: Dispatch<SetStateAction<View>>;
  setShowSidebar: Dispatch<SetStateAction<boolean>>;
}) {
  const pendingOpenRef = useRef<Record<string, string> | null>(null);
  const tryOpenFromPush = useCallback(() => {
    const d = pendingOpenRef.current;
    if (!d) return;
    if (d.is_call === "1" && d.call_id) {
      pendingOpenRef.current = null;
      const uid = currentUserRef.current?.id;
      if (!uid) return;
      const callId = d.call_id;
      const accept = d.call_accept === "1";
      api("poll_incoming_call", { since: Math.floor(Date.now() / 1000) - 90 }, uid)
        .then((data) => {
          if (data.call && data.call.call_id === callId) {
            setActiveCall(prev => prev && prev.callId === callId
              ? { ...prev, autoAccept: prev.autoAccept || accept }
              : { userId: data.call.from_user_id, name: data.call.from_name, callId, incoming: true, autoAccept: accept });
          }
        })
        .catch(() => { /* звонок уже завершён */ });
      return;
    }
    const chatId = Number(d.chat_id || 0);
    const groupId = Number(d.group_id || 0);
    if (chatId) {
      const c = realChatsRef.current.find(x => x.id === chatId);
      if (!c) return;
      pendingOpenRef.current = null;
      setSelectedGroup(null); setSelectedChat(c); setView("chats"); setShowSidebar(false);
    } else if (groupId) {
      const g = groupsRef.current.find(x => x.id === groupId);
      if (!g) return;
      pendingOpenRef.current = null;
      setSelectedChat(null); setSelectedGroup(g); setView("chats"); setShowSidebar(false);
    } else {
      pendingOpenRef.current = null;
    }
  }, []);
  useEffect(() => { tryOpenFromPush(); }, [realChats, groups, tryOpenFromPush]);
  const badgeLoadedRef = useRef(false);
  useEffect(() => {
    if (realChats.length || groups.length) badgeLoadedRef.current = true;
    if (!badgeLoadedRef.current) return;
    const total = realChats.reduce((s, c) => s + (c.muted ? 0 : (c.unread || 0)), 0)
      + groups.reduce((s, g) => s + (g.unread_count || 0), 0);
    native.badge.set(total);
  }, [realChats, groups]);

  return { pendingOpenRef, tryOpenFromPush };
}
