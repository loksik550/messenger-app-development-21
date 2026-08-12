import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";

interface DashboardData {
  users: { total: number; online: number; active_24h: number; new_24h: number };
  messages: { total: number; last_24h: number; last_hour: number };
  content: { chats: number; groups: number; stories: number; calls_24h: number };
  moderation: { reports: number; open_tickets: number };
  chart: { hour: string; value: number }[];
}

interface ModerationData {
  open_reports: number;
  pending_verifications: number;
  open_tickets: number;
  banned_users: number;
  verified_users: number;
  removed_messages_24h: number;
}

interface SubsData {
  active: number;
  expiring_7d: number;
  trials_used: number;
  expired: number;
  plans: number;
  revenue_30d: number;
  purchases_30d: number;
  promo_activations_30d: number;
  referrals: number;
  by_plan: { plan: string; count: number; sum: number }[];
}

export default function DevDashboard({ onNavigate }: { onNavigate?: (s: string) => void } = {}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [mod, setMod] = useState<ModerationData | null>(null);
  const [subs, setSubs] = useState<SubsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await devApi<DashboardData>("dashboard");
      setData(res);
      try {
        const m = await devApi<{ moderation: ModerationData }>("moderation_summary");
        setMod(m.moderation);
      } catch {
        /* раздел модерации может быть недоступен по правам */
      }
      try {
        const sres = await devApi<{ subscriptions: SubsData }>("subscriptions_summary");
        setSubs(sres.subscriptions);
      } catch {
        /* раздел подписок может быть недоступен по правам */
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;
  if (!data) return null;

  const cards = [
    { label: "Всего пользователей", value: data.users.total, icon: "Users", color: "violet", sub: `+${data.users.new_24h} за сутки` },
    { label: "Сейчас в сети", value: data.users.online, icon: "Wifi", color: "emerald", sub: `${data.users.active_24h} активных за сутки` },
    { label: "Сообщений за сутки", value: data.messages.last_24h, icon: "MessageSquare", color: "cyan", sub: `${data.messages.last_hour} за последний час` },
    { label: "Открытых обращений", value: data.moderation.open_tickets, icon: "LifeBuoy", color: "amber", sub: `${data.moderation.reports} жалоб всего` },
  ];

  const secondary = [
    { label: "Всего сообщений", value: data.messages.total, icon: "Mail" },
    { label: "Личных чатов", value: data.content.chats, icon: "MessagesSquare" },
    { label: "Групп и каналов", value: data.content.groups, icon: "Users" },
    { label: "Историй активно", value: data.content.stories, icon: "Sparkles" },
    { label: "Звонков за сутки", value: data.content.calls_24h, icon: "Phone" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Активность за сутки</h3>
            <p className="text-xs text-slate-500 mt-0.5">Сообщений в час</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Живые данные
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.chart}>
              <defs>
                <linearGradient id="devGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "#12131f",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#e2e8f0",
                }}
                labelFormatter={(l) => `${l} назад`}
                formatter={(v: number) => [`${v}`, "Сообщений"]}
              />
              <Area type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={2} fill="url(#devGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {subs && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-semibold">Premium, промокоды и рефералы</h3>
              <p className="text-xs text-slate-500 mt-0.5">Доход, подписки и бонусные программы</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate?.("plans")}
                className="text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                Тарифы
              </button>
              <button
                onClick={() => onNavigate?.("promo")}
                className="text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                Промокоды
              </button>
              <button
                onClick={() => onNavigate?.("payments")}
                className="text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                Платежи
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <SubCard label="Активных подписок" value={formatNum(subs.active)} icon="Crown" accent />
            <SubCard label="Доход за 30 дней" value={`${formatNum(subs.revenue_30d)} ₽`} icon="Banknote" />
            <SubCard label="Покупок за 30 дней" value={formatNum(subs.purchases_30d)} icon="ShoppingCart" />
            <SubCard label="Тарифов в продаже" value={formatNum(subs.plans)} icon="Tags" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Истекают за 7 дней" value={subs.expiring_7d} icon="Clock" />
            <MiniStat label="Пробных использовано" value={subs.trials_used} icon="Gift" />
            <MiniStat label="Промокодов за 30 дн." value={subs.promo_activations_30d} icon="Ticket" />
            <MiniStat label="Приглашено друзей" value={subs.referrals} icon="Users" />
          </div>

          {subs.by_plan.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/8">
              <div className="text-xs text-slate-500 mb-2">Продажи по тарифам</div>
              <div className="space-y-1.5">
                {subs.by_plan.slice(0, 5).map((b) => (
                  <div key={b.plan} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-mono">{b.plan}</span>
                    <span className="text-slate-500">
                      {formatNum(b.count)} шт · {formatNum(b.sum)} ₽
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mod && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-semibold">Модерация</h3>
              <p className="text-xs text-slate-500 mt-0.5">Что требует вашего внимания</p>
            </div>
            {(mod.open_reports > 0 || mod.pending_verifications > 0 || mod.open_tickets > 0) && (
              <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                Есть задачи
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <ModCard
              label="Жалобы без решения"
              value={mod.open_reports}
              icon="Flag"
              tone={mod.open_reports > 0 ? "warn" : "ok"}
              onClick={() => onNavigate?.("reports")}
            />
            <ModCard
              label="Заявки на галочку"
              value={mod.pending_verifications}
              icon="BadgeCheck"
              tone={mod.pending_verifications > 0 ? "warn" : "ok"}
              onClick={() => onNavigate?.("verification")}
            />
            <ModCard
              label="Открытые обращения"
              value={mod.open_tickets}
              icon="LifeBuoy"
              tone={mod.open_tickets > 0 ? "warn" : "ok"}
              onClick={() => onNavigate?.("support")}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Заблокировано" value={mod.banned_users} icon="Ban" />
            <MiniStat label="С галочкой" value={mod.verified_users} icon="BadgeCheck" />
            <MiniStat label="Удалено за сутки" value={mod.removed_messages_24h} icon="Trash2" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {secondary.map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <Icon name={s.icon} size={16} className="text-slate-500 mb-2" />
            <div className="text-xl font-bold">{formatNum(s.value)}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const COLORS: Record<string, string> = {
  violet: "from-violet-500/20 to-violet-500/5 text-violet-400 border-violet-500/20",
  emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20",
  cyan: "from-cyan-500/20 to-cyan-500/5 text-cyan-400 border-cyan-500/20",
  amber: "from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20",
};

function StatCard({ label, value, icon, color, sub }: { label: string; value: number; icon: string; color: string; sub: string }) {
  const cls = COLORS[color] || COLORS.violet;
  return (
    <div className={`bg-gradient-to-br ${cls.split(" ").slice(0, 2).join(" ")} border ${cls.split(" ")[3]} rounded-2xl p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center ${cls.split(" ")[2]}`}>
          <Icon name={icon} size={18} />
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight">{formatNum(value)}</div>
      <div className="text-sm text-slate-300 mt-1">{label}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

function SubCard({ label, value, icon, accent }: {
  label: string; value: string; icon: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 border ${
      accent ? "bg-amber-500/10 border-amber-500/25" : "bg-white/[0.03] border-white/8"
    }`}>
      <Icon name={icon} size={16} className={accent ? "text-amber-400 mb-2" : "text-slate-500 mb-2"} />
      <div className={`text-xl font-bold ${accent ? "text-amber-300" : ""}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function ModCard({ label, value, icon, tone, onClick }: {
  label: string; value: number; icon: string; tone: "warn" | "ok"; onClick?: () => void;
}) {
  const warn = tone === "warn";
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl p-4 border transition hover:brightness-125 ${
        warn
          ? "bg-amber-500/10 border-amber-500/25"
          : "bg-white/[0.03] border-white/8"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon name={icon} size={16} className={warn ? "text-amber-400" : "text-slate-500"} />
        <Icon name="ChevronRight" size={14} className="text-slate-600" />
      </div>
      <div className={`text-2xl font-bold ${warn ? "text-amber-300" : ""}`}>{formatNum(value)}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </button>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5">
      <Icon name={icon} size={13} className="text-slate-500 mb-1" />
      <div className="text-base font-bold">{formatNum(value)}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Icon name="Loader2" size={28} className="animate-spin text-violet-400" />
    </div>
  );
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
        <Icon name="CircleAlert" size={24} className="text-red-400" />
      </div>
      <p className="text-sm text-slate-300 mb-3">{text}</p>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition">
          Повторить
        </button>
      )}
    </div>
  );
}
