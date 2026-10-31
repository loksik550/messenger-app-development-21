import { useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { filterNameInput, nameError } from "@/lib/nameRules";

function leftText(deadline: number, now: number) {
  const sec = Math.max(0, deadline - Math.floor(now / 1000));
  const h = Math.floor(sec / 3600);
  if (h >= 1) return `${h} ч`;
  return `${Math.max(1, Math.floor(sec / 60))} мин`;
}

export default function NameFixPrompt({ user, onUpdated }: { user: User; onUpdated: (u: User) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deadline = user.name_fix_deadline;
  if (!deadline) return null;

  const save = async () => {
    const e = nameError(name);
    if (e) { setError(e); return; }
    setBusy(true);
    setError("");
    const r = await api("update_profile", { name: name.trim() }, user.id).catch(() => null);
    setBusy(false);
    if (r?.user) onUpdated({ ...r.user, name_fix_deadline: null });
    else setError(r?.error || "Нет связи с сервером Nova");
  };

  return (
    <div className="fixed inset-0 z-[395] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-fade-in">
      <div className="glass-strong rounded-3xl p-5 w-full max-w-sm animate-scale-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-3">
          <Icon name="UserPen" fallback="User" size={28} />
        </div>
        <h3 className="text-lg font-bold text-center mb-1">Укажите настоящее имя</h3>
        <p className="text-sm text-muted-foreground text-center mb-1">
          Сейчас ваше имя — «{user.name}». По правилам Nova имя может состоять только из букв — без точек, тире, цифр и нецензурных слов.
        </p>
        <p className="text-sm text-amber-300 text-center mb-4">
          Если не сменить имя, аккаунт будет удалён через {leftText(deadline, Date.now())}.
        </p>
        <div className="flex items-center gap-3 glass rounded-2xl px-4 py-3 border border-white/0 focus-within:border-violet-500/40">
          <Icon name="User" size={18} className="text-muted-foreground" />
          <input
            value={name}
            onChange={(e) => { setName(filterNameInput(e.target.value)); if (error) setError(""); }}
            placeholder="Ваше имя"
            maxLength={40}
            autoCapitalize="words"
            className="flex-1 min-w-0 bg-transparent outline-none text-base text-foreground placeholder-muted-foreground"
          />
        </div>
        {error && <p className="text-sm text-red-400 text-center mt-2">{error}</p>}
        <button
          onClick={save}
          disabled={busy}
          className="w-full mt-4 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-50"
        >
          {busy ? "Сохраняю..." : "Сохранить имя"}
        </button>
      </div>
    </div>
  );
}
