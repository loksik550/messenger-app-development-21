import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { useT } from "@/hooks/useT";

interface PR {
  id: number;
  from_user_id: number;
  to_user_id: number;
  from_name?: string;
  to_name?: string;
  amount: number;
  title: string;
  status: string;
  created_at: number;
  paid_at?: number | null;
  is_outgoing: boolean;
}

export default function PaymentRequestsPanel({
  currentUser, onClose,
}: { currentUser: User; onClose: () => void; }) {
  useEdgeSwipeBack(onClose);
  const { t } = useT();
  const [items, setItems] = useState<PR[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");

  const load = () => {
    api("payment_request_list", {}, currentUser.id).then(d => {
      if (Array.isArray(d?.items)) setItems(d.items);
    });
  };

  useEffect(() => { load(); }, [currentUser.id]);

  const create = async () => {
    const uid = parseInt(toUserId, 10);
    const amt = parseFloat(amount);
    if (!uid || !amt) { alert("Укажи получателя и сумму"); return; }
    const r = await api("payment_request_create", { to_user_id: uid, amount: amt, title }, currentUser.id);
    if (r?.error) { alert(r.error); return; }
    setCreating(false); setToUserId(""); setAmount(""); setTitle("");
    load();
  };

  const pay = async (id: number) => {
    setBusy(id);
    const r = await api("payment_request_pay", { id }, currentUser.id);
    setBusy(null);
    if (r?.error) { alert(r.error); return; }
    load();
  };

  const cancel = async (id: number) => {
    if (!confirm("Отменить счёт?")) return;
    await api("payment_request_cancel", { id }, currentUser.id);
    load();
  };

  const fmt = (ts: number) => new Date(ts * 1000).toLocaleString("ru", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const fmtAmt = (a: number) => `${a.toFixed(2)} ₽`;

  return (
    <div className="fixed inset-0 z-[260] bg-background flex flex-col animate-fade-in">
      <div className="flex items-center gap-2 px-3 py-2 glass-strong border-b border-white/5" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8"><Icon name="ChevronLeft" size={20} /></button>
        <Icon name="ReceiptText" size={18} className="text-emerald-400" />
        <h2 className="font-bold flex-1">{t("nav.payments")}</h2>
        <button onClick={() => setCreating(true)} className="p-2 grad-primary rounded-xl text-white"><Icon name="Plus" size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 && (
          <div className="text-center pt-12">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/15 flex items-center justify-center mb-3">
              <Icon name="ReceiptText" size={28} className="text-emerald-400" />
            </div>
            <h3 className="font-bold text-base mb-1">Запрос на оплату</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Выставляй счета друзьям и получай оплату прямо в приложении. Деньги мгновенно зачисляются на твой кошелёк.</p>
          </div>
        )}
        {items.map(pr => {
          const isPending = pr.status === "pending";
          return (
            <div key={pr.id} className="glass rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon name={pr.is_outgoing ? "ArrowDownRight" : "ArrowUpRight"} size={14} className={pr.is_outgoing ? "text-emerald-400" : "text-amber-400"} />
                <span className="text-xs text-muted-foreground">{pr.is_outgoing ? `Вам выставил ${pr.to_name}` : `Вы выставили ${pr.from_name}`}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{fmt(pr.created_at)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-2xl font-bold">{fmtAmt(pr.amount)}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  pr.status === "paid" ? "bg-emerald-500/15 text-emerald-300" :
                  pr.status === "cancelled" ? "bg-zinc-500/15 text-zinc-300" :
                  "bg-amber-500/15 text-amber-300"
                }`}>
                  {pr.status === "paid" ? "Оплачено" : pr.status === "cancelled" ? "Отменено" : "Ожидает"}
                </span>
              </div>
              {pr.title && <p className="text-xs text-muted-foreground">{pr.title}</p>}
              {isPending && (
                <div className="flex gap-2 mt-2">
                  {pr.is_outgoing ? (
                    <button onClick={() => pay(pr.id)} disabled={busy === pr.id} className="flex-1 grad-primary text-white rounded-xl py-2 text-xs font-bold disabled:opacity-50">
                      {busy === pr.id ? "..." : "Оплатить"}
                    </button>
                  ) : (
                    <button onClick={() => cancel(pr.id)} className="flex-1 glass rounded-xl py-2 text-xs font-semibold text-red-300">Отменить</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {creating && (
        <div className="fixed inset-0 z-[270] bg-black/60 backdrop-blur flex items-center justify-center p-4" onClick={() => setCreating(false)}>
          <div className="glass-strong rounded-3xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-3">Выставить счёт</h3>
            <input value={toUserId} onChange={e => setToUserId(e.target.value)} placeholder="ID получателя" className="w-full glass rounded-xl px-4 py-2.5 text-sm mb-2" />
            <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" placeholder="Сумма (₽)" className="w-full glass rounded-xl px-4 py-2.5 text-sm mb-2" />
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="За что (необязательно)" className="w-full glass rounded-xl px-4 py-2.5 text-sm mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="flex-1 glass rounded-xl py-2.5 text-sm">Отмена</button>
              <button onClick={create} className="flex-1 grad-primary text-white rounded-xl py-2.5 text-sm font-bold">Выставить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}