import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface Report {
  id: number;
  reporter_id: number;
  reporter_name: string;
  target_id: number;
  target_name: string;
  reason: string;
  comment: string;
  status: string;
  created_at: number;
}

export default function DevReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(0);

  const load = async () => {
    try {
      const res = await devApi<{ reports: Report[] }>("reports");
      setReports(res.reports);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resolve = async (id: number) => {
    setBusy(id);
    try {
      await devApi("report_resolve", { report_id: id });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось");
    } finally {
      setBusy(0);
    }
  };

  const ban = async (userId: number) => {
    if (!confirm("Заблокировать пользователя на 7 дней?")) return;
    setBusy(userId);
    try {
      await devApi("ban_user", { user_id: userId, days: 7, reason: "По жалобе пользователей" });
      alert("Пользователь заблокирован");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось");
    } finally {
      setBusy(0);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
          <Icon name="ShieldCheck" size={24} className="text-emerald-400" />
        </div>
        <p className="font-medium">Жалоб нет</p>
        <p className="text-sm text-slate-500 mt-1">Пользователи ни на кого не жаловались</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div key={r.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-sm font-semibold">{r.target_name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    r.status === "resolved"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {r.status === "resolved" ? "рассмотрено" : "новая"}
                </span>
              </div>
              <div className="text-sm text-slate-400">Причина: {r.reason || "не указана"}</div>
              {r.comment && <div className="text-sm text-slate-500 mt-1">«{r.comment}»</div>}
              <div className="text-xs text-slate-600 mt-2">
                От {r.reporter_name} · {formatTs(r.created_at)}
              </div>
            </div>

            {r.status !== "resolved" && (
              <div className="flex gap-2">
                <button
                  onClick={() => ban(r.target_id)}
                  disabled={busy === r.target_id}
                  className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-medium hover:bg-red-500/25 transition disabled:opacity-50 whitespace-nowrap"
                >
                  Заблокировать
                </button>
                <button
                  onClick={() => resolve(r.id)}
                  disabled={busy === r.id}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition disabled:opacity-50 whitespace-nowrap"
                >
                  Отклонить
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
