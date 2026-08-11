import { useState, useRef, useEffect, useCallback } from "react";
import { api, type Chat, type Message, type Reaction, type User } from "@/lib/api";
import { playMessageSound } from "@/lib/sounds";
import { useAdaptivePoll } from "@/hooks/useAdaptivePoll";

// Загрузка сообщений чата, поллинг обновлений и индикатор набора текста.
// Логика перенесена из ChatComponents.tsx без изменений.
export function useChatMessages(chat: Chat, currentUser: User) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [lastSince, setLastSince] = useState(0);

  const loadMessages = useCallback(async (since = 0): Promise<boolean> => {
    const data = await api("get_messages", { chat_id: chat.id, since }, currentUser.id);
    let changed = false;

    // Удаляем у себя то, что удалили на сервере (для получателя)
    if (Array.isArray(data.removed_ids) && data.removed_ids.length > 0) {
      const removedSet = new Set<number>(data.removed_ids);
      setMessages(prev => prev.some(m => removedSet.has(m.id)) ? prev.filter(m => !removedSet.has(m.id)) : prev);
      changed = true;
    }

    if (data.messages && data.messages.length > 0) {
      changed = true;
      const mapped: Message[] = data.messages.map((m: {
        id: number; text: string; created_at: number; sender_id: number; sender_name?: string; read_at?: number;
        image_url?: string; media_type?: string; media_url?: string;
        file_name?: string; file_size?: number; duration?: number;
        reactions?: Reaction[];
        reply_to?: { id: number; sender_name: string; text: string; media_type?: string } | null;
        forwarded_from_user_id?: number | null;
        forwarded_from_name?: string | null;
        edited_at?: number | null;
        kind?: "text" | "missed_call" | "system";
      }) => ({
        id: m.id,
        text: m.text,
        time: new Date(m.created_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
        out: m.sender_id === currentUser.id,
        read: !!m.read_at,
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        kind: m.kind || "text",
        created_at: m.created_at,
        image_url: m.image_url,
        media_type: m.media_type as Message["media_type"],
        media_url: m.media_url,
        file_name: m.file_name,
        file_size: m.file_size,
        duration: m.duration,
        reactions: m.reactions || [],
        reply_to: m.reply_to || null,
        forwarded_from_user_id: m.forwarded_from_user_id || null,
        forwarded_from_name: m.forwarded_from_name || null,
        edited_at: m.edited_at || null,
      }));
      if (since === 0) {
        setMessages(mapped);
      } else {
        const hasIncoming = mapped.some(m => !m.out);
        if (hasIncoming) playMessageSound();
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          // Дополнительная дедупликация: если это наше сообщение (out) с тем же текстом и создано
          // в пределах 5 секунд от уже существующего — считаем дубликатом.
          const isDuplicate = (m: Message) => {
            if (existingIds.has(m.id)) return true;
            if (!m.out) return false;
            return prev.some(pm =>
              pm.out &&
              pm.text === m.text &&
              Math.abs((pm.created_at || 0) - (m.created_at || 0)) < 5
            );
          };
          const newMsgs = mapped.filter(m => !isDuplicate(m));
          const updated = prev.map(pm => {
            const fresh = mapped.find(m => m.id === pm.id);
            return fresh ? { ...pm, reactions: fresh.reactions, read: fresh.read || pm.read } : pm;
          });
          return newMsgs.length > 0 ? [...updated, ...newMsgs] : updated;
        });
      }
      const maxTs = Math.max(...data.messages.map((m: { created_at: number }) => m.created_at));
      setLastSince(maxTs);
      api("mark_read", { chat_id: chat.id }, currentUser.id);
    }
    return changed;
  }, [chat.id, currentUser.id]);

  const lastSinceRef = useRef(0);
  lastSinceRef.current = lastSince;

  useEffect(() => {
    setMessages([]);
    setLastSince(0);
    loadMessages(0);
  }, [chat.id]);

  useAdaptivePoll(() => loadMessages(lastSinceRef.current), [chat.id, loadMessages], 3000, 10000);

  const typingRef = useRef(false);
  useAdaptivePoll(async () => {
    const data = await api("get_typing", { chat_id: chat.id }, currentUser.id);
    const typing = !!data.typing;
    setIsTyping(typing);
    const changed = typing || typingRef.current;
    typingRef.current = typing;
    return changed;
  }, [chat.id, currentUser.id], 4000, 8000);

  return { messages, setMessages, isTyping, lastSince, setLastSince, loadMessages };
}

export default useChatMessages;
