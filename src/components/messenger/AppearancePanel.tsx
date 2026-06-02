import { useState } from "react";
import Icon from "@/components/ui/icon";
import { type User, api } from "@/lib/api";
import { applyAccent, applyFontSize, applyTheme, applyBubbleStyle, getStoredFontSize, getStoredTheme, THEMES_META, type ThemeId, type AutoConfig, type AutoMode, getStoredAutoConfig, setStoredAutoConfig, startAutoTheme, stopAutoTheme } from "@/lib/theme";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { useT } from "@/hooks/useT";

const ACCENT_COLORS = [
  { id: "violet", hex: "#8b5cf6" },
  { id: "blue", hex: "#3b82f6" },
  { id: "cyan", hex: "#06b6d4" },
  { id: "emerald", hex: "#10b981" },
  { id: "amber", hex: "#f59e0b" },
  { id: "rose", hex: "#f43f5e" },
  { id: "pink", hex: "#ec4899" },
  { id: "indigo", hex: "#6366f1" },
];

const WALLPAPERS = [
  { id: "default", name: "Авто", bg: "" },
  { id: "stars", name: "Звёзды", bg: "radial-gradient(circle at 20% 30%, #1a1a3a 0%, #0d0d1a 60%)" },
  { id: "aurora", name: "Аврора", bg: "linear-gradient(135deg, #064e3b 0%, #312e81 50%, #4c1d95 100%)" },
  { id: "sunset", name: "Закат", bg: "linear-gradient(180deg, #7c2d12 0%, #be185d 70%, #1e1b4b 100%)" },
  { id: "ocean", name: "Океан", bg: "linear-gradient(180deg, #0c4a6e 0%, #082f49 100%)" },
  { id: "rose", name: "Роза", bg: "linear-gradient(135deg, #831843 0%, #500724 100%)" },
];

const BUBBLES = [
  { id: "default", name: "Обычный" },
  { id: "rounded", name: "Округлый" },
  { id: "minimal", name: "Минимал" },
];

function vibrate(ms = 10) {
  try { (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(ms); } catch { /* ignore */ }
}

export default function AppearancePanel({
  currentUser, onClose, onUserUpdate,
}: { currentUser: User; onClose: () => void; onUserUpdate: (u: User) => void; }) {
  useEdgeSwipeBack(onClose);
  const { t: tr } = useT();
  const isPro = !!currentUser.pro_until && currentUser.pro_until > Math.floor(Date.now() / 1000);
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme());
  const [font, setFont] = useState<number>(getStoredFontSize());
  const [accent, setAccent] = useState<string>(currentUser.accent_color || "violet");
  const [wallpaper, setWallpaper] = useState<string>(currentUser.chat_wallpaper || "default");
  const [bubbleStyle, setBubbleStyle] = useState<string>(currentUser.bubble_style || "default");
  const [toast, setToast] = useState<string>("");
  const [autoCfg, setAutoCfg] = useState<AutoConfig>(getStoredAutoConfig());

  const updateAuto = (patch: Partial<AutoConfig>) => {
    const next = { ...autoCfg, ...patch };
    setAutoCfg(next);
    setStoredAutoConfig(next);
    if (next.mode === "off") stopAutoTheme();
    else startAutoTheme(next);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  };

  const setT = (id: ThemeId, pro: boolean | undefined) => {
    if (pro && !isPro) { showToast("Эта тема доступна с Nova Pro"); vibrate(20); return; }
    vibrate(10);
    setTheme(id);
    applyTheme(id, font);
    const hex = ACCENT_COLORS.find(c => c.id === accent)?.hex || "#8b5cf6";
    applyAccent(hex);
    api("update_user_settings", { theme_id: id }, currentUser.id);
    onUserUpdate({ ...currentUser, theme_id: id } as User);
  };

  const setF = (n: number) => {
    setFont(n);
    applyFontSize(n);
    api("update_user_settings", { font_size: n }, currentUser.id);
  };

  const setA = (id: string) => {
    vibrate(10);
    setAccent(id);
    const hex = ACCENT_COLORS.find(c => c.id === id)?.hex || "#8b5cf6";
    applyAccent(hex);
    api("update_user_settings", { accent_color: id }, currentUser.id);
    onUserUpdate({ ...currentUser, accent_color: id } as User);
  };

  const setWp = (id: string) => {
    setWallpaper(id);
    api("update_user_settings", { chat_wallpaper: id }, currentUser.id);
    onUserUpdate({ ...currentUser, chat_wallpaper: id } as User);
  };

  const setBs = (id: string) => {
    vibrate(10);
    setBubbleStyle(id);
    applyBubbleStyle(id);
    api("update_user_settings", { bubble_style: id }, currentUser.id);
    onUserUpdate({ ...currentUser, bubble_style: id } as User);
  };

  return (
    <div className="fixed inset-0 z-[260] bg-background flex flex-col animate-fade-in">
      {/* Минималистичный header */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-white/5" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition" aria-label={tr("common.back")}>
          <Icon name="ChevronLeft" size={18} />
        </button>
        <h2 className="text-sm font-semibold flex-1">{tr("appearance.title")}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 max-w-md mx-auto w-full">
        {/* Тема */}
        <Section title={tr("appearance.theme")}>
          <div className="grid grid-cols-4 gap-1.5">
            {THEMES_META.map(t => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setT(t.id, t.pro)}
                  className={`relative aspect-square rounded-xl bg-gradient-to-br ${t.preview} transition ${active ? "ring-2 ring-violet-400" : "ring-1 ring-white/5 hover:ring-white/15"}`}
                  title={t.name}
                >
                  {t.pro && !isPro && (
                    <span className="absolute top-0.5 right-0.5 text-[8px] bg-amber-500 text-black font-bold px-1 py-px rounded">PRO</span>
                  )}
                  {active && (
                    <Icon name="Check" size={12} className="absolute bottom-0.5 right-0.5 text-white drop-shadow" />
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Авто-тема */}
        <Section title="Авто-тема">
          <div className="flex gap-1.5">
            {([
              { id: "off", label: "Выкл" },
              { id: "system", label: "Система" },
              { id: "schedule", label: "По часам" },
            ] as { id: AutoMode; label: string }[]).map(o => {
              const active = autoCfg.mode === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => updateAuto({ mode: o.id })}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${active ? "bg-violet-500 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/8"}`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {autoCfg.mode === "schedule" && (
            <div className="mt-3 p-3 rounded-xl bg-white/5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-14">Тёмная с</span>
                <input
                  type="number" min={0} max={23} value={autoCfg.startHour}
                  onChange={e => updateAuto({ startHour: Math.max(0, Math.min(23, parseInt(e.target.value || "0", 10))) })}
                  className="w-14 bg-white/5 rounded px-2 py-1 text-sm tabular-nums text-center outline-none focus:bg-white/8"
                />
                <span className="text-[11px] text-muted-foreground">до</span>
                <input
                  type="number" min={0} max={23} value={autoCfg.endHour}
                  onChange={e => updateAuto({ endHour: Math.max(0, Math.min(23, parseInt(e.target.value || "0", 10))) })}
                  className="w-14 bg-white/5 rounded px-2 py-1 text-sm tabular-nums text-center outline-none focus:bg-white/8"
                />
                <span className="text-[11px] text-muted-foreground">ч</span>
              </div>
            </div>
          )}
          {autoCfg.mode !== "off" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground mb-1.5">День</div>
                <select
                  value={autoCfg.dayTheme}
                  onChange={e => updateAuto({ dayTheme: e.target.value as ThemeId })}
                  className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none focus:bg-white/8"
                >
                  {THEMES_META.filter(t => !t.pro || isPro).map(t => (
                    <option key={t.id} value={t.id} className="bg-zinc-900">{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground mb-1.5">Ночь</div>
                <select
                  value={autoCfg.nightTheme}
                  onChange={e => updateAuto({ nightTheme: e.target.value as ThemeId })}
                  className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none focus:bg-white/8"
                >
                  {THEMES_META.filter(t => !t.pro || isPro).map(t => (
                    <option key={t.id} value={t.id} className="bg-zinc-900">{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </Section>

        {/* Акцент */}
        <Section title="Акцент">
          <div className="flex flex-wrap gap-2">
            {ACCENT_COLORS.map(c => {
              const active = accent === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setA(c.id)}
                  className={`w-8 h-8 rounded-full transition ${active ? "ring-2 ring-white/80 ring-offset-2 ring-offset-[#0d0d1a]" : "hover:scale-110"}`}
                  style={{ background: c.hex }}
                  aria-label={c.id}
                />
              );
            })}
          </div>
        </Section>

        {/* Размер шрифта */}
        <Section title={tr("appearance.fontSize")}>
          <div className="flex items-center gap-3 px-1">
            <span className="text-xs text-muted-foreground">A</span>
            <input
              type="range" min={12} max={20} value={font}
              onChange={e => setF(parseInt(e.target.value, 10))}
              className="flex-1 accent-violet-500"
            />
            <span className="text-base font-semibold">A</span>
            <span className="text-xs text-muted-foreground w-7 text-right tabular-nums">{font}</span>
          </div>
        </Section>

        {/* Обои */}
        <Section title="Обои чата">
          <div className="grid grid-cols-3 gap-1.5">
            {WALLPAPERS.map(w => {
              const active = wallpaper === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setWp(w.id)}
                  className={`relative h-14 rounded-lg overflow-hidden transition ${active ? "ring-2 ring-violet-400" : "ring-1 ring-white/5 hover:ring-white/15"}`}
                  style={{ background: w.bg || "linear-gradient(135deg, #1f1f3a, #0d0d1a)" }}
                >
                  <span className="absolute bottom-0.5 left-1.5 text-[10px] font-medium text-white/90">{w.name}</span>
                  {active && <Icon name="Check" size={12} className="absolute top-1 right-1 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Пузыри */}
        <Section title="Сообщения">
          <div className="flex gap-1.5">
            {BUBBLES.map(b => {
              const active = bubbleStyle === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setBs(b.id)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${active ? "bg-violet-500 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/8"}`}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        </Section>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-8 z-[300] px-4 py-2.5 rounded-2xl bg-black/80 backdrop-blur text-white text-sm font-medium shadow-2xl animate-fade-in"
          style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1">{title}</div>
      {children}
    </div>
  );
}