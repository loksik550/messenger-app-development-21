import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs } from "@/lib/devApi";

interface Payout {
  id: number; user_id: number; name: string; phone: string; amount: number; method: string;
  details: string; holder: string; status: string; note: string; created_at: number;
  decided_at: number | null; earned_total: number;
}
interface Resp {
  items: Payout[]; pending_count: number; pending_sum: number; paid_total: number; fee_total: number; subs_total: number;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Ждёт выплаты", cls: "bg-amber-500/15 text-amber-300" },
  paid: { label: "Выплачено", cls: "bg-emerald-500/15 text-emerald-300" },
  rejected: { label: "Отклонено", cls: "bg-red-500/15 text-red-300" },
  cancelled: { label: "Отменено автором", cls: "bg-white/5 text-slate-400" },
};

const rub = (v: number) => `${v.toLocaleString("ru", { maximumFractionDigits: 2 })} ₽`;

export default function DevPayouts({ editable }: { editable: boolean }) {
  const [data, setData] = useState<Resp | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const load = () => devApi<Resp>("payouts_list", { status: filter }).then(setData).catch(() => {});
  useEffect(() => { load(); }, [filter]);

  const decide = async (p: Payout, approve: boolean) => {
    let note = "";
    if (approve) {
      if (!confirm(`Вы уже перевели ${rub(p.amount)} получателю ${p.holder}? Нажмите «ОК» только после перевода.`)) return;
    } else {
      const n = prompt("Причина отказа (её увидит автор):", "Неверные реквизиты");
      if (n === null) return;
      note = n;
    }
    setBusy(p.id);
    try {
      await devApi("payout_decide", { id: p.id, approve, note });
      setMsg(approve ? "Отмечено как выплаченное, автор получил уведомление" : "Отклонено, деньги вернулись автору");
      setTimeout(() => setMsg(""), 3000);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  };

  const copy = (t: string) => { navigator.clipboard?.writeText(t).catch(() => {}); setMsg("Скопировано"); setTimeout(() => setMsg(""), 1500); };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="Banknote" size={16} className="text-emerald-400" />
        <h3 className="font-semibold text-sm">Выплаты авторам каналов</h3>
        {!!data?.pending_count && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">{data.pending_count} ждут</span>}
        <div className="ml-auto flex gap-1">
          {(["pending", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs ${filter === f ? "bg-white/10 text-white" : "text-slate-400"}`}>
              {f === "pending" ? "Ожидают" : "Все"}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          {[
            ["К выплате", rub(data.pending_sum)],
            ["Уже выплачено", rub(data.paid_total)],
            ["Оплачено подписок", rub(data.subs_total)],
            ["Комиссия Nova", rub(data.fee_total)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white/[0.03] border border-white/8 p-2.5">
              <div className="text-[11px] text-slate-500">{l}</div>
              <div className="text-sm font-bold">{v}</div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500 mb-3">
        Переведите деньги вручную через свой банк, затем нажмите «Выплачено». Если реквизиты неверные — отклоните, сумма вернётся автору в кошелёк.
      </p>
      {msg && <div className="text-xs text-emerald-300 mb-2">{msg}</div>}
      {data && data.items.length === 0 && (
        <div className="text-xs text-slate-400 py-3 text-center bg-white/[0.02] rounded-xl">Заявок нет</div>
      )}

      <div className="space-y-2">
        {data?.items.map((p) => (
          <div key={p.id} className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold">{rub(p.amount)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS[p.status]?.cls || ""}`}>{STATUS[p.status]?.label || p.status}</span>
                  <span className="text-[11px] text-slate-500">#{p.id} · {formatTs(p.created_at)}</span>
                </div>
                <div className="text-xs text-slate-300 mt-1">{p.name} · ID {p.user_id} · +{p.phone}</div>
                <div className="text-xs mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500">{p.method === "card" ? "Карта:" : "СБП:"}</span>
                  <span className="font-mono">{p.details}</span>
                  <button onClick={() => copy(p.details.split(" · ")[0])} className="text-slate-500 hover:text-white"><Icon name="Copy" size={12} /></button>
                  <span className="text-slate-500">· {p.holder}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Всего заработал на каналах: {rub(p.earned_total)}</div>
                {p.note && <div className="text-[11px] text-red-300 mt-1">Причина: {p.note}</div>}
              </div>
              {p.status === "pending" && editable && (
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => decide(p, true)} disabled={busy === p.id}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50">
                    Выплачено
                  </button>
                  <button onClick={() => decide(p, false)} disabled={busy === p.id}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/15 text-red-300 text-xs disabled:opacity-50">
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
