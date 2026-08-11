import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, type DevAdmin } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface Props {
  onSaved: (name: string, subtitle: string, logo: string) => void;
  can: (p: string) => boolean;
  admin: DevAdmin;
  onEmailChanged: (email: string) => void;
}

const PRESETS = [
  { url: "/app-icon-512.png", label: "Логотип Nova" },
  { url: "/rustore-icon-512.png", label: "Иконка RuStore" },
  { url: "/favicon.png", label: "Favicon" },
];

export default function DevSettings({ onSaved, can, admin, onEmailChanged }: Props) {
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [logo, setLogo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    try {
      const res = await devApi<{ settings: Record<string, string> }>("settings_get");
      setName(res.settings.panel_name || "Nova Dev Panel");
      setSubtitle(res.settings.panel_subtitle || "Панель управления мессенджером");
      setLogo(res.settings.panel_logo_url ?? "");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!name.trim()) {
      alert("Название не может быть пустым");
      return;
    }
    setSaving(true);
    try {
      await devApi("settings_save", {
        settings: {
          panel_name: name.trim(),
          panel_subtitle: subtitle.trim(),
          panel_logo_url: logo.trim(),
        },
      });
      onSaved(name.trim(), subtitle.trim(), logo.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  const editable = can("settings");

  return (
    <div className="max-w-xl space-y-5">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
        <h3 className="font-semibold mb-1">Оформление панели</h3>
        <p className="text-xs text-slate-500 mb-4">Название и логотип на входе и в меню</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Название</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!editable}
              maxLength={40}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Подпись под названием</label>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              disabled={!editable}
              maxLength={60}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Логотип</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {PRESETS.map((p) => (
                <button
                  key={p.url}
                  onClick={() => editable && setLogo(p.url)}
                  disabled={!editable}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-xs transition disabled:opacity-50 ${
                    logo === p.url
                      ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                      : "bg-white/[0.03] border-white/8 text-slate-400 hover:bg-white/[0.06]"
                  }`}
                >
                  <img src={p.url} alt="" className="w-6 h-6 rounded-md object-cover" />
                  {p.label}
                </button>
              ))}
            </div>
            <input
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              disabled={!editable}
              placeholder="Или вставьте ссылку на картинку"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50 disabled:opacity-50 placeholder-slate-600"
            />
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-black/30 border border-white/8">
          <div className="text-[10px] text-slate-600 mb-2">Как это выглядит</div>
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0">
                <Icon name="Terminal" size={18} className="text-white" />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{name || "Без названия"}</div>
              <div className="text-[10px] text-slate-500 truncate">{subtitle}</div>
            </div>
          </div>
        </div>

        {editable ? (
          <button
            onClick={save}
            disabled={saving}
            className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Icon name="Loader2" size={16} className="animate-spin" />
                Сохраняем...
              </>
            ) : saved ? (
              <>
                <Icon name="Check" size={16} />
                Сохранено
              </>
            ) : (
              "Сохранить"
            )}
          </button>
        ) : (
          <p className="text-xs text-slate-600 mt-4 text-center">
            Менять оформление может только владелец панели
          </p>
        )}
      </div>

      <ChangePassword />
      <ChangeEmail currentEmail={admin.email} onChanged={onEmailChanged} />
    </div>
  );
}

function ChangePassword() {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    setMsg("");
    if (newPass.length < 8) {
      setErr("Новый пароль должен быть не короче 8 символов");
      return;
    }
    if (newPass !== repeat) {
      setErr("Пароли не совпадают");
      return;
    }
    setBusy(true);
    try {
      await devApi("change_password", { old_password: oldPass, new_password: newPass });
      setMsg("Пароль изменён. На других устройствах вход сброшен.");
      setOldPass("");
      setNewPass("");
      setRepeat("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось изменить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <h3 className="font-semibold mb-1">Смена пароля</h3>
      <p className="text-xs text-slate-500 mb-4">
        После смены на других устройствах потребуется войти заново
      </p>

      <div className="space-y-3">
        <Input value={oldPass} onChange={setOldPass} placeholder="Текущий пароль" type="password" />
        <Input value={newPass} onChange={setNewPass} placeholder="Новый пароль" type="password" />
        <Input value={repeat} onChange={setRepeat} placeholder="Повторите новый пароль" type="password" />
      </div>

      {err && <Note text={err} error />}
      {msg && <Note text={msg} />}

      <button
        onClick={submit}
        disabled={busy || !oldPass || !newPass}
        className="w-full mt-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition disabled:opacity-40"
      >
        {busy ? "Меняем..." : "Изменить пароль"}
      </button>
    </div>
  );
}

function ChangeEmail({ currentEmail, onChanged }: { currentEmail: string; onChanged: (e: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const res = await devApi<{ email: string }>("change_email", {
        password,
        new_email: email.trim(),
      });
      setMsg(`Почта изменена на ${res.email}`);
      onChanged(res.email);
      setEmail("");
      setPassword("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось изменить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <h3 className="font-semibold mb-1">Смена почты</h3>
      <p className="text-xs text-slate-500 mb-4">
        Текущая почта для входа: <span className="text-slate-400">{currentEmail}</span>
      </p>

      <div className="space-y-3">
        <Input value={email} onChange={setEmail} placeholder="Новая почта" type="email" />
        <Input value={password} onChange={setPassword} placeholder="Ваш пароль для подтверждения" type="password" />
      </div>

      {err && <Note text={err} error />}
      {msg && <Note text={msg} />}

      <button
        onClick={submit}
        disabled={busy || !email || !password}
        className="w-full mt-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition disabled:opacity-40"
      >
        {busy ? "Меняем..." : "Изменить почту"}
      </button>
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50 placeholder-slate-600"
    />
  );
}

function Note({ text, error }: { text: string; error?: boolean }) {
  return (
    <div
      className={`mt-3 flex items-start gap-2 text-xs rounded-xl px-3 py-2.5 border ${
        error
          ? "text-red-400 bg-red-500/10 border-red-500/20"
          : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      }`}
    >
      <Icon name={error ? "CircleAlert" : "Check"} size={14} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
