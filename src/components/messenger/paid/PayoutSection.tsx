import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";

interface PayoutItem { id: number; amount: number; method: string; details: string; status: string; note: string; created_at: number }
interface Info { earned: number; withdrawn: number; available: number; balance: number; min: number; items: PayoutItem[] }

const rub = (v: number) => `${v.toLocaleString("ru", { maximumFractionDigits: 2 })} ₽`;
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "В обработке", cls: "text-amber-300 bg-amber-500/15" },
  paid: { label: "Выплачено", cls: "text-emerald-300 bg-emerald-500/15" },
  rejected: { label: "Отклонено", cls: "text-red-300 bg-red-500/15" },
  cancelled: { label: "Отменено", cls: "text-muted-foreground bg-white/5" },
};

export default function PayoutSection({ userId, onBalance }: { userId: number; onBalance: (b: number) => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"card" | "sbp">("card");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [bank, setBank] = useState("");
  const [holder, setHolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => api("payout_info", {}, userId).then((r) => { if (r && !r.error) setInfo(r); }).catch(() => null);
  useEffect(() => { load(); }, [userId]);

  if (!info || (info.earned <= 0 && info.items.length === 0)) return null;
  const pending = info.items.find((i) => i.status === "pending");

  const submit = async () => {
    setBusy(true); setError("");
    const r = await api("payout_request", { method, amount: Number(amount.replace(",", ".")), details, bank, holder }, userId).catch(() => null);
    setBusy(false);
    if (r?.ok) { onBalance(r.balance); setOpen(false); setAmount(""); setDetails(""); load(); }
    else setError(r?.error || "Не удалось отправить заявку");
  };

  const cancel = async (id: number) => {
    if (!confirm("Отменить заявку? Деньги вернутся в кошелёк.")) return;
    const r = await api("payout_cancel", { id }, userId).catch(() => null);
    if (r?.ok) { onBalance(r.balance); load(); }
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><Icon name="Banknote" size={18} /></div>
        <div className="flex-1">
          <div className="font-semibold text-sm">Заработок с каналов</div>
          <div className="text-[11px] text-muted-foreground">Всего заработано {rub(info.earned)}</div>
        </div>
      </div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-[11px] text-muted-foreground">Доступно к выводу</div>
          <div className="text-2xl font-black text-emerald-400">{rub(info.available)}</div>
        </div>
        <button
          onClick={() => { setOpen(true); setError(""); setAmount(String(info.available)); }}
          disabled={!!pending || info.available < info.min}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40"
        >
          Вывести
        </button>
      </div>
      {!pending && info.available < info.min && (
        <p className="text-[11px] text-muted-foreground mb-2">Минимальная сумма вывода — {rub(info.min)}</p>
      )}

      {info.items.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {info.items.slice(0, 5).map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-xs rounded-xl bg-white/5 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{rub(i.amount)} · {i.method === "card" ? `карта ${i.details}` : `СБП ${i.details}`}</div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(i.created_at * 1000).toLocaleDateString("ru", { day: "numeric", month: "short" })}
                  {i.note ? ` · ${i.note}` : ""}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS[i.status]?.cls || ""}`}>{STATUS[i.status]?.label || i.status}</span>
              {i.status === "pending" && (
                <button onClick={() => cancel(i.id)} className="text-[10px] text-red-400/80 hover:text-red-400">Отменить</button>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={() => !busy && setOpen(false)}>
          <div className="glass-strong w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 animate-scale-in" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Вывод денег</h3>
              <button onClick={() => setOpen(false)} disabled={busy} className="p-2 rounded-xl hover:bg-white/8"><Icon name="X" size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {(["card", "sbp"] as const).map((m) => (
                <button key={m} onClick={() => { setMethod(m); setDetails(""); }}
                  className={`py-2.5 rounded-xl text-sm font-semibold ${method === m ? "bg-emerald-600 text-white" : "glass"}`}>
                  {m === "card" ? "На карту" : "По СБП"}
                </button>
              ))}
            </div>

            <label className="text-[11px] text-muted-foreground">Сумма (доступно {rub(info.available)})</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal"
              className="w-full mt-1 mb-3 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-500/60" />

            <label className="text-[11px] text-muted-foreground">{method === "card" ? "Номер карты" : "Телефон для СБП"}</label>
            <input value={details} onChange={(e) => setDetails(e.target.value)} inputMode="numeric"
              placeholder={method === "card" ? "0000 0000 0000 0000" : "+7 900 000-00-00"}
              className="w-full mt-1 mb-3 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-500/60" />

            {method === "sbp" && (
              <>
                <label className="text-[11px] text-muted-foreground">Банк</label>
                <input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Например, Сбербанк"
                  className="w-full mt-1 mb-3 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-500/60" />
              </>
            )}

            <label className="text-[11px] text-muted-foreground">Имя и фамилия получателя</label>
            <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Как в банке"
              className="w-full mt-1 mb-3 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-500/60" />

            <p className="text-[11px] text-muted-foreground mb-3">Сумма сразу спишется с баланса. Заявку проверят вручную, обычно в течение 1–3 рабочих дней. Если её отклонят, деньги вернутся.</p>
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <button onClick={submit} disabled={busy}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-60">
              {busy ? "Отправляем…" : "Отправить заявку"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
