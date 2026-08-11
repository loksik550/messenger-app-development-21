import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface LogEvent {
  id: string | number;
  source: string;
  who: string;
  action: string;
  details: string;
  ip: string;
  ts: number;
}

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  login: { icon: "LogIn", color: "text-emerald-400", label: "Вход в панель" },
  logout: { icon: "LogOut", color: "text-slate-400", label: "Выход" },
  register: { icon: "UserPlus", color: "text-violet-400", label: "Регистрация админа" },
  signup: { icon: "UserPlus", color: "text-cyan-400", label: "Новый пользователь" },
  ban_user: { icon: "Ban", color: "text-red-400", label: "Блокировка" },
  unban_user: { icon: "CircleCheck", color: "text-emerald-400", label: "Разблокировка" },
  support_reply: { icon: "MessageSquare", color: "text-amber-400", label: "Ответ в поддержку" },
  support_close: { icon: "CircleCheck", color: "text-slate-400", label: "Обращение закрыто" },
  report_resolve: { icon: "ShieldCheck", color: "text-emerald-400", label: "Жалоба решена" },
  create_invite: { icon: "KeyRound", color: "text-violet-400", label: "Создан код" },
};

export default function DevLogs() {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "panel" | "app">("all");

  const load = async () => {
    try {
      const res = await devApi<{ events: LogEvent[] }>("logs");
      setEvents(res.events);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const filtered = events.filter((e) => filter === "all" || e.source === filter);

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {([["all", "Все"], ["panel", "Панель"], ["app", "Приложение"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition ${
              filter === k
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                : "bg-white/[0.04] border border-white/10 text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 transition"
          title="Обновить"
        >
          <Icon name="RefreshCw" size={16} className="text-slate-400" />
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">Событий пока нет</div>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl divide-y divide-white/5">
          {filtered.map((e) => {
            const meta = ACTION_META[e.action] || { icon: "Activity", color: "text-slate-400", label: e.action };
            return (
              <div key={`${e.source}-${e.id}`} className="flex items-start gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${meta.color}`}>
                  <Icon name={meta.icon} size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{meta.label}</span>
                    <span className="text-xs text-slate-600">·</span>
                    <span className="text-xs text-slate-400 truncate">{e.who}</span>
                  </div>
                  {e.details && <div className="text-xs text-slate-500 mt-0.5 truncate">{e.details}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-500 whitespace-nowrap">{formatTs(e.ts)}</div>
                  {e.ip && <div className="text-[10px] text-slate-600 mt-0.5">{e.ip}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
