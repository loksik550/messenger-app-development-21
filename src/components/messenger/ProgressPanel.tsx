import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User, type UserProgress, type LeaderboardItem } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatAtoms";

interface Props {
  currentUser: User;
  onClose: () => void;
}

const REASON_LABEL: Record<string, string> = {
  message: "Сообщение",
  received_message: "Получено сообщение",
  first_message_in_chat: "Первое сообщение в чате",
  lightning_sent: "Подарок ⚡ отправлен",
  lightning_received: "Получены ⚡",
  fundraiser_created: "Создан сбор",
  fundraiser_donate: "Поддержан сбор",
  sticker_pack_buy: "Куплен стикерпак",
  sticker_sent: "Отправлен стикер",
  pro_purchased: "Оформлен Nova Pro",
  daily_login: "Вход в Nova",
  registered: "Регистрация",
};

export default function ProgressPanel({ currentUser, onClose }: Props) {
  const [tab, setTab] = useState<"me" | "top">("me");
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [board, setBoard] = useState<LeaderboardItem[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, l] = await Promise.all([
        api("get_user_progress", {}, currentUser.id),
        api("leaderboard", {}, currentUser.id),
      ]);
      if (p && !p.error) setProgress(p as UserProgress);
      if (Array.isArray(l.items)) setBoard(l.items);
      setMyRank(l.my_rank ?? null);
      setLoading(false);
    })();
  }, [currentUser.id]);

  const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const earnedCount = progress?.badges.filter(b => b.earned).length || 0;
  const totalBadges = progress?.badges.length || 0;

  return (
    <div className="fixed inset-0 z-[260] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="font-bold flex-1 text-lg">Прокачка</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
        {loading && <div className="text-center text-sm text-muted-foreground py-8">Загружаем...</div>}

        {!loading && progress && (
          <>
            {/* Hero card */}
            <div className="rounded-3xl p-5 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)" }}>
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
              <div className="absolute right-2 top-2 text-7xl opacity-15 font-black">{progress.level}</div>
              <div className="relative">
                <div className="text-xs text-white/85 mb-1 flex items-center gap-1">
                  <Icon name="Trophy" size={12} />
                  Твой уровень
                </div>
                <div className="text-5xl font-black mb-2">{progress.level}</div>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-bold">{progress.xp} XP</span>
                    <span className="text-white/75">до {progress.level + 1} ур.: {progress.xp_for_next_level - progress.xp} XP</span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all" style={{ width: `${progress.progress_pct}%` }} />
                  </div>
                </div>
                {progress.daily_streak > 0 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-semibold">
                    <span>🔥</span>
                    {progress.daily_streak} {progress.daily_streak === 1 ? "день" : progress.daily_streak < 5 ? "дня" : "дней"} подряд
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 rounded-2xl">
              <button onClick={() => setTab("me")}
                className={`py-2 rounded-xl text-sm font-bold transition ${tab === "me" ? "bg-white/15" : "text-muted-foreground"}`}>
                Мой профиль
              </button>
              <button onClick={() => setTab("top")}
                className={`py-2 rounded-xl text-sm font-bold transition ${tab === "top" ? "bg-white/15" : "text-muted-foreground"}`}>
                Топ
              </button>
            </div>

            {tab === "me" && (
              <>
                {/* Badges */}
                <div className="glass rounded-3xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm">Бейджи</h3>
                    <span className="text-xs text-muted-foreground">{earnedCount} из {totalBadges}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {progress.badges.map(b => (
                      <div key={b.code}
                        className={`rounded-2xl p-3 flex flex-col items-center text-center transition ${
                          b.earned ? "bg-violet-500/15 border border-violet-400/40" : "bg-white/3 border border-white/5 opacity-50"
                        }`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1 ${
                          b.earned ? "bg-violet-500/30 text-violet-300" : "bg-white/5 text-muted-foreground"
                        }`}>
                          <Icon name={b.icon} size={18} />
                        </div>
                        <div className="text-[11px] font-bold leading-tight">{b.title}</div>
                        <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">{b.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent events */}
                <div className="glass rounded-3xl p-2">
                  <div className="px-2 py-2 text-xs text-muted-foreground">Последние действия</div>
                  {progress.events.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">Пока пусто</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {progress.events.map((e, i) => (
                        <div key={i} className="flex items-center gap-3 p-2.5">
                          <div className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-300 flex items-center justify-center">
                            <Icon name="Zap" size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{REASON_LABEL[e.reason] || e.reason}</div>
                            <div className="text-[11px] text-muted-foreground">{fmtDate(e.created_at)}</div>
                          </div>
                          <div className="text-sm font-black text-emerald-400">+{e.amount}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === "top" && (
              <div className="glass rounded-3xl p-2">
                {myRank && (
                  <div className="flex items-center gap-3 p-3 mb-1 rounded-2xl bg-violet-500/10 border border-violet-400/30">
                    <div className="w-10 text-center font-black text-violet-300 text-lg">#{myRank}</div>
                    <Avatar label={currentUser.name[0]?.toUpperCase() || "?"} id={currentUser.id} src={currentUser.avatar_url} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">Ты</div>
                      <div className="text-[11px] text-muted-foreground">Уровень {progress.level} · {progress.xp} XP</div>
                    </div>
                  </div>
                )}
                {board.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Пока никто не набрал XP</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {board.map(it => (
                      <div key={it.id} className="flex items-center gap-3 p-3">
                        <div className={`w-10 text-center font-black text-lg ${
                          it.rank === 1 ? "text-amber-400" : it.rank === 2 ? "text-zinc-300" : it.rank === 3 ? "text-orange-400" : "text-muted-foreground"
                        }`}>
                          {it.rank <= 3 ? ["🥇", "🥈", "🥉"][it.rank - 1] : `#${it.rank}`}
                        </div>
                        <Avatar label={it.name[0]?.toUpperCase() || "?"} id={it.id} src={it.avatar_url} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate">{it.name}</div>
                          <div className="text-[11px] text-muted-foreground">Уровень {it.level}</div>
                        </div>
                        <div className="text-sm font-black grad-text">{it.xp} XP</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
