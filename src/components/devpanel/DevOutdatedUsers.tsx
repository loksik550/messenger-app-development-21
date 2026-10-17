import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";

interface OutdatedUser {
  id: number;
  name: string;
  avatar_url: string | null;
  version: string;
  last_seen: number;
  nudged: boolean;
}

function fmtSeen(ts: number) {
  if (!ts) return "давно";
  const diff = Date.now() / 1000 - ts;
  if (diff < 300) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  const d = new Date(ts * 1000);
  const today = new Date();
  const time = d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `сегодня в ${time}`;
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `вчера в ${time}`;
  return d.toLocaleDateString("ru", { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" }) + ` в ${time}`;
}

export default function DevOutdatedUsers({ latest, onClose }: { latest: string; onClose: () => void }) {
  const [users, setUsers] = useState<OutdatedUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState("");

  useEffect(() => {
    devApi<{ users: OutdatedUser[]; total: number }>("app_outdated_users", { latest })
      .then((r) => { setUsers(r.users); setTotal(r.total); })
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить список"));
  }, [latest]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const versions = useMemo(() => Array.from(new Set((users || []).map((u) => u.version))), [users]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users || []).filter((u) =>
      (!version || u.version === version) &&
      (!q || u.name.toLowerCase().includes(q) || String(u.id).includes(q)),
    );
  }, [users, query, version]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-[#12101c] border border-white/10 w-full sm:max-w-lg max-h-[88vh] rounded-t-2xl sm:rounded-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-white/10">
          <div className="min-w-0">
            <h3 className="font-semibold">На устаревшей версии</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {users ? `${formatNum(total)} чел.` : "Загружаем…"} · актуальная <span className="text-emerald-400">{latest}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400" aria-label="Закрыть">
            <Icon name="X" size={18} />
          </button>
        </div>

        {users && users.length > 0 && (
          <div className="p-3 border-b border-white/5 space-y-2">
            <div className="relative">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по имени или ID"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-violet-500/50"
              />
            </div>
            {versions.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                {["", ...versions].map((v) => (
                  <button
                    key={v || "all"}
                    onClick={() => setVersion(v)}
                    className={`px-2.5 py-1 rounded-lg text-xs ${version === v ? "bg-violet-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
                  >
                    {v || "Все"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {error ? (
            <div className="text-sm text-red-300 p-4 text-center">{error}</div>
          ) : !users ? (
            <div className="flex justify-center p-8"><Icon name="Loader2" size={22} className="animate-spin text-slate-500" /></div>
          ) : shown.length === 0 ? (
            <div className="text-sm text-slate-500 p-8 text-center">
              {users.length === 0 ? "Все пользователи уже обновились" : "Никого не нашли"}
            </div>
          ) : (
            shown.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.03]">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                    {(u.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    ID {u.id} · заходил {fmtSeen(u.last_seen)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">{u.version}</span>
                  {u.nudged && <span className="text-[10px] text-slate-500">напомнили</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
