import { useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";

interface Props {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (u: User) => void;
  onOpenPro?: () => void;
}

const EMOJI_STATUSES = ["", "🔥", "💎", "⚡", "🌟", "👑", "🚀", "💜", "🌙", "☕", "🎮", "🎵", "✨", "🦄", "🌈"];
const NAME_COLORS = [
  { name: "По умолчанию", value: null },
  { name: "Фиолетовый", value: "#a855f7" },
  { name: "Розовый", value: "#ec4899" },
  { name: "Голубой", value: "#0ea5e9" },
  { name: "Изумрудный", value: "#10b981" },
  { name: "Янтарный", value: "#f59e0b" },
  { name: "Красный", value: "#ef4444" },
  { name: "Золотой", value: "#eab308" },
];

export default function ProSettingsPanel({ currentUser, onClose, onUserUpdate, onOpenPro }: Props) {
  const isPro = currentUser.is_pro || (currentUser.pro_until && currentUser.pro_until > Date.now() / 1000);
  const [saving, setSaving] = useState(false);

  const update = async (fields: Partial<User>) => {
    setSaving(true);
    const r = await api("update_profile", fields as Record<string, unknown>, currentUser.id);
    setSaving(false);
    if (r.user) {
      onUserUpdate?.(r.user);
      localStorage.setItem("nova_user", JSON.stringify(r.user));
    }
  };

  const ProBadge = () => (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded ml-auto"
      style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "#fff" }}>
      PRO
    </span>
  );

  return (
    <div className="fixed inset-0 z-[260] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="font-bold flex-1 text-lg">Персонализация</h2>
        {saving && <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Live preview */}
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl grad-primary flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {currentUser.name[0]?.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base" style={{ color: currentUser.name_color || undefined }}>
                {currentUser.name}
              </span>
              {currentUser.emoji_status && <span className="text-base">{currentUser.emoji_status}</span>}
              {isPro && <Icon name="Crown" size={13} style={{ color: "#f59e0b" }} />}
            </div>
            <div className="text-xs text-muted-foreground">
              {currentUser.incognito ? "не в сети" : "в сети"}
            </div>
          </div>
        </div>

        {/* Эмодзи-статус */}
        <div>
          <h3 className="flex items-center gap-2 font-semibold mb-2 text-sm">
            <Icon name="Smile" size={15} className="text-amber-400" />
            Эмодзи-статус
            <ProBadge />
          </h3>
          {!isPro && (
            <button onClick={onOpenPro}
              className="w-full mb-2 px-3 py-2 rounded-xl text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20">
              Доступно с Nova Pro · нажми чтобы оформить
            </button>
          )}
          <div className="grid grid-cols-8 gap-2">
            {EMOJI_STATUSES.map(emoji => (
              <button
                key={emoji || "none"}
                disabled={!isPro}
                onClick={() => update({ emoji_status: emoji || null })}
                className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition ${
                  currentUser.emoji_status === emoji || (!emoji && !currentUser.emoji_status)
                    ? "bg-amber-500/20 ring-2 ring-amber-400"
                    : "bg-white/5 hover:bg-white/10"
                } ${!isPro ? "opacity-40 cursor-not-allowed" : ""}`}>
                {emoji || <Icon name="X" size={14} className="text-muted-foreground" />}
              </button>
            ))}
          </div>
        </div>

        {/* Цвет ника */}
        <div>
          <h3 className="flex items-center gap-2 font-semibold mb-2 text-sm">
            <Icon name="Palette" size={15} className="text-pink-400" />
            Цвет имени
            <ProBadge />
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {NAME_COLORS.map(c => (
              <button
                key={c.name}
                onClick={() => isPro ? update({ name_color: c.value }) : onOpenPro?.()}
                className={`p-3 rounded-xl text-xs font-bold transition ${
                  currentUser.name_color === c.value
                    ? "bg-white/15 ring-2 ring-violet-400"
                    : "bg-white/5 hover:bg-white/10"
                } ${!isPro ? "opacity-60" : ""}`}
                style={{ color: c.value || undefined }}>
                {c.name}
              </button>
            ))}
          </div>
          {!isPro && (
            <p className="text-[11px] text-amber-300/80 mt-2 px-1">
              Цвет имени работает только с Nova Pro. Нажми на цвет — откроется оформление.
            </p>
          )}
        </div>

        {/* Инкогнито */}
        <div>
          <h3 className="flex items-center gap-2 font-semibold mb-2 text-sm">
            <Icon name="Eye" size={15} className="text-sky-400" />
            Инкогнито
            <ProBadge />
          </h3>
          <button
            disabled={!isPro}
            onClick={() => update({ incognito: !currentUser.incognito })}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition ${
              !isPro ? "opacity-40 cursor-not-allowed bg-white/5" : "bg-white/5 hover:bg-white/10"
            }`}>
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 flex items-center justify-center">
              <Icon name="EyeOff" size={16} className="text-sky-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Скрыть «в сети»</div>
              <div className="text-xs text-muted-foreground">Никто не увидит когда ты онлайн</div>
            </div>
            <div className={`w-11 h-6 rounded-full p-0.5 transition ${
              currentUser.incognito ? "bg-violet-500" : "bg-white/15"
            }`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                currentUser.incognito ? "translate-x-5" : "translate-x-0"
              }`} />
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}