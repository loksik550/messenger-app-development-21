import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";

interface Stats { price: number; fee_percent: number; active_subscribers: number; earned_total: number; earned_30d: number }

const rub = (v: number) => `${v.toLocaleString("ru", { maximumFractionDigits: 2 })} ₽`;

export default function PaidChannelSettings({ groupId, userId }: { groupId: number; userId: number }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => api("channel_paid_stats", { group_id: groupId }, userId).then((r) => {
    if (r && !r.error) { setStats(r); setPrice(r.price ? String(r.price) : ""); }
  }).catch(() => null);

  useEffect(() => { load(); }, [groupId, userId]);

  const save = async (value: number) => {
    setBusy(true); setMsg("");
    const r = await api("channel_set_price", { group_id: groupId, price: value }, userId).catch(() => null);
    setBusy(false);
    if (r?.ok) { setMsg(value ? "Цена сохранена" : "Канал снова бесплатный"); load(); }
    else setMsg(r?.error || "Не удалось сохранить");
  };

  if (!stats) return null;
  const n = Number(price.replace(",", ".")) || 0;
  const fee = stats.fee_percent;
  const yours = Math.round(n * (100 - fee)) / 100;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="Crown" size={18} className="text-amber-400" />
        <span className="font-semibold text-sm">Платная подписка</span>
        {stats.price > 0 && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">Включена</span>}
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Посты увидят только те, кто оплатил подписку. Деньги приходят вам в кошелёк Nova, комиссия сервиса — {fee}%.
      </p>

      <div className="flex gap-2 mb-2">
        <div className="flex-1 flex items-center rounded-xl bg-white/5 border border-white/10 px-3">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))}
            inputMode="decimal"
            placeholder="Цена, от 50"
            className="flex-1 min-w-0 py-2.5 bg-transparent text-sm outline-none"
          />
          <span className="text-xs text-muted-foreground">₽ / мес</span>
        </div>
        <button onClick={() => save(n)} disabled={busy || n < 50}
          className="px-4 rounded-xl bg-gradient-to-r from-amber-500 to-violet-600 text-white text-sm font-semibold disabled:opacity-50">
          Сохранить
        </button>
      </div>
      {n >= 50 && <p className="text-[11px] text-muted-foreground mb-2">С каждой оплаты вы получите {rub(yours)}</p>}

      {stats.price > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 my-3">
            <div className="rounded-xl bg-white/5 p-2 text-center">
              <div className="text-base font-bold">{stats.active_subscribers}</div>
              <div className="text-[10px] text-muted-foreground">подписчиков</div>
            </div>
            <div className="rounded-xl bg-white/5 p-2 text-center">
              <div className="text-base font-bold">{rub(stats.earned_30d)}</div>
              <div className="text-[10px] text-muted-foreground">за 30 дней</div>
            </div>
            <div className="rounded-xl bg-white/5 p-2 text-center">
              <div className="text-base font-bold">{rub(stats.earned_total)}</div>
              <div className="text-[10px] text-muted-foreground">всего</div>
            </div>
          </div>
          <button onClick={() => { if (confirm("Сделать канал бесплатным? Посты станут видны всем участникам.")) save(0); }}
            disabled={busy} className="text-xs text-red-400/80 hover:text-red-400">
            Отключить платную подписку
          </button>
        </>
      )}
      {msg && <p className="text-xs text-violet-300 mt-2">{msg}</p>}
    </div>
  );
}
