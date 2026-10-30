import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";
import { BADGE_DESC, BADGE_RARITY, BADGE_TITLES, RARITY, badgeSrc, isKnownBadge, type Rarity } from "@/lib/badges";

interface Item { code: string; serial: number; supply: number | null; note: string | null; method: string; created_at: number }

const ORDER: Rarity[] = ["legendary", "epic", "rare", "common"];

/** Коллекция значков пользователя: свои или собеседника. Нажатие на значок — подробности. */
export default function BadgeCollection({ ownerId, viewerId, ownerName, isMine, onClose, onOpenShop }: {
  ownerId: number;
  viewerId?: number;
  ownerName: string;
  isMine?: boolean;
  onClose: () => void;
  onOpenShop?: () => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<Item | null>(null);

  useEffect(() => {
    let alive = true;
    api("shop_user_badges", { target_user_id: ownerId }, viewerId || ownerId)
      .then((r) => { if (alive) setItems(((r?.badges as Item[]) || []).filter((b) => isKnownBadge(b.code))); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [ownerId, viewerId]);

  const sorted = (items || []).slice().sort((a, b) => ORDER.indexOf(BADGE_RARITY[a.code] || "common") - ORDER.indexOf(BADGE_RARITY[b.code] || "common"));
  const total = Object.keys(BADGE_TITLES).length;
  const counts = ORDER.map((r) => ({ r, n: sorted.filter((b) => (BADGE_RARITY[b.code] || "common") === r).length }));

  return createPortal(
    <div className="fixed inset-0 z-[320] bg-[#0b0a14] text-white flex flex-col animate-fade-in">
      <div className="flex items-center gap-2 px-3 pb-3" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" aria-label="Назад"><Icon name="ChevronLeft" size={22} /></button>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold">Коллекция значков</div>
          <div className="text-xs text-slate-400 truncate">{isMine ? "Ваши значки" : ownerName}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
        {items === null ? (
          <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" /></div>
        ) : (
          <>
            <div className="rounded-3xl p-4 mb-4 bg-gradient-to-br from-violet-600/25 to-fuchsia-600/10 border border-violet-500/25">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black">{sorted.length}</span>
                <span className="text-sm text-slate-400 mb-1.5">из {total} значков</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${Math.round((sorted.length / total) * 100)}%` }} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
                {counts.map(({ r, n }) => (
                  <span key={r} className="text-[11px] font-semibold" style={{ color: RARITY[r].color }}>{RARITY[r].label}: {n}</span>
                ))}
              </div>
            </div>

            {sorted.length === 0 ? (
              <div className="text-center py-10">
                <Icon name="Award" size={40} className="mx-auto text-slate-600 mb-3" />
                <p className="text-sm text-slate-400">{isMine ? "У вас пока нет значков" : "У пользователя пока нет значков"}</p>
                {isMine && onOpenShop && (
                  <button onClick={() => { onClose(); onOpenShop(); }} className="mt-4 px-5 py-2.5 rounded-2xl grad-primary text-white text-sm font-bold">Открыть магазин</button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {sorted.map((b) => {
                  const r = RARITY[BADGE_RARITY[b.code] || "common"];
                  return (
                    <button
                      key={b.code}
                      onClick={() => setOpen(b)}
                      className="relative overflow-hidden rounded-2xl p-2.5 pt-3 text-center bg-white/[0.04] border active:scale-95 transition"
                      style={{ borderColor: `${r.glow}55` }}
                    >
                      <div className="absolute -top-8 inset-x-0 h-16 blur-2xl opacity-40" style={{ background: r.glow }} />
                      <img src={badgeSrc(b.code)} alt="" className="relative w-14 h-14 mx-auto drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]" />
                      <div className="relative text-[11px] font-bold mt-1.5 truncate">{BADGE_TITLES[b.code]}</div>
                      <div className="relative text-[10px] font-extrabold" style={{ color: r.color }}>
                        №{b.serial}{b.supply ? `/${b.supply}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {isMine && sorted.length > 0 && onOpenShop && (
              <button onClick={() => { onClose(); onOpenShop(); }} className="w-full mt-5 py-3 rounded-2xl bg-white/5 text-sm font-semibold flex items-center justify-center gap-2">
                <Icon name="ShoppingBag" size={16} /> Пополнить коллекцию
              </button>
            )}
          </>
        )}
      </div>

      {open && (() => {
        const r = RARITY[BADGE_RARITY[open.code] || "common"];
        return (
          <div className="fixed inset-0 z-[330] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-fade-in" onClick={() => setOpen(null)}>
            <div className="w-full max-w-sm rounded-3xl p-5 text-center animate-scale-in" style={{ background: "#14121f", border: `1px solid ${r.glow}66`, marginBottom: "env(safe-area-inset-bottom)" }} onClick={(e) => e.stopPropagation()}>
              <div className="relative">
                <div className="absolute inset-x-10 top-0 h-28 blur-3xl opacity-50" style={{ background: r.glow }} />
                <img src={badgeSrc(open.code)} alt="" className="relative w-28 h-28 mx-auto" />
              </div>
              <div className="text-xl font-bold mt-3">{BADGE_TITLES[open.code]}</div>
              <div className="text-xs font-extrabold uppercase tracking-wider mt-1" style={{ color: r.color }}>
                {r.label} · экземпляр №{open.serial}{open.supply ? ` из ${open.supply}` : ""}
              </div>
              <p className="text-sm text-slate-300 mt-3">{open.note || BADGE_DESC[open.code]}</p>
              <p className="text-xs text-slate-500 mt-2">
                {open.method === "admin" ? "Выдан командой Nova" : "Куплен в магазине"} · {new Date(open.created_at * 1000).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <button onClick={() => setOpen(null)} className="w-full mt-4 py-3 rounded-2xl bg-white/10 text-sm font-semibold">Закрыть</button>
            </div>
          </div>
        );
      })()}
    </div>,
    document.body,
  );
}
