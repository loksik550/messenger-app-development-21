import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User, YOOKASSA_PAY_API } from "@/lib/api";
import SbpQrModal from "@/components/messenger/SbpQrModal";
import { authHeaders } from "@/lib/authToken";

interface Props {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (u: User) => void;
  onOpenWallet?: () => void;
}

interface PlanItem {
  id: string;
  title: string;
  price: number;
  sub: string;
  badge: string;
  purpose: string;
}

// Запасные тарифы: используются, если настройки не успели загрузиться
const FALLBACK_PLANS: PlanItem[] = [
  { id: "trial", title: "Пробные 3 дня", price: 0, sub: "Бесплатно, один раз", badge: "FREE", purpose: "" },
  { id: "month", title: "1 месяц", price: 199, sub: "199 ₽/мес", badge: "", purpose: "pro_month" },
  { id: "year", title: "1 год", price: 1490, sub: "124 ₽/мес · −38%", badge: "ВЫГОДНО", purpose: "pro_year" },
];

const FEATURES = [
  { icon: "BadgeCheck", text: "Значок Pro рядом с именем", color: "#a78bfa" },
  { icon: "Smile", text: "Эмодзи-статус, видный всем", color: "#f472b6" },
  { icon: "Brush", text: "Цветной ник в чатах и группах", color: "#818cf8" },
  { icon: "EyeOff", text: "Инкогнито — скрыть «в сети» ото всех", color: "#60a5fa" },
  { icon: "Palette", text: "4 эксклюзивные темы оформления", color: "#facc15" },
];

const SPARKS = Array.from({ length: 46 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: r(1) * 100, y: r(2) * 100, s: 6 + r(3) * 14, o: 0.35 + r(4) * 0.6, d: r(5) * 3, c: r(6) > 0.5 ? "#c4b5fd" : "#a5b4fc" };
});

export default function ProPanel({ currentUser, onClose, onUserUpdate, onOpenWallet }: Props) {
  const [selected, setSelected] = useState<string>("month");
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"yookassa" | "sbp" | "wallet">("yookassa");
  const [plans, setPlans] = useState<PlanItem[]>(FALLBACK_PLANS);
  const [qr, setQr] = useState<{ data: string; paymentId: string } | null>(null);

  // Тарифы настраиваются в Dev-панели и подтягиваются сюда
  useEffect(() => {
    let alive = true;
    api("premium_plans", {}, currentUser.id).then(r => {
      if (!alive || !r || r.error || !Array.isArray(r.plans) || r.plans.length === 0) return;
      const mapped: PlanItem[] = r.plans.map((p: {
        code: string; title: string; price: number; subtitle: string;
        badge: string; is_trial: boolean;
      }) => ({
        id: p.code, title: p.title, price: p.price, sub: p.subtitle,
        badge: p.badge, purpose: p.is_trial ? "" : `pro_${p.code}`,
      }));
      setPlans(mapped);
    });
    return () => { alive = false; };
  }, [currentUser.id]);
  const [email, setEmail] = useState<string>(localStorage.getItem("nova_payment_email") || "");

  const balance = currentUser.wallet_balance || 0;
  const isPro = currentUser.is_pro || (currentUser.pro_until && currentUser.pro_until > Date.now() / 1000);
  const trialUsed = !!currentUser.pro_trial_used;
  const plan = plans.find(p => p.id === selected) || plans[0];
  const isTrialPlan = !!plan && (plan.price === 0 || plan.id === "trial");

  const buyTrial = async () => {
    setBuying(true); setError("");
    const r = await api("buy_pro", { plan: plan?.id || "trial" }, currentUser.id);
    setBuying(false);
    if (r.is_pro) {
      const userR = await api("get_me", {}, currentUser.id);
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
      const userR = await api("get_me", {}, currentUser.id);
      if (userR.user) {
        onUserUpdate?.(userR.user);
        localStorage.setItem("nova_user", JSON.stringify(userR.user));
      }
      onClose();
    } else {
      setError(r.error || "Не удалось оформить");
    }
  };

  const buyYookassa = async (useSbp = false) => {
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
        headers: { "Content-Type": "application/json", ...authHeaders(currentUser.id) },
        body: JSON.stringify({
          amount: plan.price,
          user_email: email,
          return_url: returnUrl,
          purpose: plan.purpose,
          method: useSbp ? "sbp" : "card",
        }),
      });
      const d = await res.json();
      // СБП: показываем QR-код прямо в приложении и ждём оплату
      if (useSbp && d.qr_data) {
        setBuying(false);
        setQr({ data: d.qr_data, paymentId: d.payment_id });
        return;
      }
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
          const userR = await api("get_me", {}, currentUser.id);
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
    if (isTrialPlan) return buyTrial();
    if (method === "wallet") return buyWallet();
    return buyYookassa(method === "sbp");
  };

  if (qr) {
    return (
      <SbpQrModal
        qrData={qr.data}
        paymentId={qr.paymentId}
        amount={plan?.price || 0}
        userId={currentUser.id}
        onPaid={async () => {
          const me = await api("refresh_me", {}, currentUser.id);
          if (me?.user) {
            onUserUpdate?.(me.user);
            localStorage.setItem("nova_user", JSON.stringify(me.user));
          }
          setQr(null);
          onClose();
        }}
        onClose={() => setQr(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[250] bg-black text-white overflow-y-auto animate-fade-in">
      <style>{`@keyframes pro-twinkle{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}@keyframes pro-float{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-8px) rotate(-2deg)}}`}</style>
      <button
        onClick={onClose}
        aria-label="Назад"
        className="fixed left-4 z-10 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/15 transition"
        style={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <Icon name="ChevronLeft" size={24} />
      </button>

      <div className="max-w-md mx-auto px-5" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
        <div className="relative h-64 -mx-5 overflow-hidden" style={{ marginTop: "env(safe-area-inset-top)" }}>
          {SPARKS.map((p, i) => (
            <svg key={i} viewBox="0 0 24 24" className="absolute"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, opacity: p.o, animation: `pro-twinkle ${2.4 + p.d}s ease-in-out ${p.d}s infinite` }}>
              <path d="M12 0C12.6 7 17 11.4 24 12C17 12.6 12.6 17 12 24C11.4 17 7 12.6 0 12C7 11.4 11.4 7 12 0Z" fill={p.c} />
            </svg>
          ))}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full bg-violet-600/25 blur-3xl" />
          <img src="/pro-bolt.webp" alt="" width={400} height={400}
            className="absolute left-1/2 top-1/2 w-44 h-44 object-contain"
            style={{ marginLeft: -88, marginTop: -88, animation: "pro-float 4s ease-in-out infinite" }} />
        </div>

        <h2 className="text-3xl font-bold text-center mb-3">Nova Pro</h2>
        <p className="text-center text-[15px] text-white/80 leading-snug mb-2">
          <b className="text-white">Больше свободы</b> и <b className="text-white">десятки эксклюзивных функций</b> с подпиской <b className="text-white">Nova Pro</b>.
        </p>
        <p className="text-center text-xs text-violet-300/90 mb-6 flex items-center justify-center gap-1.5">
          <Icon name="Sparkles" size={13} /> Список возможностей постоянно пополняется
        </p>

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

        <div className="rounded-2xl bg-[#1c1c1e] overflow-hidden mb-6">
          {FEATURES.map((f, i) => (
            <div key={f.icon} className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-white/[0.06]" : ""}`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: f.color }}>
                <Icon name={f.icon} size={17} className="text-white" />
              </div>
              <span className="text-[15px]">{f.text}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 px-4 py-3 border-t border-white/[0.06] text-white/50">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/10">
              <Icon name="Plus" size={17} />
            </div>
            <div className="min-w-0">
              <div className="text-[15px]">Скоро — ещё больше функций</div>
              <div className="text-xs text-white/40">Большие файлы, расшифровка голосовых и другое</div>
            </div>
          </div>
        </div>

        <div className="text-[13px] uppercase tracking-wide text-white/45 px-4 mb-2">Выберите тариф</div>
        <div className="space-y-2 mb-3">
          {plans.map(p => {
            const disabled = (p.price === 0 || p.id === "trial") && trialUsed;
            return (
              <button key={p.id}
                onClick={() => !disabled && setSelected(p.id)}
                disabled={disabled}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                  selected === p.id ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-[#1c1c1e] hover:border-white/20"
                } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selected === p.id ? "border-violet-400 bg-violet-400" : "border-white/30"
                }`}>
                  {selected === p.id && <Icon name="Check" size={12} className="text-white" />}
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
        {!isTrialPlan && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button onClick={() => setMethod("yookassa")}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition ${
                  method === "yookassa" ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-white/5"
                }`}>
                <Icon name="CreditCard" size={16} className={method === "yookassa" ? "text-violet-400" : "text-muted-foreground"} />
                <span className="text-xs font-semibold">Картой</span>
                <span className="text-[10px] text-muted-foreground">ЮKassa</span>
              </button>
              <button onClick={() => setMethod("sbp")}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition ${
                  method === "sbp" ? "border-sky-400 bg-sky-500/10" : "border-white/10 bg-white/5"
                }`}>
                <Icon name="QrCode" size={16} className={method === "sbp" ? "text-sky-400" : "text-muted-foreground"} />
                <span className="text-xs font-semibold">СБП</span>
                <span className="text-[10px] text-muted-foreground">QR-код</span>
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

            {(method === "yookassa" || method === "sbp") && (
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
          disabled={buying || (isTrialPlan && trialUsed) || (!isTrialPlan && method === "wallet" && balance < plan.price)}
          className="w-full py-4 rounded-2xl font-bold text-white text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-600/30"
          style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}
        >
          {buying ? "Оформляем..."
            : isTrialPlan ? "Активировать пробный"
            : method === "sbp" ? `Оплатить по QR · ${plan.price} ₽`
            : method === "yookassa" ? `Оплатить ${plan.price} ₽`
            : `${isPro ? "Продлить" : "Оформить"} за ${plan.price} ₽`}
        </button>

        <div className="text-[13px] uppercase tracking-wide text-white/45 px-4 mt-8 mb-2">О Nova Pro</div>
        <div className="rounded-3xl bg-[#1c1c1e] px-5 py-4 text-[15px] leading-relaxed text-white/90 space-y-4">
          <p>
            Бесплатная версия Nova даёт всё необходимое для общения: чаты, звонки, голосовые, фото и видео. А с <b>Nova Pro</b> ваши возможности станут ещё шире.
          </p>
          <p>
            Мы сделали подписку <b>Nova Pro</b> платной, потому что большинство премиум-функций требуют дополнительных расходов — на серверы в России, хранение файлов и связь для звонков. Вклад подписчиков покрывает эти расходы и помогает Nova оставаться бесплатным для всех пользователей.
          </p>
          <p>
            Мы регулярно добавляем в <b>Nova Pro</b> новые функции — подписчики получают их первыми и без доплаты.
          </p>
        </div>
        <p className="text-[13px] text-white/45 px-4 mt-3 leading-relaxed">
          Оформляя подписку Nova Pro, вы принимаете условия{" "}
          <a href="/terms" target="_blank" rel="noopener" className="text-sky-400">Пользовательского соглашения</a> и{" "}
          <a href="/privacy" target="_blank" rel="noopener" className="text-sky-400">Политики конфиденциальности</a> Nova.
        </p>
      </div>
    </div>
  );
}