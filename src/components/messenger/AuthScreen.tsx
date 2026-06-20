import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { api, type User, type BeforeInstallPromptEvent } from "@/lib/api";

export function AuthScreen({ onDone }: { onDone: (user: User) => void }) {
  const [step, setStep] = useState<"phone" | "password" | "name">("phone");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    (installPrompt as BeforeInstallPromptEvent).prompt();
    const { outcome } = await (installPrompt as BeforeInstallPromptEvent).userChoice;
    if (outcome === "accepted") setShowInstall(false);
  };

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
    const digits = phone.replace(/\D/g, "");
    if (password.length < 4) { setErrorMsg("Пароль не короче 4 символов"); triggerShake(); return; }
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await api("auth_password", { phone: digits, password });
      if (data.user) {
        onDone(data.user);
      } else if (data.need_name) {
        // Новый пользователь — спрашиваем имя
        setStep("name");
      } else {
        setErrorMsg(data.error || "Ошибка входа");
        triggerShake();
      }
    } catch {
      setErrorMsg("Нет соединения, попробуйте позже");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = async () => {
    if (name.trim().length < 2) { triggerShake(); return; }
    setLoading(true);
    setErrorMsg("");
    try {
      const digits = phone.replace(/\D/g, "");
      const data = await api("auth_password", { phone: digits, password, name: name.trim() });
      if (data.user) {
        onDone(data.user);
      } else {
        setErrorMsg(data.error || "Ошибка регистрации");
        triggerShake();
      }
    } catch {
      setErrorMsg("Нет соединения");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center relative overflow-hidden">
      <div className="mesh-bg" />
      <div className="absolute top-[-10%] right-[-10%] w-80 h-80 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 rounded-full bg-sky-600/15 blur-3xl pointer-events-none" />

      {/* Install banner Android */}
      {showInstall && (
        <div className="fixed bottom-6 left-4 right-4 z-50 glass rounded-2xl p-4 flex items-center gap-3 border border-violet-500/30 shadow-2xl animate-fade-in">
          <div className="w-12 h-12 grad-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <Icon name="Zap" size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Установить Nova</p>
            <p className="text-xs text-muted-foreground">Добавить на главный экран</p>
          </div>
          <button onClick={handleInstall} className="px-4 py-2 grad-primary rounded-xl text-white text-sm font-bold flex-shrink-0">
            Установить
          </button>
          <button onClick={() => setShowInstall(false)} className="p-1 text-muted-foreground hover:text-foreground">
            <Icon name="X" size={16} />
          </button>
        </div>
      )}

      {/* iOS install hint */}
      {!showInstall && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches && (
        <div className="fixed bottom-6 left-4 right-4 z-50 glass rounded-2xl p-4 flex items-center gap-3 border border-white/10 animate-fade-in">
          <div className="w-10 h-10 grad-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <Icon name="Zap" size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Установить Nova</p>
            <p className="text-xs text-muted-foreground">Нажмите <span className="text-violet-400">⬆ Поделиться</span> → «На экран Домой»</p>
          </div>
        </div>
      )}

      <div className={`w-full max-w-sm mx-4 animate-scale-in ${shake ? "animate-[shake_0.4s_ease]" : ""}`}>
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 grad-primary rounded-3xl flex items-center justify-center mx-auto mb-4 glow-primary animate-float">
            <Icon name="Zap" size={36} className="text-white" />
          </div>
          <h1 className="text-4xl font-black grad-text tracking-tight">Nova</h1>
          <p className="text-muted-foreground text-sm mt-1">Социальная сеть для общения</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
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
          <div className="animate-fade-in space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Введите номер телефона</h2>
              <p className="text-sm text-muted-foreground">Ваш уникальный ID в Nova</p>
            </div>
            <div className={`flex items-center gap-3 glass rounded-2xl px-4 py-4 border ${shake ? "border-red-500/50" : "border-white/0 focus-within:border-violet-500/40"} transition-colors`}>
              <span className="text-2xl">🇷🇺</span>
              <input
                autoFocus
                value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                onKeyDown={e => e.key === "Enter" && handlePhoneSubmit()}
                placeholder="+7 (___) ___-__-__"
                className="flex-1 bg-transparent outline-none text-base text-foreground placeholder-muted-foreground font-medium"
                type="tel"
              />
            </div>
            {errorMsg && <p className="text-center text-sm text-red-400 animate-fade-in">{errorMsg}</p>}
            <button
              onClick={handlePhoneSubmit}
              disabled={loading}
              className="w-full py-4 grad-primary rounded-2xl text-white font-bold text-base glow-primary hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Проверяем...</>
              ) : (
                <>Продолжить <Icon name="ArrowRight" size={18} /></>
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Нажимая «Продолжить», вы соглашаетесь с{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">
                Политикой конфиденциальности
              </a>
            </p>
          </div>
        )}

        {/* Password step */}
        {step === "password" && (
          <div className="animate-fade-in space-y-4">
            <div>
              <button onClick={() => { setStep("phone"); setErrorMsg(""); }} className="flex items-center gap-1 text-violet-400 text-sm mb-3 hover:text-violet-300 transition-colors">
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
                onKeyDown={e => e.key === "Enter" && handlePasswordSubmit()}
                placeholder="Пароль"
                className="flex-1 bg-transparent outline-none text-base text-foreground placeholder-muted-foreground font-medium"
                type={showPassword ? "text" : "password"}
              />
              <button onClick={() => setShowPassword(v => !v)} className="text-muted-foreground hover:text-foreground">
                <Icon name={showPassword ? "EyeOff" : "Eye"} size={18} />
              </button>
            </div>
            {errorMsg && <p className="text-center text-sm text-red-400 animate-fade-in">{errorMsg}</p>}
            <button
              onClick={handlePasswordSubmit}
              disabled={loading}
              className="w-full py-4 grad-primary rounded-2xl text-white font-bold text-base glow-primary hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Проверяем...</>
              ) : (
                <>Войти <Icon name="ArrowRight" size={18} /></>
              )}
            </button>
          </div>
        )}

        {/* Name step */}
        {step === "name" && (
          <div className="animate-fade-in space-y-4">
            <div>
              <button onClick={() => { setStep("password"); setErrorMsg(""); }} className="flex items-center gap-1 text-violet-400 text-sm mb-3 hover:text-violet-300 transition-colors">
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
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleNameSubmit()}
                  placeholder="Ваше имя"
                  className="flex-1 bg-transparent outline-none text-base text-foreground placeholder-muted-foreground"
                />
              </div>
            </div>
            {errorMsg && <p className="text-center text-sm text-red-400 animate-fade-in">{errorMsg}</p>}
            <button
              onClick={handleNameSubmit}
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
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">
                Политикой конфиденциальности
              </a>
            </p>
          </div>
        )}
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