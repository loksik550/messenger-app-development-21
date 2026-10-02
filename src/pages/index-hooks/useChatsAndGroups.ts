import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { api, type Chat, type User, type Group } from "@/lib/api";
import { playMessageSound } from "@/lib/sounds";
import { native } from "@/lib/native";

interface ChatRaw {
  id: number;
  last_message: string;
  last_message_at: number;
  partner: { id: number; name: string; last_seen: number; avatar_url?: string | null; verified?: boolean };
  unread: number;
  muted?: boolean;
  pinned?: boolean;
  favorite?: boolean;
  archived?: boolean;
}

export function mapChat(c: ChatRaw): Chat {
  return {
    id: c.id,
    name: c.partner.name,
    avatar: c.partner.name[0]?.toUpperCase() || "?",
    avatar_url: c.partner.avatar_url || null,
    lastMsg: c.last_message || "Нет сообщений",
    time: c.last_message_at ? new Date(c.last_message_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) : "",
    unread: c.unread || 0,
    online: Date.now() / 1000 - (c.partner.last_seen || 0) < 60,
    partner_id: c.partner.id,
    lastSeen: c.partner.last_seen,
    muted: c.muted || false,
    pinned: c.pinned || false,
    favorite: c.favorite || false,
    verified: c.partner.verified || false,
    archived: c.archived || false,
  };
}

/** Периодическая загрузка списка чатов и групп. */
export function useChatsAndGroups({
  currentUser,
  showArchived,
  selectedChat,
  unreadRef,
  setArchivedCount,
  setRealChats,
  setGroups,
}: {
  currentUser: User | null;
  showArchived: boolean;
  selectedChat: Chat | null;
  unreadRef: MutableRefObject<Map<number, number> | null>;
  setArchivedCount: Dispatch<SetStateAction<number>>;
  setRealChats: Dispatch<SetStateAction<Chat[]>>;
  setGroups: Dispatch<SetStateAction<Group[]>>;
}) {
  // Загрузка чатов
  useEffect(() => {
    if (!currentUser) return;
    const loadChats = async () => {
      const data = await api("get_chats", { archived: showArchived }, currentUser.id);
      if (typeof data.archived_count === "number") setArchivedCount(data.archived_count);
      if (data.chats) {
        const mapped: Chat[] = data.chats.map(mapChat);
        // Детект новых входящих сообщений: если непрочитанных стало больше —
        // показываем локальное уведомление и звук (работает пока приложение открыто,
        // это резерв на случай, когда Web Push не доходит, напр. на iOS в браузере).
        const prevUnread = unreadRef.current;
        if (prevUnread !== null) {
          for (const c of mapped) {
            const before = prevUnread.get(c.id) || 0;
            const now = c.unread || 0;
            const isActiveOpen = selectedChat?.id === c.id && document.visibilityState === "visible";
            if (now > before && !c.muted && !isActiveOpen) {
              playMessageSound();
              native.localNotify.show(c.name, c.lastMsg || "Новое сообщение");
              break;
            }
          }
        }
        unreadRef.current = new Map(mapped.map(c => [c.id, c.unread || 0]));
        // Обновляем только если реально что-то изменилось — иначе мигают ники
        setRealChats(prev => {
          const prevStr = JSON.stringify(prev.map(c => ({ id: c.id, lastMsg: c.lastMsg, unread: c.unread, online: c.online, time: c.time, muted: c.muted, pinned: c.pinned, favorite: c.favorite })));
          const nextStr = JSON.stringify(mapped.map(c => ({ id: c.id, lastMsg: c.lastMsg, unread: c.unread, online: c.online, time: c.time, muted: c.muted, pinned: c.pinned, favorite: c.favorite })));
          return prevStr === nextStr ? prev : mapped;
        });
      }
    };
    loadChats();
    const tick = () => { if (document.visibilityState === "visible") loadChats(); };
    const interval = setInterval(tick, 8000);
    const onVis = () => { if (document.visibilityState === "visible") loadChats(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVis); };
  }, [currentUser, showArchived]);

  // Загрузка групп
  useEffect(() => {
    if (!currentUser) return;
    const loadGroups = () => {
      api("get_groups", {}, currentUser.id).then(d => {
        if (d.groups) setGroups(d.groups);
      });
    };
    loadGroups();
    const tick = () => { if (document.visibilityState === "visible") loadGroups(); };
    const t = setInterval(tick, 10000);
    const onVis = () => { if (document.visibilityState === "visible") loadGroups(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [currentUser]);
}
