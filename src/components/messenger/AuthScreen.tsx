import { useEffect, useState, type FormEvent } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import PrivacyPolicyPanel from "./PrivacyPolicyPanel";
import ResetWaiting, { loadResetTicket, saveResetTicket, type ResetTicket } from "./ResetWaiting";
import VkLoginButton from "@/components/messenger/VkLoginButton";

type Step = "phone" | "password" | "name" | "reset" | "waiting";
const DRAFT_KEY = "nova_auth_draft";

// Черновик формы живёт вне компонента: если экран пересоздастся
// (свернули приложение, сменилась ориентация, проверка тех. работ),
// введённые номер, пароль и имя не пропадут.
const memDraft: { step?: Step; phone?: string; password?: string; name?: string; resetName?: string; resetPassword?: string } = {};

function loadDraft(): { step?: Step; phone?: string; name?: string; resetName?: string } {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}"); } catch { return {}; }
}

function initialStep(): Step {
  if (loadResetTicket()) return "waiting";
  if (memDraft.step && memDraft.step !== "waiting") return memDraft.step;
  const d = loadDraft();
  if (d.step === "name" || d.step === "password") return "password";
  if (d.step === "reset") return "reset";
  return "phone";
}

function clearAuthDraft() {
  delete memDraft.step; delete memDraft.phone; delete memDraft.password; delete memDraft.name;
  delete memDraft.resetName; delete memDraft.resetPassword;
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

const noBlur = { onPointerDown: (e: React.PointerEvent) => e.preventDefault(), onMouseDown: (e: React.MouseEvent) => e.preventDefault() };

export function AuthScreen({ onDone: onDoneRaw }: { onDone: (user: User, token?: string) => void }) {
  const onDone = (user: User, token?: string) => { clearAuthDraft(); onDoneRaw(user, token); };
  const [ticket, setTicket] = useState<ResetTicket | null>(() => loadResetTicket());
  const [step, setStep] = useState<Step>(initialStep);
  const [showPolicy, setShowPolicy] = useState(false);
  const [phone, setPhone] = useState(() => memDraft.phone ?? loadDraft().phone ?? "");
  const [password, setPassword] = useState(() => memDraft.password ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState(() => memDraft.name ?? loadDraft().name ?? "");
  const [resetName, setResetName] = useState(() => memDraft.resetName ?? loadDraft().resetName ?? "");
  const [resetPassword, setResetPassword] = useState(() => memDraft.resetPassword ?? "");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    memDraft.step = step; memDraft.phone = phone; memDraft.password = password; memDraft.name = name;
    memDraft.resetName = resetName; memDraft.resetPassword = resetPassword;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, phone, name, resetName })); } catch { /* ignore */ }
  }, [step, phone, password, name, resetName, resetPassword]);

  const keepVisible = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    setTimeout(() => { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ } }, 300);
  };

  const submit = (fn: () => void) => (e: FormEvent) => { e.preventDefault(); fn(); };

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (!digits) return "";
    if (digits.length <= 1) return `+7`;
    if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
    if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
    if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handlePhoneSubmit = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 11) { triggerShake(); return; }
    setErrorMsg("");
    setStep("password");
  };

  const handlePasswordSubmit = async () => {
    if (loading) return;
    const digits = phone.replace(/\D/g, "");
    if (password.length < 4) { setErrorMsg("Пароль не короче 4 символов"); triggerShake(); return; }
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await api("auth_password", { phone: digits, password });
      if (data.user) {
        onDone(data.user, data.token);
      } else if (data.need_name) {
        // Новый пользователь — спрашиваем имя
        setStep("name");
      } else {
        setErrorMsg(data.error || "Ошибка входа");
        triggerShake();
      }
    } catch {
      setErrorMsg("Нет связи с сервером Nova. Проверьте интернет или подключитесь к Wi-Fi");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = async () => {
    if (loading) return;
    const clean = name.replace(/\s+/g, " ").trim().slice(0, 64);
    if (clean.length < 2) { setErrorMsg("Имя — от 2 символов"); triggerShake(); return; }
    if (password.length < 4) { setErrorMsg("Введите пароль ещё раз"); setStep("password"); return; }
    setLoading(true);
    setErrorMsg("");
    try {
      const digits = phone.replace(/\D/g, "");
      const data = await api("auth_password", { phone: digits, password, name: clean });
      if (data.user) {
        onDone(data.user, data.token);
      } else {
        setErrorMsg(data.error || "Ошибка регистрации");
        triggerShake();
      }
    } catch {
      setErrorMsg("Нет связи с сервером Nova. Проверьте интернет или подключитесь к Wi-Fi");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async () => {
    if (loading) return;
    const digits = phone.replace(/\D/g, "");
    if (resetName.trim().length < 2) { setErrorMsg("Укажите имя аккаунта"); triggerShake(); return; }
    if (resetPassword.length < 6) { setErrorMsg("Новый пароль не короче 6 символов"); triggerShake(); return; }
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await api("reset_request", { phone: digits, name: resetName.trim(), new_password: resetPassword });
      if (data.request_id && data.poll_key) {
        const t: ResetTicket = { request_id: data.request_id, poll_key: data.poll_key, route: data.route };
        saveResetTicket(t);
        setTicket(t);
        setResetPassword("");
        setStep("waiting");
      } else {
        setErrorMsg(data.error || "Не удалось восстановить доступ");
        triggerShake();
      }
    } catch {
      setErrorMsg("Нет связи с сервером Nova. Проверьте интернет или подключитесь к Wi-Fi");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Политику открываем панелью внутри приложения: в APK нет вкладок браузера,
  // и обычная ссылка привела бы к пустому экрану.
  if (showPolicy) {
    return <PrivacyPolicyPanel onBack={() => setShowPolicy(false)} />;
  }

  return (
    <div className="h-[100dvh] relative overflow-hidden">
      <div className="absolute inset-0 overflow-y-auto overscroll-contain">
      <div className="min-h-full flex items-center justify-center py-6" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
      <div className="mesh-bg" />
      <div className="absolute top-[-10%] right-[-10%] w-80 h-80 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 rounded-full bg-sky-600/15 blur-3xl pointer-events-none" />

      <div className={`w-full max-w-sm mx-4 animate-scale-in ${shake ? "animate-[shake_0.4s_ease]" : ""}`}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 grad-primary rounded-3xl flex items-center justify-center mx-auto mb-4 glow-primary animate-float">
            <Icon name="Zap" size={36} className="text-white" />
          </div>
          <h1 className="text-4xl font-black grad-text tracking-tight">Nova</h1>
          <p className="text-muted-foreground text-sm mt-1">Мессенджер для общения</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(["phone", "password", "name"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-2 rounded-full transition-all duration-300 ${
                step === s ? "w-6 grad-primary" :
                (["phone", "password", "name"].indexOf(step) > i ? "w-2 bg-violet-500" : "w-2 bg-white/15")
              }`} />
            </div>
          ))}
        </div>

        {/* Phone step */}
        {step === "phone" && (
          <form onSubmit={submit(handlePhoneSubmit)} noValidate className="animate-fade-in space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Введите номер телефона</h2>
              <p className="text-sm text-muted-foreground">После входа вы получите уникальный ID в Nova</p>
            </div>
            <div className={`flex items-center gap-3 glass rounded-2xl px-4 py-4 border ${shake ? "border-red-500/50" : "border-white/0 focus-within:border-violet-500/40"} transition-colors`}>
              <span className="text-2xl">🇷🇺</span>
              <input
                autoFocus
                value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                onFocus={keepVisible}
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
                placeholder="+7 (___) ___-__-__"
                className="flex-1 bg-transparent outline-none text-base text-foreground placeholder-muted-foreground font-medium"
                type="tel"
              />
            </div>
            {errorMsg && <p className="text-center text-sm text-red-400 animate-fade-in">{errorMsg}</p>}
            <button
              type="submit"
              {...noBlur}
              disabled={loading}
              className="w-full py-4 grad-primary rounded-2xl text-white font-bold text-base glow-primary hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Проверяем...</>
              ) : (
                <>Продолжить <Icon name="ArrowRight" size={18} /></>
              )}
            </button>
          </form>
        )}
        {step === "phone" && (
          <div className="space-y-4 mt-4">
            <VkLoginButton onDone={onDone} />
            <p className="text-center text-xs text-muted-foreground">
              Нажимая «Продолжить», вы соглашаетесь с{" "}
              <button type="button" onClick={() => setShowPolicy(true)} className="text-violet-400 hover:text-violet-300 underline">
                Политикой конфиденциальности
              </button>
            </p>
          </div>
        )}

        {/* Password step */}
        {step === "password" && (
          <form onSubmit={submit(handlePasswordSubmit)} noValidate className="animate-fade-in space-y-4">
            <div>
              <button type="button" onClick={() => { setStep("phone"); setErrorMsg(""); }} className="flex items-center gap-1 text-violet-400 text-sm mb-3 hover:text-violet-300 transition-colors">
                <Icon name="ChevronLeft" size={16} /> Изменить номер
              </button>
              <h2 className="text-xl font-bold mb-1">Введите пароль</h2>
              <p className="text-sm text-muted-foreground">Для номера {formatPhone(phone)}. Новый пользователь — придумайте пароль.</p>
            </div>
            <div className={`flex items-center gap-3 glass rounded-2xl px-4 py-4 border ${shake ? "border-red-500/50" : "border-white/0 focus-within:border-violet-500/40"} transition-colors`}>
              <Icon name="Lock" size={18} className="text-muted-foreground" />
              <input
                autoFocus
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={keepVisible}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                placeholder="Пароль"
                className="flex-1 bg-transparent outline-none text-base text-foreground placeholder-muted-foreground font-medium"
                type={showPassword ? "text" : "password"}
              />
              <button type="button" {...noBlur} onClick={() => setShowPassword(v => !v)} className="text-muted-foreground hover:text-foreground">
                <Icon name={showPassword ? "EyeOff" : "Eye"} size={18} />
              </button>
            </div>
            {errorMsg && <p className="text-center text-sm text-red-400 animate-fade-in">{errorMsg}</p>}
            <button
              type="submit"
              {...noBlur}
              disabled={loading}
              className="w-full py-4 grad-primary rounded-2xl text-white font-bold text-base glow-primary hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Проверяем...</>
              ) : (
                <>Войти <Icon name="ArrowRight" size={18} /></>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setStep("reset"); setErrorMsg(""); }}
              className="w-full text-center text-sm text-violet-400 hover:text-violet-300 transition-colors py-1"
            >
              Забыли пароль?
            </button>
          </form>
        )}

        {/* Reset password step */}
        {step === "reset" && (
          <form onSubmit={submit(handleResetSubmit)} noValidate autoComplete="off" className="animate-fade-in space-y-4">
            <div>
              <button type="button" onClick={() => { setStep("password"); setErrorMsg(""); }} className="flex items-center gap-1 text-violet-400 text-sm mb-3 hover:text-violet-300 transition-colors">
                <Icon name="ChevronLeft" size={16} /> Назад
              </button>
              <h2 className="text-xl font-bold mb-1">Восстановление доступа</h2>
              <p className="text-sm text-muted-foreground">Для номера {formatPhone(phone)}. Укажите имя аккаунта и новый пароль — смену нужно будет подтвердить на устройстве, где вы уже вошли.</p>
            </div>
            <div className={`flex items-center gap-3 glass rounded-2xl px-4 py-4 border ${shake ? "border-red-500/50" : "border-white/0 focus-within:border-violet-500/40"} transition-colors`}>
              <Icon name="User" size={18} className="text-muted-foreground" />
              <input
                value={resetName}
                onChange={e => { setResetName(e.target.value); if (errorMsg) setErrorMsg(""); }}
                onFocus={keepVisible}
                name="nova-reset-name"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                enterKeyHint="next"
                maxLength={64}
                data-lpignore="true"
                placeholder="Имя аккаунта"
                className="flex-1 bg-transparent outline-none text-base text-foreground placeholder-muted-foreground font-medium"
              />
            </div>
            <div className={`flex items-center gap-3 glass rounded-2xl px-4 py-4 border ${shake ? "border-red-500/50" : "border-white/0 focus-within:border-violet-500/40"} transition-colors`}>
              <Icon name="Lock" size={18} className="text-muted-foreground" />
              <input
                value={resetPassword}
                onChange={e => { setResetPassword(e.target.value); if (errorMsg) setErrorMsg(""); }}
                onFocus={keepVisible}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                placeholder="Новый пароль (от 6 символов)"
                className="flex-1 bg-transparent outline-none text-base text-foreground placeholder-muted-foreground font-medium"
                type={showPassword ? "text" : "password"}
              />
              <button type="button" {...noBlur} onClick={() => setShowPassword(v => !v)} className="text-muted-foreground hover:text-foreground">
                <Icon name={showPassword ? "EyeOff" : "Eye"} size={18} />
              </button>
            </div>
            {errorMsg && <p className="text-center text-sm text-red-400 animate-fade-in">{errorMsg}</p>}
            <button
              type="submit"
              {...noBlur}
              disabled={loading}
              className="w-full py-4 grad-primary rounded-2xl text-white font-bold text-base glow-primary hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Сохраняем...</>
              ) : (
                <>Запросить смену пароля <Icon name="KeyRound" size={18} /></>
              )}
            </button>
          </form>
        )}

        {step === "waiting" && ticket && (
          <ResetWaiting
            ticket={ticket}
            onDone={onDone}
            onCancel={() => { setTicket(null); setStep("phone"); setErrorMsg(""); }}
          />
        )}

        {/* Name step */}
        {step === "name" && (
          <form onSubmit={submit(handleNameSubmit)} noValidate autoComplete="off" className="animate-fade-in space-y-4">
            <div>
              <button type="button" onClick={() => { setStep("password"); setErrorMsg(""); }} className="flex items-center gap-1 text-violet-400 text-sm mb-3 hover:text-violet-300 transition-colors">
                <Icon name="ChevronLeft" size={16} /> Назад
              </button>
              <h2 className="text-xl font-bold mb-1">Как вас зовут?</h2>
              <p className="text-sm text-muted-foreground">Ваше имя увидят собеседники</p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-3xl font-bold text-white glow-primary">
                {name.trim() ? name.trim()[0].toUpperCase() : "?"}
              </div>
              <div className={`w-full flex items-center gap-3 glass rounded-2xl px-4 py-4 border ${shake ? "border-red-500/50" : "border-white/0 focus-within:border-violet-500/40"} transition-colors`}>
                <Icon name="User" size={18} className="text-muted-foreground" />
                <input
                  id="nova-reg-name"
                  name="nova-display-name"
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); if (errorMsg) setErrorMsg(""); }}
                  onFocus={keepVisible}
                  placeholder="Ваше имя"
                  maxLength={64}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  inputMode="text"
                  enterKeyHint="done"
                  data-lpignore="true"
                  data-form-type="other"
                  aria-label="Ваше имя"
                  className="flex-1 min-w-0 bg-transparent outline-none text-base text-foreground placeholder-muted-foreground"
                />
              </div>
            </div>
            {errorMsg && <p className="text-center text-sm text-red-400 animate-fade-in">{errorMsg}</p>}
            <button
              type="submit"
              {...noBlur}
              disabled={loading}
              className="w-full py-4 grad-primary rounded-2xl text-white font-bold text-base glow-primary hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Создаём аккаунт...</>
              ) : (
                <>Начать общение <Icon name="Sparkles" size={18} /></>
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Нажимая «Начать общение», вы соглашаетесь с{" "}
              <button type="button" onClick={() => setShowPolicy(true)} className="text-violet-400 hover:text-violet-300 underline">
                Политикой конфиденциальности
              </button>
            </p>
          </form>
        )}
      </div>
      </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}