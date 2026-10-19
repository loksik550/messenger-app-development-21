import { useEffect, useRef } from "react";

/**
 * Долгое нажатие на сообщение — одно на весь список.
 * Сообщения помечаются data-hold-id / data-hold-out. Слушаем касания в фазе
 * захвата, поэтому срабатывает и на iPhone, и над фото, кружками и голосовыми.
 * После срабатывания ближайший клик гасится, чтобы не открылось фото.
 */
export function useHoldDelegate(onHold: (id: number, out: boolean) => void, enabled = true, delay = 450) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const firedAt = useRef(0);
  const cb = useRef(onHold);
  cb.current = onHold;

  const cancel = () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    start.current = null;
  };

  useEffect(() => cancel, []);

  const fire = (id: number, out: boolean) => {
    firedAt.current = Date.now();
    try { (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(15); } catch { /* ignore */ }
    cb.current(id, out);
  };

  const target = (el: EventTarget | null) => {
    const node = (el as HTMLElement | null)?.closest?.("[data-hold-id]") as HTMLElement | null;
    if (!node) return null;
    const id = Number(node.dataset.holdId);
    if (!id || id < 0) return null;
    return { id, out: node.dataset.holdOut === "1" };
  };

  return {
    onTouchStartCapture: (e: React.TouchEvent) => {
      cancel();
      if (!enabled || e.touches.length !== 1) return;
      const t = target(e.target);
      if (!t) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      timer.current = window.setTimeout(() => { timer.current = null; start.current = null; fire(t.id, t.out); }, delay);
    },
    onTouchMoveCapture: (e: React.TouchEvent) => {
      if (!start.current || !e.touches[0]) return;
      if (Math.abs(e.touches[0].clientX - start.current.x) > 10 || Math.abs(e.touches[0].clientY - start.current.y) > 10) cancel();
    },
    onTouchEndCapture: (e: React.TouchEvent) => {
      cancel();
      if (Date.now() - firedAt.current < 700 && e.cancelable) e.preventDefault();
    },
    onTouchCancelCapture: cancel,
    onClickCapture: (e: React.MouseEvent) => {
      if (Date.now() - firedAt.current < 700) { e.preventDefault(); e.stopPropagation(); }
    },
    onContextMenuCapture: (e: React.MouseEvent) => {
      const t = target(e.target);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      if (!enabled) return;
      if (Date.now() - firedAt.current < 1000) return;
      fire(t.id, t.out);
    },
  };
}
