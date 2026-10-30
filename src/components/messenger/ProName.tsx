import Icon from "@/components/ui/icon";

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

export default function ProName({
  name, isPro, emoji, color, className = "", badgeSize = 14,
}: {
  name: string;
  isPro?: boolean;
  emoji?: string | null;
  color?: string | null;
  className?: string;
  badgeSize?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
      <span className={`truncate ${className}`} style={isPro && color ? { color } : undefined}>{name}</span>
      {isPro && emoji ? <span className="flex-shrink-0 leading-none" style={{ fontSize: badgeSize }}>{emoji}</span> : null}
      {isPro ? <ProBadge size={badgeSize} /> : null}
    </span>
  );
}
