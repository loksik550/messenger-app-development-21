import { api, type Chat, type Message, type User } from "@/lib/api";

export type ConfirmState = { title: string; text: string; danger?: boolean; action: () => void | Promise<void> };

interface Params {
  chat: Chat;
  currentUser: User;
  onBack: () => void;
  onChatUpdated?: (chat: Chat) => void;
  onChatDeleted?: () => void;
  setConfirm: (c: ConfirmState | null) => void;
  setMessages: (m: Message[]) => void;
  setLastSince: (v: number) => void;
}

/** Действия над личным чатом целиком: звук, закреп, избранное, очистка, блокировка, архив. */
export function useChatActions({ chat, currentUser, onBack, onChatUpdated, onChatDeleted, setConfirm, setMessages, setLastSince }: Params) {
  const setChatField = async (field: "muted" | "pinned" | "favorite", value: boolean) => {
    onChatUpdated?.({ ...chat, [field]: value });
    try {
      await api("set_chat_setting", { chat_id: chat.id, field, value }, currentUser.id);
    } catch {
      onChatUpdated?.({ ...chat, [field]: !value });
    }
  };

  const handleToggleMute = () => setChatField("muted", !chat.muted);
  const handleTogglePin = () => setChatField("pinned", !chat.pinned);
  const handleToggleFavorite = () => setChatField("favorite", !chat.favorite);

  const handleClearHistory = () => {
    setConfirm({
      title: "Очистить историю?",
      text: "Все сообщения в этом чате будут скрыты у вас. Собеседник продолжит видеть их у себя.",
      danger: true,
      action: async () => {
        await api("clear_history", { chat_id: chat.id }, currentUser.id);
        setMessages([]);
        setLastSince(Math.floor(Date.now() / 1000));
      },
    });
  };

  const handleBlock = () => {
    if (!chat.partner_id) return;
    setConfirm({
      title: "Заблокировать пользователя?",
      text: `${chat.name} больше не сможет писать вам сообщения. Чат скроется из списка.`,
      danger: true,
      action: async () => {
        await api("block_user", { target_user_id: chat.partner_id }, currentUser.id);
        onChatDeleted?.();
        onBack();
      },
    });
  };

  const handleToggleArchive = async () => {
    const next = !chat.archived;
    await api("archive_chat", { chat_id: chat.id, archived: next }, currentUser.id);
    onChatDeleted?.();
    onBack();
  };


  return {
    handleToggleMute, handleTogglePin, handleToggleFavorite,
    handleClearHistory, handleBlock, handleToggleArchive,
  };
}
