import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, type DevAdmin } from "@/lib/devApi";
import DevTelegram, { DevBackup } from "./DevTelegram";
import { Loading, ErrorBox } from "./DevDashboard";
import { TwoFactor, Maintenance, MyProfile, ChangePassword, ChangeEmail } from "./DevSettingsSections";

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

      {editable && <DevTelegram />}

      {editable && <DevBackup />}

      <Maintenance editable={editable} />

      <TwoFactor />

      <MyProfile admin={admin} onChanged={onProfileChanged} />
      <ChangePassword />
      <ChangeEmail currentEmail={admin.email} onChanged={onEmailChanged} />
    </div>
  );
}
