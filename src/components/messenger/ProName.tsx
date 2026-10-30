import Icon from "@/components/ui/icon";
import BadgeIcons from "@/components/messenger/BadgeIcons";

export function ProBadge({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      title="Nova Pro"
      aria-label="Nova Pro"
      className={`inline-flex items-center justify-center rounded-full flex-shrink-0 ${className}`}
      style={{ width: size, height: size, background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}
    >
      <Icon name="Zap" size={Math.round(size * 0.62)} className="text-white" />
    </span>
  );
}

/** Эффект для имени из магазина: shimmer — переливы, neon — свечение, crown — корона перед именем. */
export function effectClass(effect?: string | null) {
  if (effect === "shimmer") return "name-shimmer";
  if (effect === "neon") return "name-neon";
  return "";
}

export default function ProName({
  name, isPro, emoji, color, className = "", badgeSize = 14, effect, badges, maxBadges = 3,
}: {
  name: string;
  isPro?: boolean;
  emoji?: string | null;
  color?: string | null;
  className?: string;
  badgeSize?: number;
  effect?: string | null;
  badges?: string[] | null;
  maxBadges?: number;
}) {
  const fx = effectClass(effect);
  const style = fx === "name-shimmer" ? undefined : isPro && color ? ({ color, ["--neon" as string]: color } as React.CSSProperties) : undefined;
  return (
    <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
      {effect === "crown" && (
        <span className="flex-shrink-0 leading-none name-crown" style={{ fontSize: Math.round(badgeSize * 1.05) }} aria-label="Корона">👑</span>
      )}
      <span className={`truncate ${className} ${fx}`} style={style}>{name}</span>
      {isPro && emoji ? <span className="flex-shrink-0 leading-none" style={{ fontSize: badgeSize }}>{emoji}</span> : null}
      {isPro ? <ProBadge size={badgeSize} /> : null}
      <BadgeIcons codes={badges} size={Math.round(badgeSize * 1.15)} max={maxBadges} />
    </span>
  );
}
