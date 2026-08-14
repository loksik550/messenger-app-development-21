import { useEffect, useState, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { devApi } from "@/lib/devApi";

interface Item {
  id: number;
  title: string;
  sub: string;
  avatar?: string;
}

interface Group {
  key: string;
  label: string;
  section: string;
  items: Item[];
}

const GROUP_ICON: Record<string, string> = {
  users: "Users", channels: "Radio", payments: "Receipt", support: "LifeBuoy",
};

/** Поиск по всей панели — открывается на Ctrl+K */
export default function DevSearch({
  open, onClose, onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (section: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => ref.current?.focus(), 50);
    } else {
      setQuery("");
      setGroups([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  const search = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setGroups([]);
      return;
    }
    setLoading(true);
    devApi<{ groups: Group[] }>("global_search", { query: q })
      .then((r) => setGroups(r.groups))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  if (!open) return null;

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div
      className="fixed inset-0 z-[180] bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="bg-[#12131f] border border-white/12 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
          <Icon name="Search" size={17} className="text-slate-500 shrink-0" />
          <input
            ref={ref}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя, телефон, номер заказа, тема обращения..."
            className="flex-1 bg-transparent outline-none text-sm placeholder-slate-600"
          />
          {loading && (
            <Icon name="Loader2" size={15} className="text-slate-500 animate-spin shrink-0" />
          )}
          <kbd className="hidden sm:block text-[10px] text-slate-600 border border-white/10 rounded px-1.5 py-0.5 shrink-0">
            Esc
          </kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="px-5 py-8 text-center">
              <div className="text-sm text-slate-500">Начните вводить — найду везде сразу</div>
              <div className="text-xs text-slate-600 mt-2 leading-relaxed">
                Люди, каналы, платежи и обращения в поддержку
              </div>
            </div>
          ) : total === 0 && !loading ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">
              Ничего не нашлось по «{query}»
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.key}>
                <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                  <Icon name={GROUP_ICON[g.key] || "Circle"} size={12} className="text-slate-600" />
                  <span className="text-[10px] tracking-wide text-slate-600 uppercase">
                    {g.label}
                  </span>
                </div>
                {g.items.map((it) => (
                  <button
                    key={`${g.key}-${it.id}`}
                    onClick={() => {
                      onNavigate(g.section);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition text-left"
                  >
                    {it.avatar ? (
                      <img src={it.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                        {(it.title || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{it.title}</div>
                      <div className="text-xs text-slate-500 truncate">{it.sub}</div>
                    </div>
                    <Icon name="ArrowRight" size={13} className="text-slate-600 shrink-0" />
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Подсказка по горячим клавишам */
export function DevShortcuts({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  const rows = [
    { keys: ["Ctrl", "K"], label: "Поиск по всей панели" },
    { keys: ["G", "D"], label: "Перейти на дашборд" },
    { keys: ["G", "U"], label: "Перейти к пользователям" },
    { keys: ["G", "P"], label: "Перейти к платежам" },
    { keys: ["G", "S"], label: "Перейти в поддержку" },
    { keys: ["G", "R"], label: "Перейти к жалобам" },
    { keys: ["?"], label: "Показать эту подсказку" },
    { keys: ["Esc"], label: "Закрыть окно" },
  ];

  return (
    <div
      className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#12131f] border border-white/12 rounded-2xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Горячие клавиши</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <Icon name="X" size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">{r.label}</span>
              <div className="flex gap-1 shrink-0">
                {r.keys.map((k) => (
                  <kbd
                    key={k}
                    className="text-[10px] bg-white/[0.06] border border-white/12 rounded px-1.5 py-0.5 min-w-[22px] text-center"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-600 mt-4">
          Переход: нажмите G, отпустите, затем вторую букву
        </p>
      </div>
    </div>
  );
}
