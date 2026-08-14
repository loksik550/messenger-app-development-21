import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { devApi } from "@/lib/devApi";

interface UndoItem {
  id: number;
  action: string;
  label: string;
  ts: number;
}

/**
 * Полоска «Отменить» внизу экрана.
 * Показывает последнее важное действие 30 секунд — успеть вернуть, если ошиблись.
 */
export default function DevUndoBar() {
  const [item, setItem] = useState<UndoItem | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const check = useCallback(() => {
    devApi<{ items: UndoItem[] }>("undo_list")
      .then((r) => {
        const fresh = r.items.find((i) => Date.now() / 1000 - i.ts < 30);
        setItem(fresh || null);
        if (fresh) setLeft(Math.max(1, 30 - Math.floor(Date.now() / 1000 - fresh.ts)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, 6000);
    return () => clearInterval(timer);
  }, [check]);

  useEffect(() => {
    if (!item || left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [item, left]);

  useEffect(() => {
    if (item && left <= 0) setItem(null);
  }, [item, left]);

  const undo = async () => {
    if (!item) return;
    setBusy(true);
    try {
      await devApi("undo_apply", { id: item.id });
      setDone("Действие отменено");
      setItem(null);
      setTimeout(() => setDone(""), 4000);
    } catch (e) {
      setDone(e instanceof Error ? e.message : "Не удалось отменить");
      setTimeout(() => setDone(""), 4000);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[140] px-4">
        <div className="bg-emerald-600/90 backdrop-blur-md border border-emerald-400/30 rounded-2xl px-4 py-2.5 shadow-xl flex items-center gap-2 text-sm text-white">
          <Icon name="RotateCcw" size={15} />
          {done}
        </div>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[140] px-4 w-full max-w-md">
      <div className="bg-[#12131f]/95 backdrop-blur-md border border-white/12 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 relative">
          <span className="text-[10px] font-bold text-slate-400">{left}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-500">Выполнено</div>
          <div className="text-sm truncate">{item.label}</div>
        </div>
        <button
          onClick={undo}
          disabled={busy}
          className="px-3 py-1.5 rounded-xl bg-violet-600/25 border border-violet-500/35 text-violet-200 text-xs font-semibold shrink-0 disabled:opacity-40 flex items-center gap-1.5"
        >
          <Icon name="RotateCcw" size={13} />
          Отменить
        </button>
        <button
          onClick={() => setItem(null)}
          className="text-slate-600 hover:text-slate-400 shrink-0"
        >
          <Icon name="X" size={15} />
        </button>
      </div>
    </div>
  );
}
