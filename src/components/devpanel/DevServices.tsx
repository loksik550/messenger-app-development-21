import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs, formatNum } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface Service {
  name: string;
  status: string;
  latency_ms: number | null;
  detail: string;
}

interface Invite {
  code: string;
  created_at: number;
  used_by: number | null;
  used_at: number | null;
  note: string;
  used_email: string | null;
}

export default function DevServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [load1h, setLoad1h] = useState(0);
  const [checkedAt, setCheckedAt] = useState(0);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  const load = async () => {
    try {
      const [srv, inv] = await Promise.all([
        devApi<{ services: Service[]; load_last_hour: number; checked_at: number }>("services"),
        devApi<{ invites: Invite[] }>("invites"),
      ]);
      setServices(srv.services);
      setLoad1h(srv.load_last_hour);
      setCheckedAt(srv.checked_at);
      setInvites(inv.invites);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const createInvite = async () => {
    setBusy(true);
    try {
      await devApi<{ code: string }>("create_invite", { note: "Выдан из панели" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось создать");
    } finally {
      setBusy(false);
    }
  };

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(""), 1500);
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  const allUp = services.every((s) => s.status === "up");

  return (
    <div className="space-y-5">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${allUp ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`} />
            <h3 className="font-semibold">{allUp ? "Все системы в норме" : "Есть ненастроенные сервисы"}</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Проверено {formatTs(checkedAt)}</span>
            <button onClick={load} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition">
              <Icon name="RefreshCw" size={14} className="text-slate-400" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {services.map((s) => (
            <div key={s.name} className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{s.name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    s.status === "up" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"
                  }`}
                >
                  {s.status === "up" ? "работает" : "выключено"}
                </span>
              </div>
              <div className="text-xs text-slate-500">{s.detail}</div>
              {s.latency_ms !== null && (
                <div className="text-xs text-slate-400 mt-1.5">Отклик: {s.latency_ms} мс</div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-white/8 flex items-center gap-2 text-sm">
          <Icon name="Activity" size={15} className="text-violet-400" />
          <span className="text-slate-400">Нагрузка за час:</span>
          <span className="font-semibold">{formatNum(load1h)} сообщений</span>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Коды-приглашения</h3>
            <p className="text-xs text-slate-500 mt-0.5">Для доступа новых администраторов</p>
          </div>
          <button
            onClick={createInvite}
            disabled={busy}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            <Icon name="Plus" size={15} />
            Создать код
          </button>
        </div>

        {invites.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">Кодов пока нет</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.code}
                className="flex items-center gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-3.5 py-3"
              >
                <Icon
                  name={inv.used_by ? "CircleCheck" : "KeyRound"}
                  size={16}
                  className={inv.used_by ? "text-slate-500" : "text-violet-400"}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm truncate">{inv.code}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {inv.used_by ? `Использован: ${inv.used_email || "—"}` : "Не использован"}
                  </div>
                </div>
                {!inv.used_by && (
                  <button
                    onClick={() => copy(inv.code)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition whitespace-nowrap"
                  >
                    {copied === inv.code ? "Скопировано" : "Копировать"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
