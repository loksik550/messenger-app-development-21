import { useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";

const SNOOZE_KEY = "nova_vk_phone_snooze";

function formatPhone(val: string) {
  let digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits && digits[0] === "8") digits = "7" + digits.slice(1);
  if (digits && digits[0] !== "7") digits = ("7" + digits).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 1) return "+7";
  if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
  if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
  if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

export default function VkPhonePrompt({ user, onUpdated }: { user: User; onUpdated: (u: User) => void }) {
  const [hidden, setHidden] = useState(() => {
    const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return until > Date.now();
  });
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!String(user.phone || "").startsWith("vk") || hidden) return null;

  const later = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setHidden(true);
  };

  const save = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11) { setError("Введите номер полностью"); return; }
    if (password.length < 6) { setError("Пароль — минимум 6 символов"); return; }
    setBusy(true);
    setError("");
    const r = await api("vk_set_phone", { phone: digits, password }, user.id).catch(() => null);
    setBusy(false);
    if (r?.user) {
      localStorage.removeItem(SNOOZE_KEY);
      setDone(true);
      setTimeout(() => onUpdated(r.user), 1800);
    } else {
      setError(r?.error || "Нет связи с сервером Nova");
    }
  };

  return (
    <div className="fixed inset-0 z-[390] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-fade-in">
      <div className="glass-strong rounded-3xl p-5 w-full max-w-sm animate-scale-in">
        {done ? (
          <div className="text-center py-4">
            <Icon name="CircleCheck" size={48} className="text-emerald-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-1">Готово!</h3>
            <p className="text-sm text-muted-foreground">Теперь можно входить и по номеру с паролем, и через ВКонтакте.</p>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-[#0077FF]/15 text-[#4d9fff] flex items-center justify-center mx-auto mb-3">
              <Icon name="Smartphone" size={28} />
            </div>
            <h3 className="text-lg font-bold text-center mb-1">Добавьте номер и пароль</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Сейчас вы входите только через ВКонтакте. Укажите номер и придумайте пароль — так вы не потеряете доступ, даже если что-то случится с ВК.
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 glass rounded-2xl px-4 py-3 border border-white/0 focus-within:border-violet-500/40">
                <span className="text-xl">🇷🇺</span>
                <input
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="+7 (___) ___-__-__"
                  type="tel"
                  className="flex-1 bg-transparent outline-none text-base text-foreground placeholder-muted-foreground font-medium"
                />
              </div>
              <div className="flex items-center gap-3 glass rounded-2xl px-4 py-3 border border-white/0 focus-within:border-violet-500/40">
                <Icon name="Lock" size={18} className="text-muted-foreground" />
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && save()}
                  placeholder="Придумайте пароль"
                  type={showPassword ? "text" : "password"}
                  className="flex-1 bg-transparent outline-none text-base text-foreground placeholder-muted-foreground font-medium"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="text-muted-foreground hover:text-foreground">
                  <Icon name={showPassword ? "EyeOff" : "Eye"} size={18} />
                </button>
              </div>
              {error && <p className="text-center text-sm text-red-400">{error}</p>}
              <button
                onClick={save}
                disabled={busy}
                className="w-full py-3 rounded-2xl grad-primary text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Сохраняем…</> : "Сохранить"}
              </button>
              <button onClick={later} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground">
                Напомнить завтра
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
