import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";
import { Empty } from "./DevAutoRules";

interface Report {
  reason: string;
  comment: string;
  status: string;
  ts: number;
  from: string;
}

interface Ban {
  until: number | null;
  reason: string;
  by: string;
  kind: string;
  ts: number;
}

interface Order {
  id: number;
  amount: number;
  status: string;
  ts: number;
}

interface Full {
  stats: {
    messages: number;
    paid_total: number;
    orders_count: number;
    mod_hits: number;
    reports_count: number;
    risk: number;
  };
  reports: Report[];
  bans: Ban[];
  orders: Order[];
}

const REASONS: Record<string, string> = {
  spam: "Спам", abuse: "Оскорбления", fraud: "Мошенничество",
  porn: "Непристойное", other: "Другое",
};

/** Вкладка «История»: жалобы, блокировки, платежи и оценка риска */
export default function DevUserHistory({ userId }: { userId: number }) {
  const [data, setData] = useState<Full | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    devApi<Full>("user_full", { user_id: userId })
      .then((r) => {
        setData(r);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [userId]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;
  if (!data) return null;

  const { stats } = data;
  const riskLevel =
    stats.risk >= 60 ? { label: "Высокий", cls: "text-red-400", bg: "bg-red-500/12 border-red-500/25" }
      : stats.risk >= 25 ? { label: "Средний", cls: "text-amber-400", bg: "bg-amber-500/12 border-amber-500/25" }
        : { label: "Низкий", cls: "text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/25" };

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${riskLevel.bg}`}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Icon name="Gauge" size={15} className={riskLevel.cls} />
            <span className="text-sm font-medium">Оценка риска</span>
          </div>
          <span className={`text-sm font-bold ${riskLevel.cls}`}>
            {riskLevel.label} · {stats.risk}
          </span>
        </div>
        <div className="h-2 bg-black/30 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              stats.risk >= 60 ? "bg-red-500" : stats.risk >= 25 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.max(stats.risk, 2)}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
          Считается по жалобам, нарушениям правил и блокировкам
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Mini icon="MessageSquare" label="Сообщений" value={String(stats.messages)} />
        <Mini icon="Wallet" label="Заплатил" value={`${stats.paid_total.toFixed(0)} ₽`} />
        <Mini icon="Flag" label="Жалоб" value={String(stats.reports_count)}
              warn={stats.reports_count > 0} />
        <Mini icon="ShieldAlert" label="Нарушений слов" value={String(stats.mod_hits)}
              warn={stats.mod_hits > 0} />
      </div>

      <Section title="Жалобы на этого человека" icon="Flag" count={data.reports.length}>
        {data.reports.length === 0 ? (
          <Empty icon="ShieldCheck" title="Жалоб нет" text="На этого человека никто не жаловался" />
        ) : (
          data.reports.map((r, i) => (
            <div key={i} className="px-3.5 py-2.5 border-b border-white/5 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">{REASONS[r.reason] || r.reason}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                    r.status === "open"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-emerald-500/15 text-emerald-400"
                  }`}
                >
                  {r.status === "open" ? "не решено" : "решено"}
                </span>
              </div>
              {r.comment && (
                <div className="text-xs text-slate-500 mt-1 leading-relaxed">{r.comment}</div>
              )}
              <div className="text-[11px] text-slate-600 mt-1">
                от {r.from} · {formatTs(r.ts)}
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="История блокировок" icon="Ban" count={data.bans.length}>
        {data.bans.length === 0 ? (
          <Empty icon="CircleCheck" title="Не блокировался" text="Нарушений с блокировкой не было" />
        ) : (
          data.bans.map((b, i) => (
            <div key={i} className="px-3.5 py-2.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2">
                <Icon
                  name={b.kind === "ban" ? "Ban" : "CircleCheck"}
                  size={13}
                  className={b.kind === "ban" ? "text-red-400" : "text-emerald-400"}
                />
                <span className="text-sm">
                  {b.kind === "ban" ? "Заблокирован" : "Разблокирован"}
                  {b.until && b.kind === "ban" ? ` до ${formatTs(b.until)}` : ""}
                </span>
              </div>
              {b.reason && (
                <div className="text-xs text-slate-500 mt-1">{b.reason}</div>
              )}
              <div className="text-[11px] text-slate-600 mt-1">
                {b.by || "неизвестно"} · {formatTs(b.ts)}
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="Платежи" icon="Receipt" count={data.orders.length}>
        {data.orders.length === 0 ? (
          <Empty icon="Wallet" title="Платежей нет" text="Этот человек ещё ничего не покупал" />
        ) : (
          data.orders.map((o) => (
            <div
              key={o.id}
              className="px-3.5 py-2.5 border-b border-white/5 last:border-0 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-sm">{o.amount.toFixed(0)} ₽</div>
                <div className="text-[11px] text-slate-600">
                  Заказ №{o.id} · {formatTs(o.ts)}
                </div>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                  o.status === "paid" || o.status === "succeeded"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : o.status === "refunded"
                      ? "bg-sky-500/15 text-sky-400"
                      : "bg-slate-500/15 text-slate-400"
                }`}
              >
                {o.status === "paid" || o.status === "succeeded"
                  ? "оплачен"
                  : o.status === "refunded" ? "возврат" : o.status}
              </span>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}

function Mini({
  icon, label, value, warn,
}: {
  icon: string;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-xl px-3 py-2.5 border ${
      warn ? "bg-amber-500/[0.07] border-amber-500/20" : "bg-white/[0.03] border-white/8"
    }`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon name={icon} size={12} className="text-slate-500" />
        <span className="text-[11px] text-slate-500 truncate">{label}</span>
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function Section({
  title, icon, count, children,
}: {
  title: string;
  icon: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(count > 0);
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3.5 py-3 hover:bg-white/[0.02] transition"
      >
        <Icon name={icon} size={14} className="text-slate-500 shrink-0" />
        <span className="text-sm font-medium flex-1 text-left">{title}</span>
        {count > 0 && (
          <span className="text-[11px] text-slate-500 bg-white/[0.06] rounded-full px-2 py-0.5 shrink-0">
            {count}
          </span>
        )}
        <Icon
          name={open ? "ChevronUp" : "ChevronDown"}
          size={14}
          className="text-slate-600 shrink-0"
        />
      </button>
      {open && <div className="border-t border-white/5">{children}</div>}
    </div>
  );
}
