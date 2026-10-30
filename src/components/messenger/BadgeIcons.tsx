import { badgeSrc, isKnownBadge, BADGE_TITLES } from "@/lib/badges";

/** Значки пользователя рядом с именем. Показываем не больше `max`, остальное — «+N». */
export default function BadgeIcons({ codes, size = 16, max = 3 }: { codes?: string[] | null; size?: number; max?: number }) {
  const list = (codes || []).filter(isKnownBadge);
  if (list.length === 0) return null;
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  return (
    <span className="inline-flex items-center gap-0.5 flex-shrink-0">
      {shown.map((c) => (
        <img
          key={c}
          src={badgeSrc(c)}
          alt={BADGE_TITLES[c]}
          title={BADGE_TITLES[c]}
          width={size}
          height={size}
          loading="lazy"
          draggable={false}
          className="select-none"
          style={{ width: size, height: size }}
        />
      ))}
      {rest > 0 && <span className="text-[10px] text-muted-foreground font-semibold ml-0.5">+{rest}</span>}
    </span>
  );
}
