import Icon from "@/components/ui/icon";
import { formatNum } from "@/lib/devApi";
import type { Trend } from "./DevDashboard";

export const COLORS: Record<string, string> = {
  violet: "from-violet-500/20 to-violet-500/5 text-violet-400 border-violet-500/20",
  emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20",
  cyan: "from-cyan-500/20 to-cyan-500/5 text-cyan-400 border-cyan-500/20",
  amber: "from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20",
};

export function Spark({ points, color }: { points: number[]; color: string }) {
  if (!points || points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const span = max - min || 1;
  const w = 88, h = 30;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={w}
        cy={h - ((points[points.length - 1] - min) / span) * (h - 4) - 2}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

export const FEED_META: Record<string, { icon: string; bg: string; fg: string }> = {
  AUTH: { icon: "UserPlus", bg: "bg-emerald-500/15", fg: "text-emerald-400" },
  MESSAGE: { icon: "MessageSquare", bg: "bg-violet-500/15", fg: "text-violet-300" },
  WARN: { icon: "TriangleAlert", bg: "bg-amber-500/15", fg: "text-amber-400" },
  PAY: { icon: "Wallet", bg: "bg-cyan-500/15", fg: "text-cyan-400" },
  ERROR: { icon: "CircleX", bg: "bg-red-500/15", fg: "text-red-400" },
  PANEL: { icon: "Terminal", bg: "bg-slate-500/15", fg: "text-slate-400" },
};

export const SPARK_COLOR: Record<string, string> = {
  violet: "#a78bfa", emerald: "#34d399", cyan: "#22d3ee", amber: "#fbbf24",
};

export function StatCard({ label, value, icon, color, sub, spark, delta }: {
  label: string; value: number; icon: string; color: string; sub: string;
  spark?: number[]; delta?: number | null;
}) {
  const cls = COLORS[color] || COLORS.violet;
  const up = (delta ?? 0) > 0;
  return (
    <div className={`bg-gradient-to-br ${cls.split(" ").slice(0, 2).join(" ")} border ${cls.split(" ")[3]} rounded-2xl p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center ${cls.split(" ")[2]}`}>
          <Icon name={icon} size={18} />
        </div>
        <div className="text-sm text-slate-300 text-right leading-tight max-w-[55%]">{label}</div>
      </div>
      <div className="text-3xl font-bold tracking-tight">{formatNum(value)}</div>
      <div className="flex items-end justify-between gap-2 mt-2">
        <div className="min-w-0">
          {delta !== null && delta !== undefined && delta !== 0 && (
            <div className={`text-xs font-medium flex items-center gap-0.5 ${up ? "text-emerald-400" : "text-red-400"}`}>
              <Icon name={up ? "ArrowUp" : "ArrowDown"} size={12} />
              {Math.abs(delta)}% за неделю
            </div>
          )}
          <div className="text-xs text-slate-500 mt-0.5 truncate">{sub}</div>
        </div>
        {spark && <Spark points={spark} color={SPARK_COLOR[color] || "#a78bfa"} />}
      </div>
    </div>
  );
}

export function SubCard({ label, value, icon, accent }: {
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

export function ModCard({ label, value, icon, tone, onClick }: {
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

export function MiniStat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5">
      <Icon name={icon} size={13} className="text-slate-500 mb-1" />
      <div className="text-base font-bold">{formatNum(value)}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

export const TREND_META: Record<string, { label: string; icon: string; money?: boolean }> = {
  users: { label: "Новых пользователей", icon: "UserPlus" },
  messages: { label: "Сообщений", icon: "MessageSquare" },
  revenue: { label: "Доход", icon: "Wallet", money: true },
};

export function TrendCard({ trend }: { trend: Trend }) {
  const meta = TREND_META[trend.key] || { label: trend.key, icon: "Activity" };
  const up = (trend.delta ?? 0) > 0;
  const flat = trend.delta === 0 || trend.delta === null;

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3.5">
      <div className="flex items-center gap-2 mb-2">
        <Icon name={meta.icon} size={14} className="text-slate-500" />
        <span className="text-xs text-slate-500">{meta.label}</span>
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <span className="text-xl font-bold">
          {formatNum(trend.now)}{meta.money ? " ₽" : ""}
        </span>
        {!flat && (
          <span
            className={`text-xs font-medium flex items-center gap-0.5 mb-0.5 ${
              up ? "text-emerald-400" : "text-red-400"
            }`}
          >
            <Icon name={up ? "TrendingUp" : "TrendingDown"} size={13} />
            {up ? "+" : ""}{trend.delta}%
          </span>
        )}
      </div>
      <div className="text-[11px] text-slate-600 mt-1">
        неделей раньше: {formatNum(trend.prev)}{meta.money ? " ₽" : ""}
      </div>
    </div>
  );
}
