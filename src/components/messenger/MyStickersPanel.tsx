import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";

interface Item { id: number; emoji: string; image_url: string }

const EMOJI = ["🙂", "😂", "😍", "🥰", "😎", "🤔", "😢", "😭", "😡", "🤯", "🥳", "😴", "👍", "👎", "👏", "🙏", "🔥", "💯", "❤️", "💔", "🎉", "🤝", "😱", "🤡", "👻", "🐱", "🐶", "🌚", "⭐", "💪", "😏", "🫶"];

export default function MyStickersPanel({ currentUser, onClose }: { currentUser: User; onClose: () => void }) {
  useEdgeSwipeBack(onClose);
  const [items, setItems] = useState<Item[] | null>(null);
  const [active, setActive] = useState<Item | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1800); };

  const load = () => {
    api("stickers_personal_list", {}, currentUser.id)
      .then((r) => setItems(Array.isArray(r?.items) ? r.items : []))
      .catch(() => setItems([]));
  };

  useEffect(load, [currentUser.id]);

  const setEmoji = async (emoji: string) => {
    if (!active || busy) return;
    setBusy(true);
    const r = await api("stickers_personal_update", { sticker_id: active.id, emoji }, currentUser.id).catch(() => null);
    setBusy(false);
    if (!r || r.error) { flash(r?.error || "Не удалось сохранить"); return; }
    setItems((p) => (p || []).map((x) => (x.id === active.id ? { ...x, emoji } : x)));
    setActive((a) => (a ? { ...a, emoji } : a));
    flash("Эмодзи изменён");
  };

  const remove = async () => {
    if (!active || busy) return;
    setBusy(true);
    const r = await api("stickers_personal_delete", { sticker_id: active.id }, currentUser.id).catch(() => null);
    setBusy(false);
    setConfirmDel(false);
    if (!r || r.error) { flash(r?.error || "Не удалось удалить"); return; }
    setItems((p) => (p || []).filter((x) => x.id !== active.id));
    setActive(null);
    flash("Стикер удалён");
  };

  return createPortal(
    <div className="fixed inset-0 z-[270] bg-background flex flex-col animate-fade-in">
      <div className="flex items-center gap-2 px-3 py-2 glass-strong border-b border-white/5" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8" aria-label="Назад"><Icon name="ChevronLeft" size={20} /></button>
        <Icon name="Sticker" size={18} className="text-pink-400" />
        <h2 className="font-bold flex-1">Мои стикеры</h2>
        {items && items.length > 0 && <span className="text-xs text-muted-foreground pr-2">{items.length}</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-3" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
        {items === null ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center pt-14 px-6">
            <div className="w-16 h-16 mx-auto rounded-3xl grad-primary flex items-center justify-center mb-3">
              <Icon name="Sticker" size={28} className="text-white" />
            </div>
            <h3 className="font-bold text-base mb-1">Пока нет своих стикеров</h3>
            <p className="text-sm text-muted-foreground">Откройте любое фото в чате, нажмите «⋮» и выберите «Создать стикер».</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3 px-1">Нажмите на стикер, чтобы поменять эмодзи или удалить его.</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setActive(it)}
                  className="relative aspect-square rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition p-2"
                >
                  <img src={it.image_url} alt={it.emoji} className="w-full h-full object-contain" draggable={false} loading="lazy" />
                  {it.emoji && (
                    <span className="absolute bottom-1 right-1 text-base leading-none bg-black/40 rounded-full w-7 h-7 flex items-center justify-center">{it.emoji}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {active && (
        <div className="fixed inset-0 z-[275] bg-black/60 flex items-end sm:items-center justify-center animate-fade-in" onClick={() => { setActive(null); setConfirmDel(false); }}>
          <div
            className="w-full sm:max-w-sm glass-strong rounded-t-3xl sm:rounded-3xl p-4 animate-scale-in"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-3">
              <img src={active.image_url} alt="" className="w-36 h-36 object-contain" draggable={false} />
            </div>
            <div className="text-sm font-semibold mb-2">Эмодзи стикера</div>
            <div className="grid grid-cols-8 gap-1 mb-4">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  disabled={busy}
                  onClick={() => setEmoji(e)}
                  className={`text-2xl h-10 rounded-xl flex items-center justify-center transition ${active.emoji === e ? "bg-violet-500/30 ring-1 ring-violet-400" : "hover:bg-white/10"}`}
                >
                  {e}
                </button>
              ))}
            </div>
            {confirmDel ? (
              <div className="flex gap-2">
                <button onClick={() => setConfirmDel(false)} className="flex-1 py-3 rounded-2xl bg-white/8 text-sm font-medium">Отмена</button>
                <button onClick={remove} disabled={busy} className="flex-1 py-3 rounded-2xl bg-red-500/20 text-red-400 text-sm font-semibold disabled:opacity-60">
                  {busy ? "Удаляем…" : "Да, удалить"}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setActive(null)} className="flex-1 py-3 rounded-2xl bg-white/8 text-sm font-medium">Готово</button>
                <button onClick={() => setConfirmDel(true)} className="flex-1 py-3 rounded-2xl bg-red-500/15 text-red-400 text-sm font-semibold flex items-center justify-center gap-2">
                  <Icon name="Trash2" size={16} /> Удалить
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[280] px-4 py-2 rounded-full glass-strong text-sm animate-fade-in pointer-events-none">{toast}</div>
      )}
    </div>,
    document.body,
  );
}
