import { useState } from "react";
import Icon from "@/components/ui/icon";

export type FabItem = { key: string; label: string; icon: string; color: string; onClick: () => void };

const ANGLES = [8, 30, 52];

export default function FabMenu({ items, label }: { items: FabItem[]; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={`absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setOpen(false)}
      />
      <div className="absolute right-4 bottom-4 z-30 w-14 h-14" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="absolute left-1/2 top-1/2 w-0 h-0">
          {items.map((it, i) => (
            <button
              key={it.key}
              onClick={() => { setOpen(false); it.onClick(); }}
              tabIndex={open ? 0 : -1}
              aria-hidden={!open}
              className="absolute right-11 -top-[22px] h-11 pl-3 pr-4 flex items-center gap-2 whitespace-nowrap rounded-2xl bg-white text-slate-900 text-sm font-semibold shadow-xl shadow-black/40 border border-black/5"
              style={{
                transformOrigin: "calc(100% + 2.75rem) 50%",
                transform: open ? `rotate(${ANGLES[i] ?? 8 + i * 22}deg) scale(1)` : "rotate(-20deg) scale(0.4)",
                opacity: open ? 1 : 0,
                pointerEvents: open ? "auto" : "none",
                transition: "transform 420ms cubic-bezier(.34,1.56,.64,1), opacity 220ms ease",
                transitionDelay: open ? `${i * 70}ms` : `${(items.length - 1 - i) * 40}ms`,
              }}
            >
              <Icon name={it.icon} size={18} className={it.color} />
              {it.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? "Закрыть меню" : label}
          aria-expanded={open}
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/40 active:scale-95 transition-transform"
        >
          <Icon
            name="Plus"
            size={26}
            className="transition-transform duration-300"
            style={{ transform: open ? "rotate(135deg)" : "none" }}
          />
        </button>
      </div>
    </>
  );
}
