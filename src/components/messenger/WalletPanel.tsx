import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User, type WalletTransaction, YOOKASSA_PAY_API } from "@/lib/api";

interface Props {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (u: User) => void;
  onOpenLightning?: () => void;
  onOpenStickers?: () => void;
  onCreateFundraiser?: () => void;
}

const PRESET_AMOUNTS = [100, 300, 500, 1000];

export default function WalletPanel({ currentUser, onClose, onOpenLightning, onOpenStickers, onCreateFundraiser }: Props) {
  const [balance, setBalance] = useState<number>(currentUser.wallet_balance || 0);
  const [proUntil, setProUntil] = useState<number | null>(currentUser.pro_until || null);
  const [tx, setTx] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [topupOpen, setTopupOpen] = useState(false);
  const [amount, setAmount] = useState<string>("100");
  const [email, setEmail] = useState<string>(localStorage.getItem("nova_payment_email") || "");
  const [method, setMethod] = useState<"yookassa" | "test">("yookassa");
  const [topping, setTopping] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const reload = async () => {
    const [b, h] = await Promise.all([
      api("wallet_balance", {}, currentUser.id),
      api("wallet_history", {}, currentUser.id),
    ]);
    if (typeof b.balance === "number") setBalance(b.balance);
    if (b.is_admin === true) setIsAdmin(true);
    if (typeof b.pro_until === "number" || b.pro_until === null) setProUntil(b.pro_until);
    if (Array.isArray(h.transactions)) setTx(h.transactions);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [currentUser.id]);

  const checkPaymentReturn = async () => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("payment") === "success") {
      url.searchParams.delete("payment");
      window.history.replaceState({}, "", url.toString());
      setTimeout(() => reload(), 2000);
    }
  };
  useEffect(() => { checkPaymentReturn(); }, []);

  const topupTest = async (a: number) => {
    setTopping(true);
    const r = await api("wallet_topup", { amount: a, description: "Тестовое пополнение" }, currentUser.id);
    setTopping(false);
    if (r.balance !== undefined) {
      setBalance(r.balance);
      setTopupOpen(false);
      setAmount("100");
      await reload();
    } else {
      setError(r.error || "Ошибка пополнения");
    }
  };

  const topupYookassa = async (a: number) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Введи корректный email — он нужен для чека по 54-ФЗ");
      return;
    }
    localStorage.setItem("nova_payment_email", email);
    setTopping(true);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?payment=success`;
      const res = await fetch(YOOKASSA_PAY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": String(currentUser.id) },
        body: JSON.stringify({
          amount: a,
          user_email: email,
          return_url: returnUrl,
          purpose: "wallet_topup",
        }),
      });
      const data = await res.json();
      setTopping(false);
      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else if (data.error) {
        setError(data.error);
      } else {
        setError("Не удалось создать платёж");
      }
    } catch (e) {
      setTopping(false);
      setError("Ошибка соединения с ЮKassa");
    }
  };

  const topup = async () => {
    setError("");
    const a = parseFloat(amount.replace(",", "."));
    if (!a || a < 1) { setError("Введи сумму от 1 ₽"); return; }
    if (method === "yookassa") {
      await topupYookassa(a);
    } else {
      await topupTest(a);
    }
  };

  const fmt = (v: number) => v.toLocaleString("ru", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const proRemain = () => {
    if (!proUntil) return null;
    const sec = proUntil - Date.now() / 1000;
    if (sec <= 0) return null;
    const days = Math.ceil(sec / 86400);
    return days;
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="font-bold flex-1 text-lg">Nova Кошелёк</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Balance card */}
        <div className="rounded-3xl p-5 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)" }}>
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -left-6 -bottom-6 w-32 h-32 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center gap-2 text-white/80 text-xs mb-1">
              <Icon name="Wallet" size={14} />
              Текущий баланс
            </div>
            <div className="text-4xl font-black mb-1">{fmt(balance)} ₽</div>
            {proRemain() !== null && (
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-semibold">
                <Icon name="Crown" size={12} />
                Pro · ещё {proRemain()} {(() => {
                  const d = proRemain()!;
                  const m = d % 100;
                  if (m >= 11 && m <= 14) return "дней";
                  const l = d % 10;
                  if (l === 1) return "день";
                  if (l >= 2 && l <= 4) return "дня";
                  return "дней";
                })()}
              </div>
            )}
            <button
              onClick={() => setTopupOpen(true)}
              className="mt-4 w-full py-3 rounded-2xl bg-white/15 backdrop-blur hover:bg-white/25 transition font-semibold flex items-center justify-center gap-2"
            >
              <Icon name="Plus" size={18} />
              Пополнить
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2">
          {onOpenLightning && (
            <button onClick={onOpenLightning}
              className="glass rounded-2xl p-3 flex flex-col items-center gap-1 hover:bg-white/10 transition active:scale-95">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-amber-400 bg-amber-500/15">
                <Icon name="Zap" size={18} />
              </div>
              <div className="text-[11px] font-bold">Молнии</div>
              <div className="text-[10px] text-muted-foreground">{currentUser.lightning_balance || 0} ⚡</div>
            </button>
          )}
          {onOpenStickers && (
            <button onClick={onOpenStickers}
              className="glass rounded-2xl p-3 flex flex-col items-center gap-1 hover:bg-white/10 transition active:scale-95">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-pink-400 bg-pink-500/15">
                <Icon name="Sparkles" size={18} />
              </div>
              <div className="text-[11px] font-bold">Стикеры</div>
              <div className="text-[10px] text-muted-foreground">Магазин</div>
            </button>
          )}
          {onCreateFundraiser && (
            <button onClick={onCreateFundraiser}
              className="glass rounded-2xl p-3 flex flex-col items-center gap-1 hover:bg-white/10 transition active:scale-95">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-rose-400 bg-rose-500/15">
                <Icon name="HandHeart" size={18} />
              </div>
              <div className="text-[11px] font-bold">Сбор</div>
              <div className="text-[10px] text-muted-foreground">Создать</div>
            </button>
          )}
        </div>

        {/* Topup form */}
        {topupOpen && (
          <div className="glass rounded-3xl p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Пополнить кошелёк</h3>
              <button onClick={() => setTopupOpen(false)} className="p-1 rounded-lg hover:bg-white/8">
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {PRESET_AMOUNTS.map(a => (
                <button key={a} onClick={() => setAmount(String(a))}
                  className={`py-2 rounded-xl text-sm font-semibold transition ${
                    amount === String(a)
                      ? "grad-primary text-white"
                      : "bg-white/5 hover:bg-white/10 text-muted-foreground"
                  }`}>
                  {a} ₽
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 mb-2">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Сумма"
                min="1"
                max="100000"
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <span className="text-sm text-muted-foreground">₽</span>
            </div>

            {/* Способ оплаты */}
            <div className={`grid ${isAdmin ? "grid-cols-2" : "grid-cols-1"} gap-2 mb-2`}>
              <button
                onClick={() => setMethod("yookassa")}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition ${
                  method === "yookassa"
                    ? "border-violet-400 bg-violet-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}>
                <Icon name="CreditCard" size={18} className={method === "yookassa" ? "text-violet-400" : "text-muted-foreground"} />
                <span className="text-xs font-semibold">Картой (ЮKassa)</span>
                <span className="text-[10px] text-muted-foreground">SberPay, СБП, карта</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => setMethod("test")}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition ${
                    method === "test"
                      ? "border-amber-400 bg-amber-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}>
                  <Icon name="TestTube" size={18} className={method === "test" ? "text-amber-400" : "text-muted-foreground"} />
                  <span className="text-xs font-semibold">Тестовое</span>
                  <span className="text-[10px] text-muted-foreground">Без оплаты, мгновенно</span>
                </button>
              )}
            </div>

            {/* Email для чека */}
            {method === "yookassa" && (
              <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 mb-2">
                <Icon name="Mail" size={14} className="text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email для чека"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </div>
            )}

            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
            <p className="text-[11px] text-muted-foreground mb-3">
              {method === "yookassa"
                ? "Безопасная оплата через ЮKassa. Чек придёт на email после оплаты."
                : "Средства начисляются мгновенно без реальной оплаты."}
            </p>
            <button
              onClick={topup}
              disabled={topping}
              className="w-full h-11 rounded-2xl grad-primary text-white font-semibold disabled:opacity-60"
            >
              {topping
                ? (method === "yookassa" ? "Создаём платёж..." : "Зачисляем...")
                : (method === "yookassa" ? `Перейти к оплате · ${amount || 0} ₽` : `Пополнить на ${amount || 0} ₽`)}
            </button>
          </div>
        )}

        {/* History */}
        <div>
          <h3 className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-2 px-1">
            История операций
          </h3>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : tx.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center">
              <Icon name="Receipt" size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Операций пока нет</p>
            </div>
          ) : (
            <div className="glass rounded-2xl divide-y divide-white/5">
              {tx.map(t => {
                const positive = t.amount > 0;
                const icon = t.kind === "topup" ? "ArrowDownLeft" : t.kind === "pro_purchase" ? "Crown" : "ArrowUpRight";
                const color = positive ? "text-emerald-400 bg-emerald-500/15" : "text-rose-400 bg-rose-500/15";
                return (
                  <div key={t.id} className="flex items-center gap-3 p-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                      <Icon name={icon} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.description || (positive ? "Пополнение" : "Списание")}</div>
                      <div className="text-[11px] text-muted-foreground">{fmtDate(t.created_at)}</div>
                    </div>
                    <div className={`text-sm font-bold ${positive ? "text-emerald-400" : "text-rose-400"}`}>
                      {positive ? "+" : ""}{fmt(t.amount)} ₽
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}