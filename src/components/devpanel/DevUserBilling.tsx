import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum, formatTs } from "@/lib/devApi";

interface Payment {
  id: number;
  order_number: string;
  amount: number;
  status: string;
  created_at: string | null;
  paid_at: string | null;
  purpose: string;
  method: string;
  refunded: number;
}

interface Sub {
  plan: string;
  amount: number;
  source: string;
  starts_at: number;
  ends_at: number;
  is_trial: boolean;
  created_at: number;
}

interface Billing {
  pro_until: number | null;
  is_pro: boolean;
  trial_used: boolean;
  wallet: number;
  paid_total: number;
  refunded_total: number;
  invited: number;
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
  bank_card: "Карта", card: "Карта", sbp: "СБП",
  sberbank: "SberPay", tinkoff_bank: "T-Pay", yoo_money: "ЮMoney",
};

const PURPOSE_LABEL: Record<string, string> = {
  wallet_topup: "Кошелёк",
  pro_month: "Premium · месяц",
  pro_year: "Premium · год",
  lightning: "Молнии",
};

const SOURCE_LABEL: Record<string, string> = {
  yookassa: "Оплата", wallet: "С кошелька", trial: "Пробный",
  gift: "Подарок", promo: "Промокод", referral: "Приглашение",
  manual: "Вручную", demo: "Демо-режим",
};

function fmtIso(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d.toLocaleString("ru", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function DevUserBilling({
  userId, canEdit, onChanged,
}: {
  userId: number;
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [promos, setPromos] = useState<{ code: string; days: number; created_at: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [extend, setExtend] = useState(false);
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("Компенсация от команды Nova");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletReason, setWalletReason] = useState("Корректировка баланса");

  const load = async () => {
    setLoading(true);
    try {
      const r = await devApi<{
        billing: Billing; payments: Payment[]; subscriptions: Sub[];
        promos: { code: string; days: number; created_at: number }[];
      }>("user_billing", { user_id: userId });
      setBilling(r.billing);
      setPayments(r.payments);
      setSubs(r.subscriptions);
      setPromos(r.promos);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [userId]);

  const doExtend = async (value: number) => {
    setBusy(true);
    setMsg("");
    try {
      await devApi("subscription_extend", { user_id: userId, days: value, reason });
      setExtend(false);
      setMsg(`Подписка продлена на ${value} дн.`);
      setTimeout(() => setMsg(""), 3500);
      await load();
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Не удалось продлить");
    } finally {
      setBusy(false);
    }
  };

  const changeWallet = async (mode: "set" | "add" | "subtract" | "reset") => {
    setBusy(true);
    setMsg("");
    try {
      const r = await devApi<{ balance: number }>("wallet_set", {
        user_id: userId,
        mode,
        amount: Number(walletAmount) || 0,
        reason: walletReason,
      });
      setWalletOpen(false);
      setWalletAmount("");
      setMsg(`Баланс изменён: ${formatNum(r.balance)} ₽`);
      setTimeout(() => setMsg(""), 3500);
      await load();
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Не удалось изменить баланс");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icon name="Loader2" size={22} className="animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl p-4 border ${
        billing?.is_pro
          ? "bg-amber-500/[0.08] border-amber-500/25"
          : "bg-white/[0.03] border-white/10"
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            billing?.is_pro ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-slate-500"
          }`}>
            <Icon name="Crown" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">
              {billing?.is_pro ? "Premium активен" : "Без подписки"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {billing?.is_pro && billing.pro_until
                ? `Действует до ${formatTs(billing.pro_until)}`
                : billing?.trial_used
                  ? "Пробный период уже использован"
                  : "Пробный период доступен"}
            </div>
          </div>
          {canEdit && (
            <button
              onClick={() => setExtend(!extend)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition shrink-0"
            >
              {extend ? "Скрыть" : "Продлить"}
            </button>
          )}
        </div>

        {extend && canEdit && (
          <div className="mt-4 pt-4 border-t border-white/8 space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Причина — увидит пользователь</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500/50"
              />
            </div>
            <div className="flex gap-2">
              <input
                value={days}
                onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
                className="w-20 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-center outline-none focus:border-violet-500/50"
              />
              {["7", "30", "90"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-2 rounded-xl text-xs border transition ${
                    days === d
                      ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                      : "bg-white/[0.03] border-white/8 text-slate-400"
                  }`}
                >
                  {d} дн
                </button>
              ))}
              <button
                onClick={() => doExtend(Number(days) || 0)}
                disabled={busy || !days}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-xs font-semibold disabled:opacity-50"
              >
                {busy ? "..." : "Продлить"}
              </button>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div className="flex items-start gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
          <Icon name="CircleCheck" size={16} className="mt-0.5 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Mini label="Оплачено всего" value={`${formatNum(billing?.paid_total || 0)} ₽`} />
        <Mini label="На кошельке" value={`${formatNum(billing?.wallet || 0)} ₽`} />
        <Mini label="Возвращено" value={`${formatNum(billing?.refunded_total || 0)} ₽`} />
        <Mini label="Пригласил друзей" value={formatNum(billing?.invited || 0)} />
      </div>

      {canEdit && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Icon name="Wallet" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Кошелёк</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Сейчас {formatNum(billing?.wallet || 0)} ₽
              </div>
            </div>
            <button
              onClick={() => setWalletOpen(!walletOpen)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition shrink-0"
            >
              {walletOpen ? "Скрыть" : "Изменить"}
            </button>
          </div>

          {walletOpen && (
            <div className="mt-4 pt-4 border-t border-white/8 space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Причина — увидит пользователь</label>
                <input
                  value={walletReason}
                  onChange={(e) => setWalletReason(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Сумма, ₽</label>
                <input
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500/50 placeholder-slate-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => changeWallet("add")}
                  disabled={busy || !walletAmount}
                  className="py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-medium disabled:opacity-40"
                >
                  Начислить
                </button>
                <button
                  onClick={() => changeWallet("subtract")}
                  disabled={busy || !walletAmount}
                  className="py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-medium disabled:opacity-40"
                >
                  Списать
                </button>
                <button
                  onClick={() => changeWallet("set")}
                  disabled={busy || !walletAmount}
                  className="py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-medium disabled:opacity-40"
                >
                  Задать
                </button>
              </div>

              <button
                onClick={() => {
                  if (!confirm("Обнулить баланс кошелька?")) return;
                  changeWallet("reset");
                }}
                disabled={busy}
                className="w-full py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs disabled:opacity-40"
              >
                Обнулить баланс
              </button>
            </div>
          )}
        </div>
      )}

      <Section title="Платежи" count={payments.length}>
        {payments.length === 0 ? (
          <Empty text="Платежей не было" />
        ) : (
          <div className="space-y-1.5">
            {payments.map((p) => {
              const meta = STATUS_META[p.status] || STATUS_META.pending;
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.cls}`}>
                    <Icon
                      name={p.status === "paid" || p.status === "succeeded" ? "Check" : p.status === "pending" ? "Clock" : "X"}
                      size={14}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{formatNum(p.amount)} ₽</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                      {p.refunded > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400">
                          возврат {formatNum(p.refunded)} ₽
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {PURPOSE_LABEL[p.purpose] || p.purpose || "—"}
                      {p.method ? ` · ${METHOD_LABEL[p.method] || p.method}` : ""}
                      {` · ${fmtIso(p.paid_at || p.created_at)}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="История подписок" count={subs.length}>
        {subs.length === 0 ? (
          <Empty text="Подписок не было" />
        ) : (
          <div className="space-y-1.5">
            {subs.map((s, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center shrink-0">
                  <Icon name={s.is_trial ? "Gift" : "Crown"} size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium font-mono">{s.plan}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400">
                      {SOURCE_LABEL[s.source] || s.source}
                    </span>
                    {s.amount > 0 && (
                      <span className="text-[11px] text-slate-500">{formatNum(s.amount)} ₽</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {formatTs(s.starts_at)} — {formatTs(s.ends_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {promos.length > 0 && (
        <Section title="Активированные промокоды" count={promos.length}>
          <div className="space-y-1.5">
            {promos.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                  <Icon name="Ticket" size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono font-semibold text-violet-300">{p.code}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {p.days > 0 ? `${p.days} дн. Premium · ` : ""}{formatTs(p.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        {count > 0 && <span className="text-[11px] text-slate-600">{count}</span>}
      </div>
      {children}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5">
      <div className="text-sm font-bold truncate">{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs text-slate-600 py-6 text-center">{text}</div>;
}
