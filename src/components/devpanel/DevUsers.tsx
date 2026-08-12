import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs, timeAgo, formatNum } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";
import DevUserCard from "./DevUserCard";

interface DevUser {
  id: number;
  name: string;
  phone: string;
  created_at: number;
  last_seen: number | null;
  avatar_url: string | null;
  online: boolean;
  verified?: boolean;
}

export default function DevUsers({ can }: { can: (p: string) => boolean }) {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cardId, setCardId] = useState<number | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await devApi<{ users: DevUser[]; total: number }>("users", { query: q });
      setUsers(res.users);
      setTotal(res.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 flex-1 min-w-[240px] focus-within:border-violet-500/40 transition">
          <Icon name="Search" size={16} className="text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или номеру"
            className="flex-1 bg-transparent outline-none text-sm placeholder-slate-600"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-500 hover:text-slate-300">
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
        <div className="text-sm text-slate-500">Всего: {formatNum(total)}</div>
        <button
          onClick={() => load(query)}
          className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 transition"
          title="Обновить"
        >
          <Icon name="RefreshCw" size={16} className="text-slate-400" />
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox text={error} onRetry={() => load(query)} />
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">Никого не найдено</div>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-white/8">
                  <th className="px-4 py-3 font-medium">Пользователь</th>
                  <th className="px-4 py-3 font-medium">Телефон</th>
                  <th className="px-4 py-3 font-medium">Регистрация</th>
                  <th className="px-4 py-3 font-medium">Был в сети</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-xs font-bold">
                              {(u.name || "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          {u.online && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0a0b14]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="font-medium truncate">{u.name || "Без имени"}</div>
                            {u.verified && (
                              <Icon name="BadgeCheck" size={14} className="text-sky-400 shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-slate-500">ID {u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{u.phone}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatTs(u.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.online ? (
                        <span className="text-emerald-400 text-xs">в сети</span>
                      ) : (
                        <span className="text-slate-500 text-xs">{timeAgo(u.last_seen)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setCardId(u.id)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition"
                      >
                        Подробнее
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cardId !== null && (
        <DevUserCard
          userId={cardId}
          can={can}
          onClose={() => setCardId(null)}
          onChanged={() => load(query)}
        />
      )}
    </div>
  );
}

