import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs, timeAgo, formatNum } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface DevUser {
  id: number;
  name: string;
  phone: string;
  created_at: number;
  last_seen: number | null;
  avatar_url: string | null;
  online: boolean;
}

interface UserDetail extends DevUser {
  about: string | null;
  banned_until: number | null;
  banned_reason: string | null;
  messages: number;
  contacts: number;
}

export default function DevUsers() {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [busy, setBusy] = useState(false);

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

  const openUser = async (id: number) => {
    try {
      const res = await devApi<{ user: UserDetail }>("user_detail", { user_id: id });
      setDetail(res.user);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось открыть");
    }
  };

  const ban = async (id: number, days: number) => {
    setBusy(true);
    try {
      await devApi("ban_user", { user_id: id, days, reason: days > 0 ? "Нарушение правил" : "" });
      await openUser(id);
      await load(query);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось");
    } finally {
      setBusy(false);
    }
  };

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
                          <div className="font-medium truncate">{u.name || "Без имени"}</div>
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
                        onClick={() => openUser(u.id)}
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

      {detail && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-[#12131f] border border-white/10 rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-5">
              {detail.avatar_url ? (
                <img src={detail.avatar_url} alt="" className="w-14 h-14 rounded-2xl object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-lg font-bold">
                  {(detail.name || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{detail.name || "Без имени"}</h3>
                <p className="text-sm text-slate-400">{detail.phone}</p>
                <p className="text-xs text-slate-600 mt-0.5">ID {detail.id}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-500 hover:text-slate-300">
                <Icon name="X" size={18} />
              </button>
            </div>

            {detail.banned_until && detail.banned_until > Date.now() / 1000 && (
              <div className="mb-4 flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <Icon name="Ban" size={16} className="mt-0.5 shrink-0" />
                <div>
                  <div>Заблокирован до {formatTs(detail.banned_until)}</div>
                  {detail.banned_reason && <div className="text-xs opacity-70 mt-0.5">{detail.banned_reason}</div>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5">
              <InfoBox label="Сообщений" value={formatNum(detail.messages)} />
              <InfoBox label="Контактов" value={formatNum(detail.contacts)} />
              <InfoBox label="Регистрация" value={formatTs(detail.created_at)} />
              <InfoBox label="Был в сети" value={timeAgo(detail.last_seen)} />
            </div>

            {detail.about && (
              <div className="mb-5 text-sm text-slate-400 bg-white/[0.03] rounded-xl px-3 py-2.5">{detail.about}</div>
            )}

            <div className="flex flex-wrap gap-2">
              {detail.banned_until && detail.banned_until > Date.now() / 1000 ? (
                <button
                  onClick={() => ban(detail.id, 0)}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition disabled:opacity-50"
                >
                  Разблокировать
                </button>
              ) : (
                <>
                  <button
                    onClick={() => ban(detail.id, 7)}
                    disabled={busy}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-sm font-medium hover:bg-amber-500/25 transition disabled:opacity-50"
                  >
                    Бан 7 дней
                  </button>
                  <button
                    onClick={() => ban(detail.id, 3650)}
                    disabled={busy}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-medium hover:bg-red-500/25 transition disabled:opacity-50"
                  >
                    Бан навсегда
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}
