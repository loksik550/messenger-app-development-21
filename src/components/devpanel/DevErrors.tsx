import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface ErrGroup { source: string; action: string; kind: string; count: number; last_at: number; message: string; users: number }
interface ClientErr { code: string; count: number; users: number; last_at: number }
interface ErrData { groups: ErrGroup[]; client: ClientErr[]; hourly: { hour: number; count: number }[]; total: number }

const SOURCE_LABEL: Record<string, string> = {
  "chat-api": "Сообщения и чаты",
  "chat-poll": "Обновления в реальном времени",
  "push-notify": "Уведомления",
  "upload-image": "Загрузка файлов",
  "dev-panel": "Dev-панель",
};

const KIND_LABEL: Record<string, string> = {
  DbBusy: "База перегружена",
  QueryCanceled: "Запрос к базе прерван",
  KeyError: "Не хватает данных в запросе",
  ValueError: "Неверные данные",
  TypeError: "Ошибка в коде",
  UndefinedColumn: "Нет колонки в базе",
  UndefinedTable: "Нет таблицы в базе",
  InFailedSqlTransaction: "Сбой транзакции",
};

const CLIENT_LABEL: Record<string, string> = {
  chat_crash_loop: "Чат завис в цикле обновлений",
  e2e_retry: "Сообщение не расшифровалось (повторим)",
  e2e_unwrap: "Ключ сообщения не подошёл",
  e2e_keys_bad: "Ключи устройства повреждены — пересозданы",
};

function clientLabel(code: string) {
  const base = code.split(".")[0];
  if (CLIENT_LABEL[base]) return CLIENT_LABEL[base];
  if (base.startsWith("chat_crash")) return "Чат упал и перезапустился";
  return code;
}

export default function DevErrors() {
  const [data, setData] = useState<ErrData | null>(null);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await devApi<ErrData>("errors", { hours }));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const clear = async () => {
    if (!confirm("Очистить журнал ошибок?")) return;
    try { await devApi("errors_clear"); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Не удалось"); }
  };

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox text={error} onRetry={load} />;
  if (!data) return null;

  const max = Math.max(1, ...data.hourly.map((h) => h.count));
  const clientTotal = data.client.reduce((a, c) => a + c.count, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {[1, 24, 168].map((h) => (
          <button
            key={h}
            onClick={() => setHours(h)}
            className={`px-3 py-2 rounded-xl text-xs border transition ${hours === h ? "bg-violet-600/25 border-violet-500/40 text-violet-100" : "bg-white/[0.04] border-white/10 text-slate-400 hover:bg-white/10"}`}
          >
            {h === 1 ? "Час" : h === 24 ? "Сутки" : "Неделя"}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-400 hover:bg-white/10" title="Обновить">
          <Icon name="RefreshCw" size={15} />
        </button>
        <button onClick={clear} className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-400 hover:bg-white/10 text-xs">Очистить</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-2xl border p-4 ${data.total ? "bg-red-500/10 border-red-500/25" : "bg-emerald-500/10 border-emerald-500/20"}`}>
          <div className="text-xs text-slate-400">Сбои сервера</div>
          <div className={`text-2xl font-bold mt-1 ${data.total ? "text-red-300" : "text-emerald-300"}`}>{data.total}</div>
        </div>
        <div className={`rounded-2xl border p-4 ${clientTotal ? "bg-amber-500/10 border-amber-500/25" : "bg-emerald-500/10 border-emerald-500/20"}`}>
          <div className="text-xs text-slate-400">Сбои в приложении</div>
          <div className={`text-2xl font-bold mt-1 ${clientTotal ? "text-amber-300" : "text-emerald-300"}`}>{clientTotal}</div>
        </div>
      </div>

      {data.hourly.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
          <div className="text-xs text-slate-400 mb-3">Сбои сервера по часам</div>
          <div className="flex items-end gap-[3px] h-20">
            {data.hourly.map((h) => (
              <div key={h.hour} title={`${formatTs(h.hour)}: ${h.count}`} className="flex-1 min-w-[3px] rounded-t bg-red-400/70" style={{ height: `${Math.max(6, (h.count / max) * 100)}%` }} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-200">Сервер</h3>
        {data.groups.length === 0 && (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-300 flex items-center gap-2">
            <Icon name="CircleCheck" size={16} /> Сбоев нет
          </div>
        )}
        {data.groups.map((g, i) => (
          <button key={i} onClick={() => setOpen(open === i ? null : i)} className="w-full text-left rounded-2xl bg-white/[0.03] border border-white/10 p-3.5 hover:bg-white/[0.06] transition">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-red-500/15 text-red-300 flex items-center justify-center text-sm font-bold shrink-0">{g.count}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{KIND_LABEL[g.kind] || g.kind}</div>
                <div className="text-xs text-slate-400 truncate">
                  {SOURCE_LABEL[g.source] || g.source}{g.action ? ` · ${g.action}` : ""} · {g.users} чел. · {formatTs(g.last_at)}
                </div>
              </div>
              <Icon name={open === i ? "ChevronUp" : "ChevronDown"} size={16} className="text-slate-500" />
            </div>
            {open === i && g.message && (
              <pre className="mt-3 text-[11px] text-slate-400 whitespace-pre-wrap break-words bg-black/30 rounded-xl p-3">{g.message}</pre>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-200">Приложение</h3>
        {data.client.length === 0 && (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-300 flex items-center gap-2">
            <Icon name="CircleCheck" size={16} /> Сбоев нет
          </div>
        )}
        {data.client.map((c) => (
          <div key={c.code} className="rounded-2xl bg-white/[0.03] border border-white/10 p-3.5 flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center text-sm font-bold shrink-0">{c.count}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{clientLabel(c.code)}</div>
              <div className="text-xs text-slate-400 truncate">{c.code} · {c.users} чел. · {formatTs(c.last_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
