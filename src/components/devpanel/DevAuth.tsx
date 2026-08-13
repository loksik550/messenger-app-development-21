import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, setDevToken, type DevAdmin } from "@/lib/devApi";

interface Props {
  onSuccess: (admin: DevAdmin) => void;
}

export default function DevAuth({ onSuccess }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [brand, setBrand] = useState({
    name: "Nova Dev Panel",
    subtitle: "Панель управления мессенджером",
    logo_url: "/app-icon-512.png",
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [phoneHint, setPhoneHint] = useState("");

  useEffect(() => {
    devApi<{ name: string; subtitle: string; logo_url: string }>("panel_info")
      .then((r) => setBrand({ name: r.name, subtitle: r.subtitle, logo_url: r.logo_url }))
      .catch(() => undefined);
  }, []);

  const submit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Заполните почту и пароль");
      return;
    }
    if (needCode && code.trim().length < 4) {
      setError("Введите код из SMS");
      return;
    }
    if (mode === "register" && !invite.trim()) {
      setError("Нужен код-приглашение");
      return;
    }
    setLoading(true);
    try {
      const payload =
        mode === "login"
          ? { email: email.trim(), password, code: code.trim() }
          : { email: email.trim(), password, name: name.trim(), invite_code: invite.trim() };
      const data = await devApi<{
        token: string; admin: DevAdmin; need_code?: boolean; phone_hint?: string;
      }>(mode, payload);

      // Включена защита входа — сначала просим код из SMS
      if (data.need_code) {
        setNeedCode(true);
        setPhoneHint(data.phone_hint || "");
        return;
      }
      setDevToken(data.token);
      onSuccess(data.admin);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="flex flex-col items-center mb-8">
          {brand.logo_url ? (
            <img
              src={brand.logo_url}
              alt=""
              className="w-16 h-16 rounded-2xl object-cover mb-4 shadow-lg shadow-violet-900/40"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center mb-4 shadow-lg shadow-violet-900/40">
              <Icon name="Terminal" size={30} className="text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-center">{brand.name}</h1>
          <p className="text-sm text-slate-400 mt-1 text-center">{brand.subtitle}</p>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex gap-1 p-1 bg-black/30 rounded-xl mb-5">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  mode === m
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {m === "login" ? "Вход" : "Регистрация"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <Field
                icon="User"
                placeholder="Ваше имя"
                value={name}
                onChange={setName}
                onEnter={submit}
              />
            )}

            <Field
              icon="Mail"
              placeholder="Электронная почта"
              value={email}
              onChange={setEmail}
              onEnter={submit}
              type="email"
            />

            <div className="relative">
              <Field
                icon="Lock"
                placeholder="Пароль"
                value={password}
                onChange={setPassword}
                onEnter={submit}
                type={showPass ? "text" : "password"}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
              >
                <Icon name={showPass ? "EyeOff" : "Eye"} size={16} />
              </button>
            </div>

            {needCode && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-xs text-violet-300 bg-violet-500/10 border border-violet-500/25 rounded-xl px-3 py-2.5">
                  <Icon name="ShieldCheck" size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Код отправлен по SMS{phoneHint ? ` на номер ${phoneHint}` : ""}. Действует 5 минут.
                  </span>
                </div>
                <Field
                  icon="KeyRound"
                  placeholder="Код из SMS"
                  value={code}
                  onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                  onEnter={submit}
                />
              </div>
            )}

            {mode === "register" && (
              <Field
                icon="KeyRound"
                placeholder="Код-приглашение"
                value={invite}
                onChange={(v) => setInvite(v.toUpperCase())}
                onEnter={submit}
              />
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold shadow-lg shadow-violet-900/30 hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Icon name="Loader2" size={18} className="animate-spin" />
                Проверяем...
              </>
            ) : (
              <>
                {needCode ? "Подтвердить вход" : mode === "login" ? "Войти в панель" : "Создать аккаунт"}
                <Icon name="ArrowRight" size={18} />
              </>
            )}
          </button>

          {mode === "register" && (
            <p className="text-xs text-slate-500 text-center mt-4 leading-relaxed">
              Регистрация возможна только по коду-приглашению.
              Пароль — не короче 8 символов.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Закрытая зона. Все действия фиксируются в журнале.
        </p>
      </div>
    </div>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChange,
  onEnter,
  type = "text",
}: {
  icon: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  type?: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-black/30 border border-white/10 rounded-xl px-3.5 py-3 focus-within:border-violet-500/50 transition">
      <Icon name={icon} size={16} className="text-slate-500 shrink-0" />
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter()}
        className="flex-1 bg-transparent outline-none text-sm placeholder-slate-600 text-slate-100"
      />
    </div>
  );
}