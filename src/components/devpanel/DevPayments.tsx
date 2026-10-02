import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";
import { ExportDialog, RefundDialog, type Payment } from "./DevPaymentsDialogs";
import ManualBlock from "./DevPaymentsManual";



interface Summary {
  success_count: number;
  success_sum: number;
  sum_30d: number;
  count_30d: number;
  pending: number;
  failed: number;
  refund_count: number;
  refund_sum: number;
  conversion: number;
  by_method: { method: string; count: number; sum: number }[];
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  paid: { label: "Оплачен", cls: "bg-emerald-500/15 text-emerald-400" },
  succeeded: { label: "Оплачен", cls: "bg-emerald-500/15 text-emerald-400" },
  pending: { label: "Ожидает", cls: "bg-amber-500/15 text-amber-400" },
  canceled: { label: "Отменён", cls: "bg-red-500/15 text-red-400" },
  failed: { label: "Не прошёл", cls: "bg-red-500/15 text-red-400" },
  refunded: { label: "Возвращён", cls: "bg-sky-500/15 text-sky-400" },
};

const METHOD_LABEL: Record<string, string> = {
  bank_card: "Карта",
  sbp: "СБП",
  sberbank: "SberPay",
  tinkoff_bank: "T-Pay",
  yoo_money: "ЮMoney",
  card: "Карта",
  "": "—",
  "не указан": "—",
};

const PURPOSE_LABEL: Record<string, string> = {
  wallet_topup: "Кошелёк",
  pro_month: "Premium · месяц",
  pro_year: "Premium · год",
  lightning: "Молнии",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d.toLocaleString("ru", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

interface RevenueChart {
  chart: { date: string; sum: number; count: number }[];
  total: number;
  avg_per_day: number;
  best_day: { date: string; sum: number; count: number } | null;
}

type Tab = "all" | "succeeded" | "pending" | "canceled" | "refunded" | "manual";

export default function DevPayments({ can }: { can: (p: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refund, setRefund] = useState<Payment | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [chart, setChart] = useState<RevenueChart | null>(null);

  const editable = can("settings");

  const load = async () => {
    setLoading(true);
    try {
      const res = await devApi<{ payments: Payment[] }>("payments", {
        status: tab === "manual" ? "all" : tab,
        query,
      });
      setItems(res.payments);
      try {
        const c = await devApi<RevenueChart>("revenue_chart", { days: 30 });
        setChart(c);
      } catch {
        /* график недоступен по правам */
      }
      try {
        const s = await devApi<{ summary: Summary }>("payments_summary");
        setSummary(s.summary);
      } catch {
        /* сводка недоступна по правам */
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== "manual") load();
    else setLoading(false);
  }, [tab]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card label="Всего получено" value={`${formatNum(summary.success_sum)} ₽`} sub={`${formatNum(summary.success_count)} платежей`} icon="Banknote" accent />
          <Card label="За 30 дней" value={`${formatNum(summary.sum_30d)} ₽`} sub={`${formatNum(summary.count_30d)} платежей`} icon="TrendingUp" />
          <Card label="Возвраты" value={`${formatNum(summary.refund_sum)} ₽`} sub={`${formatNum(summary.refund_count)} шт`} icon="Undo2" />
          <Card label="Доходят до оплаты" value={`${summary.conversion}%`} sub={`${formatNum(summary.failed)} не прошли`} icon="Percent" />
        </div>
      )}

      {chart && chart.chart.length > 0 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-semibold">Доход по дням</h3>
              <p className="text-xs text-slate-500 mt-0.5">За последние 30 дней</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-white/5 text-slate-400">
                В среднем {formatNum(chart.avg_per_day)} ₽/день
              </span>
              {chart.best_day && chart.best_day.sum > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400">
                  Лучший день: {chart.best_day.date} — {formatNum(chart.best_day.sum)} ₽
                </span>
              )}
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart.chart}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#12131f",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "#e2e8f0",
                  }}
                  formatter={(v: number, _n, item) => [
                    `${formatNum(v)} ₽ · ${(item?.payload as { count?: number })?.count ?? 0} шт`,
                    "Доход",
                  ]}
                />
                <Area type="monotone" dataKey="sum" stroke="#34d399" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {summary && summary.by_method.length > 0 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-slate-500 mb-2.5">Чем платят</div>
          <div className="flex flex-wrap gap-2">
            {summary.by_method.map((m) => (
              <div key={m.method} className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2">
                <div className="text-sm font-semibold">{METHOD_LABEL[m.method] || m.method}</div>
                <div className="text-[11px] text-slate-500">
                  {formatNum(m.count)} шт · {formatNum(m.sum)} ₽
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {([
          ["all", "Все"],
          ["succeeded", "Успешные"],
          ["pending", "Ожидают"],
          ["canceled", "Отменённые"],
          ["refunded", "Возвраты"],
          ["manual", "Ручное управление"],
        ] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition ${
              tab === k
                ? "bg-violet-600/20 border border-violet-500/40 text-violet-200"
                : "bg-white/[0.03] border border-white/8 text-slate-400 hover:bg-white/[0.06]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "manual" ? (
        <ManualBlock editable={editable} />
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Номер заказа, почта или имя"
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 placeholder-slate-600"
            />
            <button onClick={load} className="px-4 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 transition">
              <Icon name="Search" size={16} className="text-slate-400" />
            </button>
            <button
              onClick={() => setExportOpen(true)}
              className="px-4 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 transition flex items-center gap-2 text-xs"
            >
              <Icon name="Download" size={15} className="text-slate-400" />
              <span className="hidden sm:inline">Выгрузить</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                <Icon name="Receipt" size={24} className="text-slate-600" />
              </div>
              <p className="text-sm font-medium mb-1">Платежей пока нет</p>
              <p className="text-xs text-slate-500">Здесь появятся все операции</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((p) => {
                const meta = STATUS_META[p.status] || STATUS_META.pending;
                const paid = p.status === "paid" || p.status === "succeeded";
                return (
                  <div key={p.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.cls}`}>
                        <Icon name={paid ? "Check" : p.status === "pending" ? "Clock" : "X"} size={17} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{formatNum(p.amount)} ₽</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${meta.cls}`}>
                            {meta.label}
                          </span>
                          {p.refunded > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400">
                              возврат {formatNum(p.refunded)} ₽
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 truncate">
                          {p.user_name} · {PURPOSE_LABEL[p.purpose] || p.purpose || "—"}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 font-mono truncate">
                          {p.order_number}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1.5 flex-wrap">
                          <span>{fmtDate(p.paid_at || p.created_at)}</span>
                          {p.method && <span>{METHOD_LABEL[p.method] || p.method}</span>}
                          {p.email && <span className="truncate">{p.email}</span>}
                        </div>
                        {p.refund_reason && (
                          <div className="text-[11px] text-sky-400/80 mt-1">Возврат: {p.refund_reason}</div>
                        )}
                        {p.cancel_reason && (
                          <div className="text-[11px] text-red-400/80 mt-1">Причина: {p.cancel_reason}</div>
                        )}
                      </div>

                      {editable && paid && p.refunded < p.amount && (
                        <button
                          onClick={() => setRefund(p)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition shrink-0"
                        >
                          Вернуть
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}

      {refund && <RefundDialog payment={refund} onClose={() => setRefund(null)} onDone={() => { setRefund(null); load(); }} />}
    </div>
  );
}


function Card({
  label, value, sub, icon, accent,
}: {
  label: string; value: string; sub: string; icon: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 border ${
      accent ? "bg-emerald-500/10 border-emerald-500/25" : "bg-white/[0.03] border-white/10"
    }`}>
      <Icon name={icon} size={16} className={accent ? "text-emerald-400 mb-2" : "text-slate-500 mb-2"} />
      <div className={`text-xl font-bold ${accent ? "text-emerald-300" : ""}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>
    </div>
  );
}
