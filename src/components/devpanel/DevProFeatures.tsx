import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";

interface ProFeaturesData {
  file_limit_free_mb: number;
  file_limit_pro_mb: number;
  usage: { incognito: number; emoji_status: number; name_color: number };
}

const FEATURES: { icon: string; color: string; title: string; text: string; usageKey?: keyof ProFeaturesData["usage"] }[] = [
  { icon: "BadgeCheck", color: "#8b5cf6", title: "Значок Pro", text: "Рядом с именем в чатах, профиле, группах и поиске" },
  { icon: "Smile", color: "#ec4899", title: "Эмодзи-статус", text: "Виден всем рядом с именем", usageKey: "emoji_status" },
  { icon: "Brush", color: "#6366f1", title: "Цветной ник", text: "Имя выбранного цвета у всех собеседников", usageKey: "name_color" },
  { icon: "EyeOff", color: "#3b82f6", title: "Инкогнито", text: "Скрывает время в сети ото всех", usageKey: "incognito" },
  { icon: "Palette", color: "#f59e0b", title: "Эксклюзивные темы", text: "Океан, Закат, Лес, Роза" },
  { icon: "FileUp", color: "#10b981", title: "Большие файлы", text: "Увеличенный лимит на размер файла" },
];

const fmt = (mb: number) => (mb >= 1024 ? `${+(mb / 1024).toFixed(1)} ГБ` : `${mb} МБ`);

export default function DevProFeatures({ editable }: { editable: boolean }) {
  const [data, setData] = useState<ProFeaturesData | null>(null);
  const [free, setFree] = useState("");
  const [pro, setPro] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    try {
      const d = await devApi<ProFeaturesData>("pro_features");
      setData(d);
      setFree(String(d.file_limit_free_mb));
      setPro(String(d.file_limit_pro_mb));
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Ошибка загрузки" });
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await devApi("pro_features_save", { file_limit_free_mb: Number(free), file_limit_pro_mb: Number(pro) });
      setMsg({ ok: true, text: "Сохранено — применяется в мессенджере в течение 5 минут" });
      load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Не удалось сохранить" });
    } finally {
      setBusy(false);
    }
  };

  const changed = data && (Number(free) !== data.file_limit_free_mb || Number(pro) !== data.file_limit_pro_mb);

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}>
          <Icon name="Zap" size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-bold">Возможности Nova Pro</h3>
          <p className="text-xs text-slate-500">Что реально получает подписчик — работает во всех тарифах Pro</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex items-start gap-3 rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: f.color }}>
              <Icon name={f.icon} fallback="Circle" size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold flex items-center gap-1.5">
                {f.title}
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">работает</span>
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">{f.text}</div>
              {f.usageKey && data && (
                <div className="text-[11px] text-violet-300 mt-0.5">Используют: {formatNum(data.usage[f.usageKey])}</div>
              )}
              {f.title === "Большие файлы" && data && (
                <div className="text-[11px] text-violet-300 mt-0.5">
                  Без Pro {fmt(data.file_limit_free_mb)} · с Pro {fmt(data.file_limit_pro_mb)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-black/20 border border-white/10 p-4">
        <div className="text-sm font-semibold mb-1">Лимит размера одного файла</div>
        <p className="text-[11px] text-slate-500 mb-3">
          Для фото, видео, голосовых и документов в чатах и группах. Максимум — 2048 МБ.
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">Без подписки, МБ</span>
            <input
              value={free}
              onChange={(e) => setFree(e.target.value.replace(/\D/g, ""))}
              disabled={!editable}
              inputMode="numeric"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">С Nova Pro, МБ</span>
            <input
              value={pro}
              onChange={(e) => setPro(e.target.value.replace(/\D/g, ""))}
              disabled={!editable}
              inputMode="numeric"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 disabled:opacity-60"
            />
          </label>
        </div>
        {editable && (
          <button
            onClick={save}
            disabled={busy || !changed}
            className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-40"
          >
            {busy ? "Сохраняем..." : "Сохранить лимиты"}
          </button>
        )}
        {msg && (
          <p className={`text-xs mt-2 ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>
        )}
      </div>
    </div>
  );
}
