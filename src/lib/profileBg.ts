export interface BgPreset { id: string; title: string; css: string }

export const PROFILE_BG_PRESETS: BgPreset[] = [
  { id: "aurora", title: "Аврора", css: "radial-gradient(120% 90% at 20% 0%, #22d3ee88, transparent 60%), radial-gradient(100% 80% at 90% 20%, #a855f799, transparent 60%), linear-gradient(180deg, #1e1b4b, #0d0b18)" },
  { id: "sunset", title: "Закат", css: "radial-gradient(120% 90% at 50% 0%, #fb923c99, transparent 60%), linear-gradient(180deg, #9f1239, #1c0a12)" },
  { id: "ocean", title: "Океан", css: "radial-gradient(120% 90% at 30% 0%, #38bdf899, transparent 60%), linear-gradient(180deg, #1e3a8a, #071226)" },
  { id: "forest", title: "Лес", css: "radial-gradient(120% 90% at 70% 0%, #4ade8077, transparent 60%), linear-gradient(180deg, #14532d, #06140c)" },
  { id: "rose", title: "Роза", css: "radial-gradient(120% 90% at 40% 0%, #f9a8d499, transparent 60%), linear-gradient(180deg, #831843, #1a0712)" },
  { id: "space", title: "Космос", css: "radial-gradient(2px 2px at 20% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 70% 20%, #fff, transparent), radial-gradient(1px 1px at 40% 70%, #fff, transparent), radial-gradient(1.5px 1.5px at 85% 60%, #fff, transparent), radial-gradient(120% 90% at 50% 0%, #6366f188, transparent 65%), linear-gradient(180deg, #0f0a2e, #05030d)" },
  { id: "gold", title: "Золото", css: "radial-gradient(120% 90% at 50% 0%, #fde04788, transparent 60%), linear-gradient(180deg, #78350f, #160c03)" },
  { id: "mono", title: "Графит", css: "radial-gradient(120% 90% at 50% 0%, #ffffff33, transparent 60%), linear-gradient(180deg, #27272a, #09090b)" },
];

/** CSS-фон для значения profile_bg: готовый фон или ссылка на своё фото. */
export function profileBgStyle(bg?: string | null): React.CSSProperties | null {
  if (!bg) return null;
  const p = PROFILE_BG_PRESETS.find((x) => x.id === bg);
  if (p) return { background: p.css };
  if (bg.startsWith("https://")) return { backgroundImage: `url("${bg}")`, backgroundSize: "cover", backgroundPosition: "center" };
  return null;
}
