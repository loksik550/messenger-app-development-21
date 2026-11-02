import { useState } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";

export interface PaidInfo { price: number; access: boolean; paid_until?: number | null; auto_renew?: boolean }

const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleDateString("ru", { day: "numeric", month: "long" });

export default function PaidChannelGate({
  groupId, userId, channelName, paid, onPaid, onOpenWallet,
}: {
  groupId: number;
  userId: number;
  channelName: string;
  paid: PaidInfo;
  onPaid: () => void;
  onOpenWallet?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needTopup, setNeedTopup] = useState(false);
  const expired = !!paid.paid_until && !paid.access;

  const subscribe = async () => {
    if (!confirm(`Оформить подписку на «${channelName}» за ${paid.price} ₽ на 30 дней? Сумма спишется с кошелька Nova, дальше подписка будет продлеваться сама — отключить можно в любой момент.`)) return;
    setBusy(true); setError(""); setNeedTopup(false);
    const r = await api("channel_subscribe", { group_id: groupId }, userId).catch(() => null);
    setBusy(false);
    if (r?.ok) { onPaid(); return; }
    setError(r?.error || "Не удалось оформить подписку");
    if (/Недостаточно/.test(r?.error || "")) setNeedTopup(true);
  };

  return (
    <div className="px-3 pt-3 border-t border-white/5" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
      <div className="rounded-2xl p-4 text-center"
        style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(139,92,246,0.22))", border: "1px solid rgba(245,158,11,0.35)" }}>
        <div className="inline-flex items-center gap-1.5 text-amber-300 text-xs font-semibold mb-1">
          <Icon name="Crown" size={14} /> Платный канал
        </div>
        <div className="text-sm font-semibold mb-0.5">
          {expired ? `Подписка закончилась ${fmtDate(paid.paid_until!)}` : "Посты доступны только подписчикам"}
        </div>
        <div className="text-xs text-muted-foreground mb-3">
          {paid.price} ₽ в месяц · оплата с кошелька Nova · автопродление можно отключить
        </div>
        <button onClick={subscribe} disabled={busy}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-violet-600 text-white font-semibold disabled:opacity-60">
          {busy ? "Оформляем…" : expired ? `Продлить за ${paid.price} ₽` : `Подписаться за ${paid.price} ₽ / мес`}
        </button>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        {needTopup && onOpenWallet && (
          <button onClick={onOpenWallet} className="mt-2 text-xs text-violet-300 underline">Пополнить кошелёк</button>
        )}
      </div>
    </div>
  );
}

export function PaidUntilBar({ until, autoRenew, price, groupId, userId, onChanged }: {
  until: number; autoRenew: boolean; price: number; groupId: number; userId: number; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const days = Math.max(0, Math.ceil((until * 1000 - Date.now()) / 86400000));
  const toggle = async () => {
    if (autoRenew && !confirm(`Отключить автопродление? Подписка будет действовать до ${fmtDate(until)}, потом посты закроются.`)) return;
    setBusy(true);
    await api("channel_auto_renew", { group_id: groupId, on: !autoRenew }, userId).catch(() => null);
    setBusy(false);
    onChanged();
  };
  return (
    <div className="px-4 py-1.5 text-[11px] text-amber-300/90 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-1.5">
      <Icon name="Crown" size={12} />
      <span className="flex-1 min-w-0 truncate">
        {autoRenew ? `Продлится ${fmtDate(until)} за ${price} ₽` : `Подписка до ${fmtDate(until)}${days <= 3 ? ` · осталось ${days} дн.` : ""}`}
      </span>
      <button onClick={toggle} disabled={busy} className="flex-shrink-0 underline decoration-dotted disabled:opacity-50">
        {autoRenew ? "Отключить автопродление" : "Включить автопродление"}
      </button>
    </div>
  );
}
