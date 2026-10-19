import { useState } from "react";
import Icon from "@/components/ui/icon";

export const VIEWER_REACTIONS = ["❤️", "👍", "👎", "🔥", "🥰", "👏", "😁"];
const MORE_REACTIONS = ["😂", "😮", "😢", "😭", "😡", "🤯", "🥳", "😎", "🤔", "🙏", "💯", "✨", "⭐", "💪", "💔", "💜", "🎉", "🎁", "🚀", "🤡", "👻", "🌚", "💎", "🏆", "🤝", "😍", "😴", "🤩"];

export interface PhotoMenuItem {
  key: string;
  icon: string;
  label: string;
  danger?: boolean;
  divider?: boolean;
  onClick: () => void;
}

export function MenuList({ items, className = "" }: { items: PhotoMenuItem[]; className?: string }) {
  return (
    <div className={`rounded-[22px] bg-[#232733]/85 backdrop-blur-2xl border border-white/10 shadow-2xl py-1.5 overflow-hidden ${className}`}>
      {items.map((it) => (
        <div key={it.key}>
          {it.divider && <div className="mx-4 my-1.5 h-px bg-white/10" />}
          <button
            onClick={it.onClick}
            className={`w-full flex items-center gap-4 px-5 py-3 text-[16px] text-left active:bg-white/10 hover:bg-white/5 transition-colors ${it.danger ? "text-red-400" : "text-white"}`}
          >
            <Icon name={it.icon} size={22} className={it.danger ? "text-red-400" : "text-white"} />
            {it.label}
          </button>
        </div>
      ))}
    </div>
  );
}

export function PhotoLongPressMenu({ url, isVideo, items, onReact, onClose }: {
  url: string;
  isVideo: boolean;
  items: PhotoMenuItem[];
  onReact?: (emoji: string) => void;
  onClose: () => void;
}) {
  const [more, setMore] = useState(false);
  return (
    <div
      className="fixed inset-0 z-[40] bg-black/75 backdrop-blur-md flex flex-col items-start justify-center gap-3 px-3 overflow-y-auto animate-fade-in"
      style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))", paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {onReact && (
        <div className="animate-scale-in origin-bottom-left max-w-full" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-[#232733]/90 border border-white/10 shadow-2xl">
            {VIEWER_REACTIONS.map((e) => (
              <button key={e} onClick={() => onReact(e)} className="text-[28px] w-11 h-11 flex items-center justify-center rounded-full active:scale-90 hover:scale-110 transition-transform">
                {e}
              </button>
            ))}
            <button
              onClick={() => setMore((v) => !v)}
              className="w-10 h-10 ml-0.5 rounded-full bg-white/15 flex items-center justify-center text-white"
              aria-label="Ещё реакции"
            >
              <Icon name={more ? "ChevronUp" : "ChevronDown"} size={20} />
            </button>
          </div>
          {more && (
            <div className="mt-2 grid grid-cols-7 gap-1 p-2 rounded-3xl bg-[#232733]/90 border border-white/10 shadow-2xl animate-fade-in">
              {MORE_REACTIONS.map((e) => (
                <button key={e} onClick={() => onReact(e)} className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl active:scale-90 hover:bg-white/10">
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="animate-scale-in origin-left" onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video src={url} muted playsInline className="max-h-[40vh] max-w-[70vw] rounded-[22px] bg-black" />
        ) : (
          <img src={url} alt="" draggable={false} className="max-h-[40vh] max-w-[70vw] rounded-[22px] object-contain shadow-2xl" />
        )}
      </div>

      <div className="animate-scale-in origin-top-left w-[min(78vw,320px)]" onClick={(e) => e.stopPropagation()}>
        <MenuList items={items} />
      </div>
    </div>
  );
}
