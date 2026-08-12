import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, type DevAdmin } from "@/lib/devApi";
import { UPLOAD_API } from "@/lib/api";
import { Loading, ErrorBox } from "./DevDashboard";

interface Props {
  onSaved: (name: string, subtitle: string, logo: string, bgStyle: string, bgImage: string) => void;
  can: (p: string) => boolean;
  admin: DevAdmin;
  onEmailChanged: (email: string) => void;
  onProfileChanged?: (admin: DevAdmin) => void;
}

const BG_STYLES = [
  { key: "aurora", label: "Свечение", hint: "Фиолетово-бирюзовые пятна и сетка" },
  { key: "gradient", label: "Градиент", hint: "Плавный переход цветов" },
  { key: "grid", label: "Сетка", hint: "Строгая техническая сетка" },
  { key: "plain", label: "Без фона", hint: "Чистый тёмный" },
];

const PRESETS = [
  { url: "/app-icon-512.png", label: "Логотип Nova" },
  { url: "/rustore-icon-512.png", label: "Иконка RuStore" },
  { url: "/favicon.png", label: "Favicon" },
];

export default function DevSettings({ onSaved, can, admin, onEmailChanged, onProfileChanged }: Props) {
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [logo, setLogo] = useState("");
  const [bgStyle, setBgStyle] = useState("aurora");
  const [bgImage, setBgImage] = useState("");
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
      setBgStyle(res.settings.panel_bg_style || "aurora");
      setBgImage(res.settings.panel_bg_image ?? "");
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
          panel_bg_style: bgStyle,
          panel_bg_image: bgImage.trim(),
        },
      });
      onSaved(name.trim(), subtitle.trim(), logo.trim(), bgStyle, bgImage.trim());
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

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Фон панели</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {BG_STYLES.map((b) => (
                <button
                  key={b.key}
                  onClick={() => editable && setBgStyle(b.key)}
                  disabled={!editable}
                  className={`text-left px-3 py-2.5 rounded-xl border text-xs transition disabled:opacity-50 ${
                    bgStyle === b.key && !bgImage
                      ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                      : "bg-white/[0.03] border-white/8 text-slate-400 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="font-medium">{b.label}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">{b.hint}</div>
                </button>
              ))}
            </div>
            <input
              value={bgImage}
              onChange={(e) => setBgImage(e.target.value)}
              disabled={!editable}
              placeholder="Или ссылка на картинку для фона"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50 disabled:opacity-50 placeholder-slate-600"
            />
            {bgImage && (
              <button
                onClick={() => setBgImage("")}
                disabled={!editable}
                className="mt-2 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50"
              >
                Убрать картинку и вернуть стиль
              </button>
            )}
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

      <MyProfile admin={admin} onChanged={onProfileChanged} />
      <ChangePassword />
      <ChangeEmail currentEmail={admin.email} onChanged={onEmailChanged} />
    </div>
  );
}

function MyProfile({ admin, onChanged }: { admin: DevAdmin; onChanged?: (a: DevAdmin) => void }) {
  const [name, setName] = useState(admin.name || "");
  const [avatar, setAvatar] = useState(admin.avatar_url || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErr("Нужен файл изображения");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      // Уменьшаем снимок до 512px — грузится быстро и не упирается в лимит
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const size = 512;
            const scale = Math.min(size / img.width, size / img.height, 1);
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Не удалось обработать изображение"));
              return;
            }
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          };
          img.onerror = () => reject(new Error("Не удалось прочитать изображение"));
          img.src = String(reader.result || "");
        };
        reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
        reader.readAsDataURL(file);
      });

      const res = await fetch(UPLOAD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": "0" },
        body: JSON.stringify({
          data: url.split(",")[1],
          mime: "image/jpeg",
          file_name: `admin_${Date.now()}.jpg`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        setAvatar(data.url);
      } else {
        setErr(data.error || "Не удалось загрузить фото");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось загрузить фото");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const res = await devApi<{ admin: DevAdmin }>("update_me", {
        name: name.trim(),
        avatar_url: avatar,
      });
      onChanged?.(res.admin);
      setMsg("Профиль сохранён");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <h3 className="font-semibold mb-1">Мой профиль</h3>
      <p className="text-xs text-slate-500 mb-4">Фото и имя, которые видны в панели</p>

      <div className="flex items-center gap-4 mb-4">
        {avatar ? (
          <img src={avatar} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-xl font-bold shrink-0">
            {(name || admin.email).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition disabled:opacity-50"
          >
            {busy ? "Загружаем..." : "Загрузить фото"}
          </button>
          {avatar && (
            <button
              onClick={() => setAvatar("")}
              className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 hover:bg-white/10 transition"
            >
              Убрать фото
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block">Имя</label>
          <Input value={name} onChange={setName} placeholder="Ваше имя" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block">Или ссылка на фото</label>
          <Input value={avatar.startsWith("data:") ? "" : avatar} onChange={setAvatar} placeholder="https://..." />
        </div>
      </div>

      {err && <Note text={err} error />}
      {msg && <Note text={msg} />}

      <button
        onClick={save}
        disabled={busy}
        className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "Сохраняем..." : "Сохранить профиль"}
      </button>
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
