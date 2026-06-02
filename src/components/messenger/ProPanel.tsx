import { useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User, YOOKASSA_PAY_API } from "@/lib/api";

interface Props {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (u: User) => void;
  onOpenWallet?: () => void;
}

const PLANS = [
  { id: "trial", title: "Пробные 3 дня", price: 0, sub: "Бесплатно, один раз", badge: "FREE", purpose: "" },
  { id: "month", title: "1 месяц", price: 199, sub: "199 ₽/мес", badge: "", purpose: "pro_month" },
  { id: "year", title: "1 год", price: 1490, sub: "124 ₽/мес · −38%", badge: "ВЫГОДНО", purpose: "pro_year" },
];

const FEATURES = [
  { icon: "Crown", text: "Эмодзи-статус и цветной ник" },
  { icon: "Eye", text: "Инкогнито (скрыть «в сети»)" },
  { icon: "Image", text: "Файлы до 4 ГБ" },
  { icon: "Lock", text: "Контроль входящих" },
  { icon: "Zap", text: "Без рекламы" },
  { icon: "Headphones", text: "Приоритетная поддержка" },
  { icon: "Palette", text: "Эксклюзивные темы" },
  { icon: "Users", text: "Звонки до 50 человек" },
  { icon: "Sparkles", text: "Авторские стикеры" },
  { icon: "Volume2", text: "Свои рингтоны" },
];

export default function ProPanel({ currentUser, onClose, onUserUpdate, onOpenWallet }: Props) {
  const [selected, setSelected] = useState<string>("month");
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"yookassa" | "wallet">("yookassa");
  const [email, setEmail] = useState<string>(localStorage.getItem("nova_payment_email") || "");

  const balance = currentUser.wallet_balance || 0;
  const isPro = currentUser.is_pro || (currentUser.pro_until && currentUser.pro_until > Date.now() / 1000);
  const trialUsed = !!currentUser.pro_trial_used;
  const plan = PLANS.find(p => p.id === selected)!;

  const buyTrial = async () => {
    setBuying(true); setError("");
    const r = await api("buy_pro", { plan: "trial" }, currentUser.id);
    setBuying(false);
    if (r.is_pro) {
      const userR = await api("get_me", { phone: currentUser.phone });
      if (userR.user) {
        onUserUpdate?.(userR.user);
        localStorage.setItem("nova_user", JSON.stringify(userR.user));
      }
      onClose();
    } else {
      setError(r.error || "Не удалось активировать пробный");
    }
  };

  const buyWallet = async () => {
    setBuying(true); setError("");
    const r = await api("buy_pro", { plan: selected }, currentUser.id);
    setBuying(false);
    if (r.is_pro) {
      const userR = await api("get_me", { phone: currentUser.phone });
      if (userR.user) {
        onUserUpdate?.(userR.user);
        localStorage.setItem("nova_user", JSON.stringify(userR.user));
      }
      onClose();
    } else {
      setError(r.error || "Не удалось оформить");
    }
  };

  const buyYookassa = async () => {
    setError("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Введи email — он нужен для чека"); return;
    }
    localStorage.setItem("nova_payment_email", email);
    setBuying(true);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?payment=success`;
      const res = await fetch(YOOKASSA_PAY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": String(currentUser.id) },
        body: JSON.stringify({
          amount: plan.price,
          user_email: email,
          return_url: returnUrl,
          purpose: plan.purpose,
        }),
      });
      const d = await res.json();
      if (d.payment_url) {
        setBuying(false);
        window.location.href = d.payment_url;
        return;
      }
      // ЮKassa не настроена — активируем Pro напрямую
      if (res.status === 503) {
        const r = await api("buy_pro", { plan: selected }, currentUser.id);
        setBuying(false);
        if (r.is_pro) {
          const userR = await api("get_me", { phone: currentUser.phone });
          if (userR.user) {
            onUserUpdate?.(userR.user);
            localStorage.setItem("nova_user", JSON.stringify(userR.user));
          }
          onClose();
        } else {
          setError(r.error || "Не удалось оформить");
        }
        return;
      }
      setBuying(false);
      setError(d.error || "Не удалось создать платёж");
    } catch {
      setBuying(false);
      setError("Ошибка соединения с оплатой");
    }
  };

  const buy = () => {
    if (selected === "trial") return buyTrial();
    return method === "yookassa" ? buyYookassa() : buyWallet();
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-t-3xl sm:rounded-3xl p-5 pb-7 max-h-[92vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
            👑
          </div>
        </div>
        <h2 className="text-2xl font-black text-center mb-1">Nova Pro</h2>
        <p className="text-muted-foreground text-sm text-center mb-4">Полный доступ к расширенным возможностям</p>

        {isPro && (
          <div className="rounded-2xl p-3 mb-4 flex items-center gap-3"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.15))", border: "1px solid rgba(245,158,11,0.3)" }}>
            <Icon name="ShieldCheck" size={20} className="text-amber-400" />
            <div className="flex-1">
              <div className="text-sm font-bold text-amber-400">Pro активен</div>
              <div className="text-xs text-muted-foreground">
                до {currentUser.pro_until ? new Date(currentUser.pro_until * 1000).toLocaleDateString("ru") : "—"}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-5">
          {FEATURES.map(f => (
            <div key={f.icon} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(245,158,11,0.15)" }}>
                <Icon name={f.icon} size={14} style={{ color: "#f59e0b" }} />
              </div>
              <span className="text-[11px] font-medium leading-tight">{f.text}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2 mb-3">
          {PLANS.map(p => {
            const disabled = p.id === "trial" && trialUsed;
            return (
              <button key={p.id}
                onClick={() => !disabled && setSelected(p.id)}
                disabled={disabled}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                  selected === p.id ? "border-amber-400 bg-amber-500/10" : "border-white/10 hover:border-white/20"
                } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selected === p.id ? "border-amber-400 bg-amber-400" : "border-white/30"
                }`}>
                  {selected === p.id && <Icon name="Check" size={12} className="text-black" />}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{p.title}</span>
                    {p.badge && (
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                        p.badge === "FREE" ? "bg-emerald-500/20 text-emerald-300"
                        : p.badge === "ВЫГОДНО" ? "bg-amber-500/20 text-amber-300"
                        : "bg-violet-500/20 text-violet-300"
                      }`}>{p.badge}</span>
                    )}
                    {disabled && <span className="text-[9px] text-muted-foreground">(уже использован)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.sub}</div>
                </div>
                <div className="font-black text-base">{p.price === 0 ? "0 ₽" : `${p.price} ₽`}</div>
              </button>
            );
          })}
        </div>

        {/* Метод оплаты — не для триала */}
        {selected !== "trial" && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => setMethod("yookassa")}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition ${
                  method === "yookassa" ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-white/5"
                }`}>
                <Icon name="CreditCard" size={16} className={method === "yookassa" ? "text-violet-400" : "text-muted-foreground"} />
                <span className="text-xs font-semibold">Картой</span>
                <span className="text-[10px] text-muted-foreground">ЮKassa · СБП</span>
              </button>
              <button onClick={() => setMethod("wallet")}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition ${
                  method === "wallet" ? "border-emerald-400 bg-emerald-500/10" : "border-white/10 bg-white/5"
                }`}>
                <Icon name="Wallet" size={16} className={method === "wallet" ? "text-emerald-400" : "text-muted-foreground"} />
                <span className="text-xs font-semibold">С кошелька</span>
                <span className="text-[10px] text-muted-foreground">{balance.toFixed(2)} ₽</span>
              </button>
            </div>

            {method === "yookassa" && (
              <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 mb-3">
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

            {method === "wallet" && balance < plan.price && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-3 text-xs text-amber-300 flex items-center justify-between gap-2">
                <span>Не хватает {(plan.price - balance).toFixed(2)} ₽</span>
                {onOpenWallet && (
                  <button onClick={onOpenWallet} className="text-xs font-bold text-violet-300 underline">
                    Пополнить
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-400 text-center mb-3">{error}</p>}

        <button
          onClick={buy}
          disabled={buying || (selected === "trial" && trialUsed) || (selected !== "trial" && method === "wallet" && balance < plan.price)}
          className="w-full py-4 rounded-2xl font-black text-white text-base disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        >
          {buying ? "Оформляем..."
            : selected === "trial" ? "Активировать пробный"
            : method === "yookassa" ? `Оплатить ${plan.price} ₽`
            : `${isPro ? "Продлить" : "Оформить"} за ${plan.price} ₽`}
        </button>
        <button onClick={onClose} className="w-full py-3 text-sm text-muted-foreground mt-1">
          Не сейчас
        </button>
      </div>
    </div>
  );
}