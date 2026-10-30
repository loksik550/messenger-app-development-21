import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { badgeSrc, isKnownBadge, BADGE_TITLES, BADGE_DESC, BADGE_RARITY, RARITY } from "@/lib/badges";

interface Detail { code: string; serial: number; supply: number | null; note: string | null; method: string; created_at: number }

const cache = new Map<number, Promise<Detail[]>>();
function loadDetails(ownerId: number): Promise<Detail[]> {
  let p = cache.get(ownerId);
  if (!p) {
    let me = 0;
    try { me = JSON.parse(localStorage.getItem("nova_user") || "null")?.id || 0; } catch { /* ignore */ }
    p = api("shop_user_badges", { target_user_id: ownerId }, me || undefined)
      .then((r) => (r?.badges as Detail[]) || [])
      .catch(() => []);
    cache.set(ownerId, p);
    setTimeout(() => cache.delete(ownerId), 60000);
  }
  return p;
}

function BadgeTip({ code, ownerId, x, y, onClose }: { code: string; ownerId?: number; x: number; y: number; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    loadDetails(ownerId).then((list) => { if (alive) setD(list.find((b) => b.code === code) || null); });
    return () => { alive = false; };
  }, [code, ownerId]);
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [onClose]);

  const r = RARITY[BADGE_RARITY[code] || "common"];
  const W = 240;
  const left = Math.max(8, Math.min(x - W / 2, window.innerWidth - W - 8));
  const below = y < 200;
  const reason = d?.note || BADGE_DESC[code];
  const date = d?.created_at ? new Date(d.created_at * 1000).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" }) : null;

  return createPortal(
    <div className="fixed inset-0 z-[500]" onClick={(e) => { e.stopPropagation(); onClose(); }} onContextMenu={(e) => e.preventDefault()}>
      <div
        className="absolute rounded-2xl p-3 shadow-2xl animate-scale-in text-left"
        style={{
          left, width: W,
          top: below ? y + 14 : undefined,
          bottom: below ? undefined : window.innerHeight - y + 14,
          background: "rgba(20,18,32,0.97)",
          border: `1px solid ${r.glow}66`,
          boxShadow: `0 10px 40px rgba(0,0,0,.6), 0 0 24px ${r.glow}33`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <img src={badgeSrc(code)} alt="" className="w-11 h-11 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{BADGE_TITLES[code]}</div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: r.color }}>
              {r.label}{d ? ` · №${d.serial}${d.supply ? ` из ${d.supply}` : ""}` : ""}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-300 mt-2 leading-snug">{reason}</p>
        {d && (
          <p className="text-[10px] text-slate-500 mt-1.5">
            {d.method === "admin" ? "Выдан командой Nova" : "Куплен в магазине"}{date ? ` · ${date}` : ""}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Значки пользователя рядом с именем. Нажатие на значок — подсказка: что это и за что выдан. */
export default function BadgeIcons({ codes, size = 16, max = 3, ownerId }: { codes?: string[] | null; size?: number; max?: number; ownerId?: number }) {
  const [tip, setTip] = useState<{ code: string; x: number; y: number } | null>(null);
  const list = (codes || []).filter(isKnownBadge);
  if (list.length === 0) return null;
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  return (
    <span className="inline-flex items-center gap-0.5 flex-shrink-0">
      {shown.map((c) => (
        <img
          key={c}
          src={badgeSrc(c)}
          alt={BADGE_TITLES[c]}
          width={size}
          height={size}
          loading="lazy"
          draggable={false}
          role="button"
          className="select-none cursor-pointer active:scale-90 transition-transform"
          style={{ width: size, height: size }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const rc = e.currentTarget.getBoundingClientRect();
            setTip({ code: c, x: rc.left + rc.width / 2, y: rc.top < 200 ? rc.bottom : rc.top });
          }}
        />
      ))}
      {rest > 0 && <span className="text-[10px] text-muted-foreground font-semibold ml-0.5">+{rest}</span>}
      {tip && <BadgeTip code={tip.code} ownerId={ownerId} x={tip.x} y={tip.y} onClose={() => setTip(null)} />}
    </span>
  );
}
