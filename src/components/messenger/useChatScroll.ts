import { useState, useRef, useEffect } from "react";
import type { Message } from "@/lib/api";
import {
  SCROLL_NEAR_BOTTOM_PX, SCROLL_SHOW_DOWN_PX, SCROLL_RESET_NEW_PX,
} from "@/components/messenger/chatConstants";

/** Автоскролл ленты сообщений, счётчик новых и кнопка «вниз». */
export function useChatScroll({ messages, isTyping }: { messages: Message[]; isTyping: boolean }) {
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    // если близко к низу — авто-скроллим
    if (distanceFromBottom < SCROLL_NEAR_BOTTOM_PX) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
      setNewCount(0);
    } else {
      // считаем непрочитанные «новые входящие»
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && !lastMsg.out) {
        setNewCount((n) => n + 1);
      }
    }
  }, [messages, isTyping]);

  const handleMessagesScroll = () => {
    const container = messagesScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollDown(distanceFromBottom > SCROLL_SHOW_DOWN_PX);
    if (distanceFromBottom < SCROLL_RESET_NEW_PX) setNewCount(0);
  };

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewCount(0);
  };

  return { messagesScrollRef, endRef, showScrollDown, newCount, handleMessagesScroll, scrollToBottom };
}
