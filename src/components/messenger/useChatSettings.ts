import { useState, useEffect, useCallback } from "react";
import { api, type Chat, type User } from "@/lib/api";
import { type ScheduledItem } from "@/components/messenger/ScheduledList";

export type PinnedPreview = { id: number; sender_name: string; text: string; media_type?: string };

/**
 * Настройки и служебные данные открытого личного чата:
 * закреп, обои, исчезающие сообщения, отложенные сообщения и подсказка о незнакомце.
 */
export function useChatSettings(chat: Chat, currentUser: User, setLastSince: (v: number) => void) {
  const [pinnedMsg, setPinnedMsg] = useState<PinnedPreview | null>(null);
  // Подсказка о незнакомце: показываем если собеседник не в контактах
  const [isUnknown, setIsUnknown] = useState(false);
  const [unknownDismissed, setUnknownDismissed] = useState(false);
  const [disappearingSec, setDisappearingSec] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    api("chat_get_settings", { chat_id: chat.id }, currentUser.id).then(r => {
      if (!alive) return;
      if (r && !r.error) setDisappearingSec(r.disappearing_seconds ?? null);
    });
    return () => { alive = false; };
  }, [chat.id, currentUser.id]);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  // Глобальные обои из настроек оформления (применяются ко всем чатам по умолчанию)
  const globalWp = currentUser.chat_wallpaper && currentUser.chat_wallpaper !== "default"
    ? currentUser.chat_wallpaper : null;
  const [wallpaper, setWallpaper] = useState<string | null>(globalWp);
  useEffect(() => {
    const ls = localStorage.getItem(`nova_wp_${chat.id}`);
    if (ls) setWallpaper(ls);
    api("get_wallpaper", { chat_id: chat.id }, currentUser.id).then(r => {
      if (r && !r.error) {
        // Персональные обои чата приоритетнее; иначе — глобальные
        setWallpaper(r.wallpaper || globalWp);
        if (r.wallpaper) localStorage.setItem(`nova_wp_${chat.id}`, r.wallpaper);
        else localStorage.removeItem(`nova_wp_${chat.id}`);
      }
    });
  }, [chat.id, currentUser.id, globalWp]);
  // Незнакомец: проверяем что собеседник не в контактах
  useEffect(() => {
    if (!chat.partner_id || chat.saved) { setIsUnknown(false); return; }
    setUnknownDismissed(false);
    api("get_contacts", {}, currentUser.id).then(r => {
      if (r?.contacts) {
        const known = (r.contacts as Array<{ id: number }>).some(c => c.id === chat.partner_id);
        setIsUnknown(!known);
      }
    });
  }, [chat.id, chat.partner_id, currentUser.id]);
  const addToContacts = async () => {
    if (!chat.partner_id) return;
    await api("add_contact", { contact_id: chat.partner_id, name_override: chat.name }, currentUser.id);
    setIsUnknown(false);
  };
  // Загрузка запланированных + автозапуск отправки доспевших
  const reloadScheduled = useCallback(async () => {
    const r = await api("scheduled_list", { chat_id: chat.id }, currentUser.id);
    if (r && Array.isArray(r.items)) setScheduled(r.items);
  }, [chat.id, currentUser.id]);

  useEffect(() => {
    reloadScheduled();
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const r = await api("scheduled_run_due", {}, currentUser.id);
      if (r && r.sent && r.sent > 0) {
        setLastSince(0);
      }
      reloadScheduled();
    }, 60000);
    return () => clearInterval(t);
  }, [reloadScheduled, currentUser.id]);

  // Загружаем pinned при смене чата
  useEffect(() => {
    let cancel = false;
    api("get_pinned_message", { chat_id: chat.id }, currentUser.id).then(data => {
      if (cancel) return;
      setPinnedMsg(data.pinned || null);
    });
    return () => { cancel = true; };
  }, [chat.id, currentUser.id]);

  return {
    pinnedMsg, setPinnedMsg,
    isUnknown, setIsUnknown, unknownDismissed, setUnknownDismissed, addToContacts,
    disappearingSec, setDisappearingSec,
    scheduled, reloadScheduled,
    wallpaper, setWallpaper,
  };
}
