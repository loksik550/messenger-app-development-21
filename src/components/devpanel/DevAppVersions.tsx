import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";

interface Stats {
  latest: string;
  items: { version: string; count: number; outdated: boolean }[];
  outdated: number;
  web: number;
  unknown: number;
}

export default function DevAppVersions({ canSend }: { canSend: boolean }) {
  const [data, setData] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    devApi<Stats>("app_versions_stats").then(setData).catch(() => setData(null));

  useEffect(() => { load(); }, []);

  const nudge = async () => {
    if (!data) return;
    if (!confirm(`Отправить ${formatNum(data.outdated)} пользователям личное сообщение от Nova о новой версии ${data.latest}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await devApi<{ sent: number }>("app_update_nudge", { latest: data.latest });
      setMsg({ ok: true, text: r.sent ? `Отправлено: ${formatNum(r.sent)}` : "Все уже получили напоминание об этой версии" });
      load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Не удалось отправить" });
    } finally {
      setBusy(false);
    }
  };

  if (!data) return null;
  const total = data.items.reduce((a, b) => a + b.count, 0);

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-semibold">Версии приложения</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Android: {formatNum(total)} · сайт: {formatNum(data.web)}
            {data.latest && <> · последняя <span className="text-emerald-400">{data.latest}</span></>}
          </p>
        </div>
        {canSend && data.outdated > 0 && (
          <button
            onClick={nudge}
            disabled={busy}
            className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            <Icon name={busy ? "Loader2" : "Send"} size={13} className={busy ? "animate-spin" : ""} />
            Напомнить {formatNum(data.outdated)}
          </button>
        )}
      </div>

      {total === 0 ? (
        <div className="text-sm text-slate-500 py-4 text-center">
          Данные появятся, когда пользователи откроют обновлённое приложение
        </div>
      ) : (
        <div className="space-y-2.5">
          {data.items.map((v) => {
            const pct = Math.round((v.count / total) * 100);
            return (
              <div key={v.version || "none"}>
                <div className="flex items-center justify-between gap-2 text-xs mb-1">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium truncate">{v.version || "неизвестно"}</span>
                    {v.outdated ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 shrink-0">устарела</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 shrink-0">актуальная</span>
                    )}
                  </span>
                  <span className="text-slate-400 tabular-nums shrink-0 whitespace-nowrap">{formatNum(v.count)} · {pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${v.outdated ? "bg-amber-400/70" : "bg-emerald-400/80"}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.unknown > 0 && (
        <p className="text-[11px] text-slate-600 mt-3">
          Ещё {formatNum(data.unknown)} чел. не заходили после обновления — их версия пока неизвестна
        </p>
      )}
      {msg && (
        <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${msg.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
