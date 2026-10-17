import type { KeyboardEvent } from "react";

const isTouch = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);

/** Enter отправляет только на компьютере. На телефоне Enter — новая строка, отправка только кнопкой. */
export function isSendKey(e: KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key !== "Enter" || e.shiftKey) return false;
  const ne = e.nativeEvent as globalThis.KeyboardEvent;
  if (ne.isComposing || ne.keyCode === 229) return false;
  return !isTouch;
}
