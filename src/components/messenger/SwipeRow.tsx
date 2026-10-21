import { useRef, useState, type ReactNode } from "react";
import Icon from "@/components/ui/icon";

export interface SwipeAction {
  key: string;
  icon: string;
  label: string;
  bg: string;
  run: () => void;
}

const ACTION_W = 76;

export function swipeActions(o: {
  muted?: boolean;
  archived?: boolean;
  onMute?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
}): SwipeAction[] {
  return [
    ...(o.onMute ? [{ key: "mute", icon: o.muted ? "Volume2" : "VolumeX", label: o.muted ? "Вкл. звук" : "Убрать звук", bg: "#c27c2c", run: o.onMute }] : []),
    ...(o.onDelete ? [{ key: "del", icon: "Trash2", label: "Удалить", bg: "#b8291f", run: o.onDelete }] : []),
    ...(o.onArchive ? [{ key: "arch", icon: o.archived ? "ArchiveRestore" : "Archive", label: o.archived ? "Из архива" : "В архив", bg: "#6b6b6b", run: o.onArchive }] : []),
  ];
}

export default function SwipeRow({
  actions, open, onOpenChange, onTap, onLongPress, className, children,
}: {
  actions: SwipeAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTap: () => void;
  onLongPress?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const maxOpen = actions.length * ACTION_W;
  const base = open ? -maxOpen : 0;
  const [drag, setDrag] = useState<number | null>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const horizontal = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swiped = useRef(false);
  const held = useRef(false);

  const dx = drag ?? base;

  const cancelHold = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } };
  const startHold = () => {
    cancelHold();
    held.current = false;
    if (!onLongPress) return;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      try { (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(15); } catch { /* ignore */ }
      onLongPress();
    }, 450);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    horizontal.current = false;
    swiped.current = false;
    startHold();
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null || !actions.length) return;
    const dxRaw = e.touches[0].clientX - startX.current;
    const dyRaw = e.touches[0].clientY - startY.current;
    if (Math.abs(dxRaw) > 6 || Math.abs(dyRaw) > 6) cancelHold();
    if (!horizontal.current && Math.abs(dxRaw) > 8 && Math.abs(dxRaw) > Math.abs(dyRaw) * 1.2) {
      horizontal.current = true;
    }
    if (horizontal.current) {
      swiped.current = true;
      let next = base + dxRaw;
      if (next > 0) next = 0;
      if (next < -maxOpen) next = -maxOpen - (-maxOpen - next) * 0.25;
      setDrag(next);
    }
  };
  const onTouchEnd = () => {
    cancelHold();
    if (horizontal.current && drag !== null) {
      onOpenChange(open ? drag < -maxOpen * 0.7 : drag < -maxOpen * 0.3);
    }
    setDrag(null);
    startX.current = null;
    startY.current = null;
    horizontal.current = false;
  };

  const reveal = maxOpen ? Math.min(1, Math.max(0, -dx / maxOpen)) : 0;

  return (
    <div className="relative mx-2 overflow-hidden rounded-2xl">
      {dx < 0 && (
        <div className="absolute inset-y-0 right-0 flex items-center" style={{ width: maxOpen, opacity: reveal }}>
          {actions.map(a => (
            <button
              key={a.key}
              onClick={(e) => { e.stopPropagation(); onOpenChange(false); a.run(); }}
              className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
              style={{ width: ACTION_W }}
            >
              <span className="w-[62px] h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: a.bg }}>
                <Icon name={a.icon} size={17} />
              </span>
              <span className="text-[10.5px] text-muted-foreground leading-none whitespace-nowrap">{a.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => {
          if (swiped.current) { swiped.current = false; return; }
          if (held.current) { held.current = false; return; }
          if (open) { onOpenChange(false); return; }
          onTap();
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onContextMenu={onLongPress ? (e) => { e.preventDefault(); onLongPress(); } : undefined}
        style={{ transform: `translateX(${dx}px)`, transition: drag === null ? "transform 0.25s cubic-bezier(.2,.8,.2,1)" : "none", touchAction: "pan-y" }}
        className={`relative w-full flex items-center gap-3 transition-colors rounded-2xl ${className || ""}`}
      >
        {children}
      </button>
    </div>
  );
}
