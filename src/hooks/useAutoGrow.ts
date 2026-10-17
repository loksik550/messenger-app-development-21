import { useLayoutEffect, useRef } from "react";

export function useAutoGrow(value: string, maxPx = 140) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const h = Math.min(el.scrollHeight, maxPx);
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
    if (document.activeElement === el && el.selectionEnd === value.length) el.scrollTop = el.scrollHeight;
  }, [value, maxPx]);
  return ref;
}
