import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface Props {
  onSaved: (name: string, subtitle: string) => void;
  can: (p: string) => boolean;
}

export default function DevSettings({ onSaved, can }: Props) {
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    try {
      const res = await devApi<{ settings: Record<string, string> }>("settings_get");
      setName(res.settings.panel_name || "Nova Dev Panel");
      setSubtitle(res.settings.panel_subtitle || "Панель управления мессенджером");
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
        settings: { panel_name: name.trim(), panel_subtitle: subtitle.trim() },
      });
      onSaved(name.trim(), subtitle.trim());
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
        <h3 className="font-semibold mb-1">Название панели</h3>
        <p className="text-xs text-slate-500 mb-4">
          Отображается на экране входа и в боковом меню
        </p>

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
        </div>

        <div className="mt-4 p-4 rounded-xl bg-black/30 border border-white/8">
          <div className="text-[10px] text-slate-600 mb-2">Как это выглядит</div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0">
              <Icon name="Terminal" size={18} className="text-white" />
            </div>
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
            Менять название может только владелец панели
          </p>
        )}
      </div>
    </div>
  );
}
