import { useState, useRef, useEffect, useLayoutEffect } from "react";
import type { Message } from "@/lib/api";
import {
  SCROLL_NEAR_BOTTOM_PX, SCROLL_SHOW_DOWN_PX, SCROLL_RESET_NEW_PX,
} from "@/components/messenger/chatConstants";

/**
 * Автоскролл ленты сообщений, счётчик новых и кнопка «вниз».
 * При открытии чата лента сразу встаёт на последнее сообщение и «держится»
 * внизу, пока догружаются фото, кружки и стикеры (они меняют высоту ленты).
 */
export function useChatScroll({ messages, isTyping, chatKey }: { messages: Message[]; isTyping: boolean; chatKey?: string | number }) {
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [newCount, setNewCountRaw] = useState(0);
  const newCountRef = useRef(0);
  const setNewCount = (v: number | ((n: number) => number)) => {
    const next = typeof v === "function" ? v(newCountRef.current) : v;
    if (next === newCountRef.current) return;
    newCountRef.current = next;
    setNewCountRaw(next);
  };
  const showDownRef = useRef(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pinUntil = useRef(0);
  const userMoved = useRef(false);
  const lastLen = useRef(0);
  const lastId = useRef<number | null>(null);
  const lastTyping = useRef(false);

  const jumpToBottom = () => {
    const el = messagesScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useLayoutEffect(() => {
    pinUntil.current = Date.now() + 2500;
    userMoved.current = false;
    lastLen.current = 0;
    lastId.current = null;
    setNewCount(0);
    setShowScrollDown(false);
    jumpToBottom();
  }, [chatKey]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (Date.now() < pinUntil.current && !userMoved.current) jumpToBottom();
    });
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    const mo = new MutationObserver((recs) => {
      recs.forEach((r) => r.addedNodes.forEach((nd) => { if (nd instanceof Element) ro.observe(nd); }));
    });
    mo.observe(el, { childList: true });
    const onLoad = () => {
      if (Date.now() < pinUntil.current && !userMoved.current) jumpToBottom();
    };
    el.addEventListener("load", onLoad, true);
    el.addEventListener("loadedmetadata", onLoad, true);
    const stop = () => { userMoved.current = true; };
    el.addEventListener("wheel", stop, { passive: true });
    el.addEventListener("touchmove", stop, { passive: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener("load", onLoad, true);
      el.removeEventListener("loadedmetadata", onLoad, true);
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchmove", stop);
    };
  }, [chatKey]);

  useLayoutEffect(() => {
    const container = messagesScrollRef.current;
    if (!container) return;
    const first = lastLen.current === 0 && messages.length > 0;
    const sameList = !first && messages.length === lastLen.current && (messages[messages.length - 1]?.id ?? null) === lastId.current;
    lastLen.current = messages.length;
    if (sameList && isTyping === lastTyping.current && !(Date.now() < pinUntil.current && !userMoved.current)) return;
    lastTyping.current = isTyping;
    if (first || (Date.now() < pinUntil.current && !userMoved.current)) {
      if (first) pinUntil.current = Date.now() + 2500;
      lastId.current = messages[messages.length - 1]?.id ?? null;
      jumpToBottom();
      setNewCount(0);
      return;
    }
    const lastMsg = messages[messages.length - 1];
    const isNew = !!lastMsg && lastMsg.id !== lastId.current;
    lastId.current = lastMsg?.id ?? null;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < SCROLL_NEAR_BOTTOM_PX || (isNew && lastMsg?.out)) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      setNewCount(0);
    } else if (isNew && lastMsg && !lastMsg.out) {
      setNewCount((n) => n + 1);
    }
  }, [messages, isTyping]);

  const handleMessagesScroll = () => {
    const container = messagesScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const down = distanceFromBottom > SCROLL_SHOW_DOWN_PX;
    if (down !== showDownRef.current) { showDownRef.current = down; setShowScrollDown(down); }
    if (distanceFromBottom < SCROLL_RESET_NEW_PX) setNewCount(0);
  };

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setNewCount(0);
  };

  return { messagesScrollRef, endRef, showScrollDown, newCount, handleMessagesScroll, scrollToBottom };
}
