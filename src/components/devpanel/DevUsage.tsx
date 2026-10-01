import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface UsageData {
  days: number;
  dau: { day: string; users: number }[];
  wau: number;
  mau: number;
  dau_today: number;
  features: { feature: string; uses: number; users: number }[];
  calls: { total: number; answered: number; missed: number; minutes: number; video: number };
  referrals: number;
}

const FEATURE_NAMES: Record<string, string> = {
  msg_text: "Текстовые сообщения",
  msg_group: "Сообщения в группах",
  msg_voice: "Голосовые",
  msg_photo: "Фото",
  msg_video: "Видео",
  msg_file: "Файлы",
  msg_offline: "Отправка без интернета",
  call_audio: "Аудиозвонки",
  call_video: "Видеозвонки",
  call_history_open: "Журнал звонков",
  favorites_open: "Избранное (открытие)",
  favorite_add: "Добавление в избранное",
  invite_open: "Экран приглашений",
  invite_share: "Поделились приглашением",
  invite_copy: "Скопировали ссылку",
  invite_applied: "Пришли по приглашению",
  contacts_sync: "Синхронизация контактов",
  notif_reply: "Ответ из уведомления",
  draft_restored: "Вернулись к черновику",
  app_open: "Запуск приложения",
};

function featureName(key: string) {
  return FEATURE_NAMES[key] || key;
}

function Stat({ label, value, hint, icon, color }: { label: string; value: string | number; hint?: string; icon: string; color: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon name={icon} size={14} className="text-white" />
        </div>
        {label}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export default function DevUsage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (d: number) => {
    setLoading(true);
    devApi<UsageData>("usage_stats", { days: d })
      .then((r) => { setData(r); setError(""); })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(days); }, [days]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={() => load(days)} />;
  if (!data) return null;

  const max = Math.max(1, ...data.dau.map((d) => d.users));
  const maxUses = Math.max(1, ...data.features.map((f) => f.uses));
  const stick = data.mau ? Math.round((data.dau_today / data.mau) * 100) : 0;
  const answerRate = data.calls.total ? Math.round((data.calls.answered / data.calls.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-500">Период:</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-xl text-xs border transition ${
              days === d
                ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                : "bg-white/[0.03] border-white/8 text-slate-400 hover:bg-white/[0.06]"
            }`}
          >
            {d} дней
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Сегодня в приложении" value={formatNum(data.dau_today)} icon="Users" color="from-violet-500 to-purple-600" />
        <Stat label="За 7 дней" value={formatNum(data.wau)} icon="CalendarDays" color="from-sky-500 to-blue-600" />
        <Stat label="За 30 дней" value={formatNum(data.mau)} icon="CalendarRange" color="from-emerald-500 to-teal-600" />
        <Stat label="Возвращаются ежедневно" value={`${stick}%`} hint="Сегодня / за 30 дней" icon="Repeat" color="from-amber-500 to-orange-600" />
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
        <div className="text-sm font-semibold text-white mb-1">Сколько людей заходит каждый день</div>
        <div className="text-xs text-slate-500 mb-4">Считаем с момента обновления приложения — раньше этих данных не было</div>
        <div className="flex items-end gap-[3px] h-36">
          {data.dau.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center justify-end group relative h-full">
              <div
                className="w-full rounded-t bg-gradient-to-t from-violet-600 to-violet-400 min-h-[2px] transition-all"
                style={{ height: `${(d.users / max) * 100}%` }}
              />
              <div className="absolute bottom-full mb-1 hidden group-hover:block whitespace-nowrap text-[10px] px-2 py-1 rounded bg-black/80 text-white z-10">
                {new Date(d.day).toLocaleDateString("ru", { day: "numeric", month: "short" })}: {d.users}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-2">
          <span>{data.dau[0] && new Date(data.dau[0].day).toLocaleDateString("ru", { day: "numeric", month: "short" })}</span>
          <span>сегодня</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
          <div className="text-sm font-semibold text-white mb-3">Популярные функции</div>
          {data.features.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">Данные появятся, когда пользователи обновят приложение</div>
          ) : (
            <div className="space-y-2.5">
              {data.features.map((f) => (
                <div key={f.feature}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{featureName(f.feature)}</span>
                    <span className="text-slate-500">{formatNum(f.uses)} раз · {formatNum(f.users)} чел.</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-500" style={{ width: `${(f.uses / maxUses) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
            <div className="text-sm font-semibold text-white mb-3">Звонки за период</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-slate-500 text-xs">Всего</div><div className="text-white font-bold text-lg">{formatNum(data.calls.total)}</div></div>
              <div><div className="text-slate-500 text-xs">Отвечено</div><div className="text-emerald-400 font-bold text-lg">{answerRate}%</div></div>
              <div><div className="text-slate-500 text-xs">Пропущено</div><div className="text-red-400 font-bold text-lg">{formatNum(data.calls.missed)}</div></div>
              <div><div className="text-slate-500 text-xs">Минут разговоров</div><div className="text-white font-bold text-lg">{formatNum(data.calls.minutes)}</div></div>
              <div><div className="text-slate-500 text-xs">Видеозвонков</div><div className="text-white font-bold text-lg">{formatNum(data.calls.video)}</div></div>
            </div>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-pink-500 flex items-center justify-center">
              <Icon name="Gift" size={18} className="text-white" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Пришли по приглашению</div>
              <div className="text-white font-bold text-lg">{formatNum(data.referrals)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
