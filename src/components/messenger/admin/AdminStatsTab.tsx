import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import {
  Stats,
  LOAD_BG,
  LOAD_COLOR,
  LOAD_LABEL,
  adminApi,
  type ActivityDay,
} from "./AdminAPI";

const ACCENT_BG: Record<string, string> = {
  violet: "bg-violet-500/10 border-violet-500/20 text-violet-200",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
  amber: "bg-amber-500/10 border-amber-500/20 text-amber-200",
};

export function DevStat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  const cls = accent ? ACCENT_BG[accent] : "glass";
  return (
    <div className={`rounded-xl p-2.5 text-center border border-white/5 ${cls}`}>
      <div className="text-base font-bold leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

export function DevRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between gap-2 py-1 border-b border-white/5 last:border-b-0">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      <span className="font-mono text-right break-all">{value}</span>
    </div>
  );
}

interface AdminStatsTabProps {
  stats: Stats | null;
  token?: string;
  // nuke
  confirmNuke: boolean;
  setConfirmNuke: (v: boolean) => void;
  nuking: boolean;
  nukeResult: string | null;
  onNukeAll: () => void;
  // clear users
  confirmClear: boolean;
  setConfirmClear: (v: boolean) => void;
  clearing: boolean;
  clearResult: string | null;
  onClearTestData: () => void;
  // clear messages
  confirmClearMsgs: boolean;
  setConfirmClearMsgs: (v: boolean) => void;
  clearingMsgs: boolean;
  clearMsgsResult: string | null;
  onClearAllMessages: () => void;
}

export function AdminStatsTab({
  stats,
  token,
  confirmNuke,
  setConfirmNuke,
  nuking,
  nukeResult,
  onNukeAll,
  confirmClear,
  setConfirmClear,
  clearing,
  clearResult,
  onClearTestData,
  confirmClearMsgs,
  setConfirmClearMsgs,
  clearingMsgs,
  clearMsgsResult,
  onClearAllMessages,
}: AdminStatsTabProps) {
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  useEffect(() => {
    if (!token) return;
    adminApi("activity_chart", { days: 30 }, token).then(r => {
      const days = (r as { days?: ActivityDay[] }).days;
      if (Array.isArray(days)) setActivity(days);
    });
  }, [token]);

  // Рассылка всем пользователям
  const [bcText, setBcText] = useState("");
  const [bcSending, setBcSending] = useState(false);
  const [bcResult, setBcResult] = useState<string | null>(null);
  const [bcConfirm, setBcConfirm] = useState(false);

  const sendBroadcast = async () => {
    if (!token || !bcText.trim()) return;
    setBcSending(true);
    setBcResult(null);
    const r = await adminApi("broadcast", { text: bcText.trim() }, token) as { sent?: number; error?: string };
    setBcSending(false);
    setBcConfirm(false);
    if (r.error) { setBcResult("Ошибка: " + r.error); return; }
    setBcResult(`Отправлено ${r.sent ?? 0} пользователям`);
    setBcText("");
  };

  if (!stats) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="glass rounded-2xl p-5 h-24 animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}
        </div>
        <div className="glass rounded-2xl h-40 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Рассылка всем пользователям */}
      <div className="glass rounded-2xl p-4 border border-violet-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="Megaphone" size={16} className="text-violet-400" />
          <span className="font-bold text-sm">Рассылка всем</span>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">
          Сообщение придёт всем пользователям в чат от «Nova Dev» и пуш-уведомлением.
        </p>
        <textarea
          value={bcText}
          onChange={e => setBcText(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Например: Вышло обновление Nova 1.1 — реакции и поиск в группах!"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500/40 resize-none mb-2"
        />
        {bcResult && (
          <p className={`text-xs mb-2 ${bcResult.startsWith("Ошибка") ? "text-red-400" : "text-emerald-400"}`}>{bcResult}</p>
        )}
        {!bcConfirm ? (
          <button
            onClick={() => setBcConfirm(true)}
            disabled={!bcText.trim()}
            className="w-full py-2.5 grad-primary rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Icon name="Send" size={15} />
            Отправить всем
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setBcConfirm(false)}
              className="flex-1 py-2.5 glass rounded-xl text-sm font-medium hover:bg-white/10"
            >
              Отмена
            </button>
            <button
              onClick={sendBroadcast}
              disabled={bcSending}
              className="flex-1 py-2.5 bg-red-500/20 text-red-300 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-500/30 disabled:opacity-50"
            >
              {bcSending
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Icon name="Check" size={15} />}
              Точно отправить?
            </button>
          </div>
        )}
      </div>

      {/* Новые фичи */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-sm">🚀 Активные фичи</span>
          <span className="text-[10px] text-emerald-400 font-bold">12 LIVE · 2 BETA</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {[
            { name: "Группы и каналы", status: "live" },
            { name: "Тех.поддержка", status: "live" },
            { name: "Темы оформления", status: "live" },
            { name: "PIN-код входа", status: "live" },
            { name: "Избранное", status: "new" },
            { name: "Счета и платежи", status: "new" },
            { name: "Уведомления", status: "live" },
            { name: "Bot API", status: "beta" },
            { name: "Стикеры", status: "live" },
            { name: "Истории 24ч", status: "live" },
            { name: "Аудио/видео звонки", status: "live" },
            { name: "Исчезающие сообщения", status: "live" },
            { name: "Закреп в группах", status: "new" },
            { name: "Только админы пишут", status: "new" },
          ].map(f => (
            <div key={f.name} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5">
              <span className={`w-1.5 h-1.5 rounded-full ${f.status === "live" ? "bg-emerald-400" : f.status === "new" ? "bg-violet-400" : "bg-amber-400"}`} />
              <span className="truncate flex-1">{f.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Load card */}
      <div className={`rounded-2xl border p-4 ${LOAD_BG[stats.load.level] || LOAD_BG.low}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-sm">Текущая нагрузка</span>
          <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${LOAD_COLOR[stats.load.level] || LOAD_COLOR.low} bg-white/5`}>
            {LOAD_LABEL[stats.load.level] || stats.load.level}
          </span>
        </div>
        <p className={`text-2xl font-black mb-1 ${LOAD_COLOR[stats.load.level] || LOAD_COLOR.low}`}>
          {stats.load.msg_per_min} сообщ/мин
        </p>
        <p className="text-xs text-muted-foreground">{stats.load.tip}</p>
      </div>

      {/* Users */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Всего", value: stats.users.total, icon: "Users", color: "text-violet-400" },
          { label: "Онлайн", value: stats.users.online, icon: "Wifi", color: "text-emerald-400" },
          { label: "За 24ч", value: stats.users.new_24h, icon: "UserPlus", color: "text-sky-400" },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-3 text-center">
            <Icon name={s.icon as string} size={18} className={`mx-auto mb-1 ${s.color}`} />
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* DAU / WAU / MAU */}
      {(stats.users.dau !== undefined) && (
        <div className="glass rounded-2xl p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Icon name="Activity" size={15} className="text-violet-400" />
            Активная аудитория
          </h3>
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-2.5 text-center">
              <p className="text-lg font-black text-violet-300">{stats.users.dau || 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase">DAU</p>
            </div>
            <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 p-2.5 text-center">
              <p className="text-lg font-black text-sky-300">{stats.users.wau || 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase">WAU</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-center">
              <p className="text-lg font-black text-emerald-300">{stats.users.mau || 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase">MAU</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-center">
              <p className="text-lg font-black text-amber-300">{stats.users.stickiness || 0}%</p>
              <p className="text-[10px] text-muted-foreground uppercase">Stick.</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Stickiness = DAU/MAU. Хороший показатель: больше 20%.
          </p>
        </div>
      )}

      {/* График активности за 30 дней */}
      {activity.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Icon name="ChartLine" size={15} className="text-sky-400" />
            Активность за 30 дней
          </h3>
          {(() => {
            const maxActive = Math.max(1, ...activity.map(d => d.active));
            const maxMsgs = Math.max(1, ...activity.map(d => d.messages));
            return (
              <>
                <div className="flex items-end gap-0.5 h-24 mb-2">
                  {activity.map(d => (
                    <div key={d.date} className="flex-1 flex flex-col justify-end gap-px relative group">
                      <div
                        className="w-full bg-sky-400/40 rounded-t-sm"
                        style={{ height: `${(d.messages / maxMsgs) * 60}%` }}
                        title={`${d.date}: ${d.messages} сообщ.`}
                      />
                      <div
                        className="w-full bg-violet-400 rounded-t-sm"
                        style={{ height: `${(d.active / maxActive) * 40}%` }}
                        title={`${d.date}: ${d.active} активных`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{activity[0]?.date}</span>
                  <span className="flex gap-3">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-400" />активные</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-400/40" />сообщения</span>
                  </span>
                  <span>{activity[activity.length - 1]?.date}</span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Messages */}
      <div className="glass rounded-2xl p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Icon name="MessageCircle" size={15} className="text-violet-400" /> Сообщения</h3>
        <div className="space-y-2">
          {[
            { label: "Всего", value: stats.messages.total },
            { label: "За последний час", value: stats.messages.last_1h },
            { label: "За 24 часа", value: stats.messages.last_24h },
            { label: "Звонков за час", value: stats.calls_1h },
            { label: "Push подписок", value: stats.push_subs },
            { label: "Чатов", value: stats.chats },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
              <span className="text-sm text-muted-foreground">{r.label}</span>
              <span className="font-bold text-sm">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="glass rounded-2xl p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Icon name="Lightbulb" size={15} className="text-amber-400" /> Рекомендации</h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          {stats.users.total > 1000 && <p>• Рассмотри горизонтальное масштабирование функций</p>}
          {stats.messages.last_24h > 10000 && <p>• Добавь индексы на messages.created_at и messages.chat_id</p>}
          {stats.push_subs > 500 && <p>• Push очередь: отправляй уведомления асинхронно</p>}
          {stats.load.level === "low" && <p>• Всё отлично! Нагрузка минимальна, ресурсы используются эффективно.</p>}
          {stats.load.level === "medium" && <p>• Следи за ростом. При увеличении нагрузки в 2× — время масштабироваться.</p>}
          {stats.load.level === "high" && <p>• Срочно: добавь кэш Redis или увеличь timeout функций.</p>}
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
        <h3 className="font-bold text-sm mb-1 flex items-center gap-2 text-red-400">
          <Icon name="TriangleAlert" size={15} /> Опасная зона
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Очистит имена, аватары, телефоны и last_seen у всех пользователей. Аккаунты не удаляются — но при следующем входе по номеру создадутся как новые.
        </p>
        {/* ☢️ Ядерная кнопка — снести всё */}
        <div className="mb-3 pb-3 border-b border-red-500/20">
          {nukeResult && (
            <div className="text-xs px-3 py-2 mb-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {nukeResult}
            </div>
          )}
          {!confirmNuke ? (
            <button
              onClick={() => setConfirmNuke(true)}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white rounded-xl py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/30"
            >
              <Icon name="Bomb" size={16} fallback="TriangleAlert" /> Снести всё одной кнопкой
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-red-300">
                ☢️ Снесёт ВСЁ: пользователей, сообщения, чаты, реакции. Точно?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onNukeAll}
                  disabled={nuking}
                  className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                  {nuking ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Сношу...</>
                  ) : (
                    <>Да, снести всё</>
                  )}
                </button>
                <button
                  onClick={() => setConfirmNuke(false)}
                  disabled={nuking}
                  className="px-4 glass rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>

        {clearResult && (
          <div className="text-xs px-3 py-2 mb-3 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            {clearResult}
          </div>
        )}
        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            className="w-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="Eraser" size={15} /> Очистить пользователей
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-red-300">Точно? Действие необратимо.</p>
            <div className="flex gap-2">
              <button
                onClick={onClearTestData}
                disabled={clearing}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                {clearing ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Очищаю...</>
                ) : (
                  <>Да, обезличить всех</>
                )}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                disabled={clearing}
                className="px-4 glass rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Очистка сообщений */}
        <div className="mt-3 pt-3 border-t border-red-500/20">
          {clearMsgsResult && (
            <div className="text-xs px-3 py-2 mb-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {clearMsgsResult}
            </div>
          )}
          {!confirmClearMsgs ? (
            <button
              onClick={() => setConfirmClearMsgs(true)}
              className="w-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="MessageSquareX" size={15} fallback="Trash2" /> Очистить все сообщения
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-300">Удалит все сообщения у всех чатов. Точно?</p>
              <div className="flex gap-2">
                <button
                  onClick={onClearAllMessages}
                  disabled={clearingMsgs}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  {clearingMsgs ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Очищаю...</>
                  ) : (
                    <>Да, удалить все сообщения</>
                  )}
                </button>
                <button
                  onClick={() => setConfirmClearMsgs(false)}
                  disabled={clearingMsgs}
                  className="px-4 glass rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminStatsTab;