import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

export interface NovaToastItem {
  id: number;
  kind: string;
  title: string;
  body: string;
}

const META: Record<string, { icon: string; ring: string; bg: string; color: string }> = {
  verification: { icon: "BadgeCheck", ring: "ring-sky-500/30", bg: "bg-sky-500/15", color: "text-sky-400" },
  ban: { icon: "ShieldX", ring: "ring-red-500/30", bg: "bg-red-500/15", color: "text-red-400" },
  unban: { icon: "ShieldCheck", ring: "ring-emerald-500/30", bg: "bg-emerald-500/15", color: "text-emerald-400" },
  promo: { icon: "Gift", ring: "ring-amber-500/30", bg: "bg-amber-500/15", color: "text-amber-400" },
  premium: { icon: "Crown", ring: "ring-amber-500/30", bg: "bg-amber-500/15", color: "text-amber-400" },
  referral: { icon: "Users", ring: "ring-violet-500/30", bg: "bg-violet-500/15", color: "text-violet-400" },
  system: { icon: "Bell", ring: "ring-violet-500/30", bg: "bg-violet-500/15", color: "text-violet-400" },
};

const SHOW_MS = 7000;

function ToastCard({ item, onClose }: { item: NovaToastItem; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const meta = META[item.kind] || META.system;

  useEffect(() => {
    const hide = setTimeout(() => setLeaving(true), SHOW_MS);
    const kill = setTimeout(onClose, SHOW_MS + 350);
    return () => {
      clearTimeout(hide);
      clearTimeout(kill);
    };
  }, [onClose]);

  return (
    <div
      className={`pointer-events-auto w-full bg-[#171827] border border-white/12 rounded-2xl shadow-2xl ring-1 ${meta.ring} overflow-hidden transition-all duration-300 ${
        leaving ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0 animate-slide-up"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}>
          <Icon name={meta.icon} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-snug">{item.title}</div>
          {item.body && (
            <div className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{item.body}</div>
          )}
        </div>
        <button
          onClick={() => { setLeaving(true); setTimeout(onClose, 300); }}
          className="p-1.5 rounded-lg hover:bg-white/8 transition text-muted-foreground shrink-0"
        >
          <Icon name="X" size={15} />
        </button>
      </div>
      <div className="h-0.5 bg-white/5">
        <div
          className="h-full grad-primary"
          style={{ animation: `novaToastBar ${SHOW_MS}ms linear forwards` }}
        />
      </div>
    </div>
  );
}

export default function NovaToaster({
  items, onDismiss,
}: {
  items: NovaToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="fixed top-3 left-0 right-0 z-[400] flex flex-col items-center gap-2 px-3 pointer-events-none"
      style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="w-full max-w-sm flex flex-col gap-2">
        {items.slice(0, 3).map((it) => (
          <ToastCard key={it.id} item={it} onClose={() => onDismiss(it.id)} />
        ))}
      </div>
    </div>
  );
}
