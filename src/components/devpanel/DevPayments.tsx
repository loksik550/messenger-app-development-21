import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";
import { Field, Inp } from "./DevPlans";

interface Payment {
  id: number;
  order_number: string;
  email: string;
  amount: number;
  status: string;
  payment_id: string;
  created_at: string | null;
  paid_at: string | null;
  user_id: number | null;
  user_name: string;
  purpose: string;
  method: string;
  refunded: number;
  refunded_at: string | null;
  refund_reason: string;
  cancel_reason: string;
}

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

type Tab = "all" | "succeeded" | "pending" | "canceled" | "refunded" | "manual";

export default function DevPayments({ can }: { can: (p: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refund, setRefund] = useState<Payment | null>(null);

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

      {refund && <RefundDialog payment={refund} onClose={() => setRefund(null)} onDone={() => { setRefund(null); load(); }} />}
    </div>
  );
}

function RefundDialog({
  payment, onClose, onDone,
}: {
  payment: Payment;
  onClose: () => void;
  onDone: () => void;
}) {
  const max = payment.amount - payment.refunded;
  const [amount, setAmount] = useState(String(max));
  const [reason, setReason] = useState("Возврат по обращению пользователя");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doRefund = async () => {
    setBusy(true);
    setErr("");
    try {
      await devApi("payment_refund", {
        order_id: payment.id,
        amount: Number(amount) || max,
        reason,
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось оформить возврат");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#12131f] border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-1">Возврат платежа</h3>
        <p className="text-xs text-slate-500 mb-4">
          {payment.user_name} · {formatNum(payment.amount)} ₽ · {payment.order_number}
        </p>

        <div className="space-y-3">
          <Field label={`Сумма возврата (не больше ${formatNum(max)} ₽)`}>
            <Inp value={amount} onChange={(v) => setAmount(v.replace(/[^\d.]/g, ""))} />
          </Field>
          <Field label="Причина — увидит пользователь">
            <Inp value={reason} onChange={setReason} />
          </Field>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mt-3">
          <Icon name="TriangleAlert" size={14} className="mt-0.5 shrink-0" />
          <span>Деньги вернутся на карту покупателя за 3–5 рабочих дней. Отменить возврат нельзя.</span>
        </div>

        {err && (
          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 mt-3">
            <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">
            Отмена
          </button>
          <button
            onClick={doRefund}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-300 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Оформляем..." : "Вернуть деньги"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManualBlock({ editable }: { editable: boolean }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: number; name: string; phone: string }[]>([]);
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("Компенсация от команды Nova");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setFound([]);
      return;
    }
    const r = await devApi<{ users: { id: number; name: string; phone: string }[] }>("users", { query: q, limit: 6 });
    setFound(r.users);
  };

  const run = async (action: string, payload: Record<string, unknown>, msg: string) => {
    if (!picked) return;
    setBusy(true);
    setErr("");
    try {
      await devApi(action, { user_id: picked.id, ...payload });
      setDone(msg);
      setTimeout(() => setDone(""), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось выполнить");
    } finally {
      setBusy(false);
    }
  };

  if (!editable) {
    return (
      <div className="py-16 text-center">
        <Icon name="Lock" size={24} className="text-slate-600 mx-auto mb-2" />
        <p className="text-sm">Недостаточно прав</p>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      <p className="text-xs text-slate-500">
        Продлите подписку вручную — например, при сбое или как компенсацию
      </p>

      <Field label="Найдите пользователя">
        <Inp value={query} onChange={search} placeholder="Имя или телефон" />
      </Field>

      {found.length > 0 && !picked && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          {found.map((u) => (
            <button
              key={u.id}
              onClick={() => { setPicked({ id: u.id, name: u.name }); setFound([]); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.05] transition text-left border-b border-white/5 last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-xs font-bold">
                {(u.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm truncate">{u.name || "Без имени"}</div>
                <div className="text-[11px] text-slate-500">{u.phone}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {picked && (
        <div className="bg-violet-600/10 border border-violet-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Icon name="UserCheck" size={16} className="text-violet-400" />
          <span className="text-sm flex-1">{picked.name}</span>
          <button onClick={() => setPicked(null)} className="text-slate-500 hover:text-slate-300">
            <Icon name="X" size={15} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Дней">
          <Inp value={days} onChange={(v) => setDays(v.replace(/\D/g, ""))} />
        </Field>
        <Field label="Быстрый выбор">
          <div className="flex gap-1.5">
            {["7", "30", "90"].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`flex-1 py-2.5 rounded-xl text-xs border transition ${
                  days === d
                    ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                    : "bg-white/[0.03] border-white/8 text-slate-400"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Что увидит пользователь">
        <Inp value={reason} onChange={setReason} />
      </Field>

      {err && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
          <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}
      {done && (
        <div className="flex items-start gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
          <Icon name="CircleCheck" size={16} className="mt-0.5 shrink-0" />
          <span>{done}</span>
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={() => run("subscription_extend", { days: Number(days) || 0, reason }, `Подписка продлена на ${days} дн.`)}
          disabled={busy || !picked || !days}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-bold disabled:opacity-40"
        >
          {busy ? "Выполняем..." : "Продлить подписку"}
        </button>
        <button
          onClick={() => {
            if (!confirm("Отключить Premium у этого пользователя?")) return;
            run("subscription_cancel", { reason }, "Подписка отключена");
          }}
          disabled={busy || !picked}
          className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 hover:bg-white/10 transition disabled:opacity-40"
        >
          Отключить подписку
        </button>
      </div>
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
