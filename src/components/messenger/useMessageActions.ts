import { useState, useRef, useEffect } from "react";
import { api, type Chat, type Message, type User } from "@/lib/api";
import type { ConfirmState } from "@/components/messenger/useChatActions";
import type { PinnedPreview } from "@/components/messenger/useChatSettings";
import { track } from "@/lib/track";

type CtxMenuState = { msgId: number; out: boolean } | null;

interface Params {
  chat: Chat;
  currentUser: User;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setLastSince: React.Dispatch<React.SetStateAction<number>>;
  setConfirm: (c: ConfirmState | null) => void;
  setCtxMenu: (c: CtxMenuState) => void;
  setShowReactionPicker: (v: number | null) => void;
  setReplyTo: (m: Message | null) => void;
  setEditing: (m: Message | null) => void;
  setInput: (v: string) => void;
  setForwardMsgId: (v: number | null) => void;
  pinnedMsg: PinnedPreview | null;
  setPinnedMsg: (p: PinnedPreview | null) => void;
}

/** Действия над отдельными сообщениями: удаление, удержание, реакции, ответ, правка, пересылка, закреп, избранное. */
export function useMessageActions({
  chat, currentUser, messages, setMessages, setLastSince, setConfirm, setCtxMenu, setShowReactionPicker,
  setReplyTo, setEditing, setInput, setForwardMsgId, pinnedMsg, setPinnedMsg,
}: Params) {
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [favToast, setFavToast] = useState("");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    };
  }, []);

  const deleteMessage = (msgId: number) => {
    setCtxMenu(null);
    setConfirm({
      title: "Удалить сообщение?",
      text: "Сообщение исчезнет у всех участников чата.",
      danger: true,
      action: async () => {
        // Оптимистично убираем
        setMessages(prev => prev.filter(m => m.id !== msgId));
        const r = await api("delete_message", { message_id: msgId }, currentUser.id);
        if (r?.error) {
          alert("Не удалось удалить: " + r.error);
          // Откат: перезагрузим
          setLastSince(0);
        }
      },
    });
  };

  const startHold = (msgId: number, out: boolean) => {
    if (msgId < 0) return;
    holdTimer.current = setTimeout(() => setCtxMenu({ msgId, out }), 500);
  };
  const cancelHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); };

  const addReaction = async (msgId: number, emoji: string) => {
    setShowReactionPicker(null);
    setCtxMenu(null);
    await api("add_reaction", { message_id: msgId, emoji }, currentUser.id);
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const existing = m.reactions || [];
      const myIdx = existing.findIndex(r => r.user_id === currentUser.id);
      if (myIdx >= 0) {
        const updated = [...existing];
        if (updated[myIdx].emoji === emoji) {
          updated.splice(myIdx, 1);
        } else {
          updated[myIdx] = { ...updated[myIdx], emoji };
        }
        return { ...m, reactions: updated };
      }
      return { ...m, reactions: [...existing, { emoji, user_id: currentUser.id, user_name: "Я" }] };
    }));
  };

  // ── Reply / Forward / Edit / Pin ──
  const handleReply = (msgId: number) => {
    const m = messages.find(x => x.id === msgId);
    if (m) {
      setReplyTo({ ...m, sender_name: m.out ? "Вы" : (m.sender_name || chat.name) });
      setEditing(null);
      setCtxMenu(null);
    }
  };

  const handleEdit = (msgId: number) => {
    const m = messages.find(x => x.id === msgId);
    if (m) {
      setEditing(m);
      setReplyTo(null);
      setInput(m.text);
      setCtxMenu(null);
    }
  };

  const handleForward = (msgId: number) => {
    setForwardMsgId(msgId);
    setCtxMenu(null);
  };

  const handlePinToggle = async (msgId: number) => {
    setCtxMenu(null);
    if (pinnedMsg?.id === msgId) {
      setPinnedMsg(null);
      await api("unpin_message", { chat_id: chat.id }, currentUser.id);
    } else {
      const m = messages.find(x => x.id === msgId);
      if (m) {
        setPinnedMsg({ id: m.id, sender_name: m.out ? "Вы" : (m.sender_name || chat.name), text: m.text, media_type: m.media_type });
      }
      await api("pin_message", { chat_id: chat.id, message_id: msgId }, currentUser.id);
    }
  };

  const scrollToMessage = (msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(msgId);
      setTimeout(() => setHighlightId(null), 1500);
    }
  };

  const handleFavorite = async (id: number) => {
    setCtxMenu(null);
    const saved = await api("saved_chat", {}, currentUser.id).catch(() => null);
    const r = saved?.chat_id
      ? await api("forward_message", { message_id: id, target_chat_id: saved.chat_id }, currentUser.id).catch(() => null)
      : null;
    track("favorite_add");
    setFavToast(r && !r.error ? "Добавлено в избранное" : "Не удалось добавить");
    setTimeout(() => setFavToast(""), 1800);
  };

  return {
    highlightId, favToast,
    deleteMessage, startHold, cancelHold, addReaction,
    handleReply, handleEdit, handleForward, handlePinToggle, scrollToMessage, handleFavorite,
  };
}
