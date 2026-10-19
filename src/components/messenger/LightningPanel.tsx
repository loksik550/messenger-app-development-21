import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User, type LightningTx } from "@/lib/api";

interface Props {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (u: User) => void;
}

const PRESETS = [10, 50, 100, 300, 500, 1000];
const RUB_PER_LIGHTNING = 3;

export default function LightningPanel({ currentUser, onClose, onUserUpdate }: Props) {
  const [tab, setTab] = useState<"buy" | "history">("buy");
  const [lightning, setLightning] = useState<number>(currentUser.lightning_balance || 0);
  const [balance, setBalance] = useState<number>(currentUser.wallet_balance || 0);
  const [qty, setQty] = useState<string>("100");
  const [tx, setTx] = useState<LightningTx[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    const [b, h, w] = await Promise.all([
      api("lightning_balance", {}, currentUser.id),
      api("lightning_history", {}, currentUser.id),
      api("wallet_balance", {}, currentUser.id),
    ]);
    if (typeof b.lightning === "number") setLightning(b.lightning);
    if (Array.isArray(h.transactions)) setTx(h.transactions);
    if (typeof w.balance === "number") setBalance(w.balance);
  };

  useEffect(() => { reload(); }, [currentUser.id]);

  const buy = async () => {
    setError("");
    const q = parseInt(qty, 10);
    if (!q || q < 1) { setError("Введи количество от 1 ⚡"); return; }
    const cost = q * RUB_PER_LIGHTNING;
    if (balance < cost) { setError(`Недостаточно средств. Нужно ${cost} ₽, на счету ${balance.toFixed(2)} ₽`); return; }
    setBusy(true);
    const r = await api("lightning_buy", { quantity: q }, currentUser.id);
    setBusy(false);
    if (typeof r.lightning === "number") {
      setLightning(r.lightning);
      setBalance(r.balance);
      const userR = await api("get_me", {}, currentUser.id);
      if (userR.user) {
        onUserUpdate?.(userR.user);
        localStorage.setItem("nova_user", JSON.stringify(userR.user));
      }
      await reload();
    } else {
      setError(r.error || "Ошибка покупки");
    }
  };

  const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const txIcon = (k: string) => k === "received" ? "ArrowDownLeft" : k === "sent" ? "ArrowUpRight" : k === "purchase" ? "Plus" : "Zap";
  const txColor = (k: string) => k === "received" || k === "purchase" ? "text-emerald-400" : "text-amber-400";

  const cost = (parseInt(qty, 10) || 0) * RUB_PER_LIGHTNING;

  return (
    <div className="fixed inset-0 z-[260] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="font-bold flex-1 text-lg">Молнии</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
        {/* Hero */}
        <div className="rounded-3xl p-5 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #eab308 100%)" }}>
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute right-2 top-2 text-7xl opacity-20">⚡</div>
          <div className="relative">
            <div className="text-xs text-white/80 mb-1">Твой баланс</div>
            <div className="text-4xl font-black mb-1 flex items-center gap-2">
              {lightning.toLocaleString("ru")}
              <span className="text-2xl">⚡</span>
            </div>
            <div className="text-xs text-white/80">≈ {(lightning * RUB_PER_LIGHTNING).toLocaleString("ru")} ₽</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground bg-white/5 rounded-xl p-3 leading-relaxed">
          Молнии — внутренняя валюта Nova. Покупай за рубли с кошелька (курс <b>{RUB_PER_LIGHTNING} ₽ = 1 ⚡</b>),
          дари друзьям как чаевые или используй для платных стикеров и подарков.
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 rounded-2xl">
          <button onClick={() => setTab("buy")}
            className={`py-2 rounded-xl text-sm font-bold transition ${tab === "buy" ? "bg-white/15" : "text-muted-foreground"}`}>
            Купить
          </button>
          <button onClick={() => setTab("history")}
            className={`py-2 rounded-xl text-sm font-bold transition ${tab === "history" ? "bg-white/15" : "text-muted-foreground"}`}>
            История
          </button>
        </div>

        {tab === "buy" && (
          <div className="glass rounded-3xl p-4 space-y-3">
            <div className="text-xs text-muted-foreground">Сколько ⚡ купить?</div>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map(p => (
                <button key={p} onClick={() => setQty(String(p))}
                  className={`py-2.5 rounded-xl text-sm font-bold transition ${
                    parseInt(qty) === p ? "bg-amber-500 text-white" : "bg-white/5 hover:bg-white/10"
                  }`}>
                  {p} ⚡
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-3">
              <Icon name="Zap" size={16} className="text-amber-400" />
              <input
                type="number"
                value={qty}
                onChange={e => setQty(e.target.value)}
                placeholder="Количество ⚡"
                min="1"
                max="100000"
                className="flex-1 bg-transparent outline-none text-base font-semibold"
              />
            </div>
            <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">К оплате</span>
              <span className="font-black text-amber-400">{cost.toLocaleString("ru")} ₽</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Кошелёк</span>
              <span>{balance.toFixed(2)} ₽</span>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={buy}
              disabled={busy || cost === 0}
              className="w-full py-3.5 rounded-2xl font-black text-white text-sm disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              {busy ? "Покупаем..." : `Купить за ${cost.toLocaleString("ru")} ₽`}
            </button>
          </div>
        )}

        {tab === "history" && (
          <div className="glass rounded-3xl p-2">
            {tx.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                История пуста. Купи или получи первые ⚡
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {tx.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 ${txColor(t.kind)}`}>
                      <Icon name={txIcon(t.kind)} size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{t.description || t.kind}</div>
                      <div className="text-[11px] text-muted-foreground">{fmtDate(t.created_at)}</div>
                    </div>
                    <div className={`text-sm font-black ${t.amount > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                      {t.amount > 0 ? "+" : ""}{t.amount} ⚡
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
