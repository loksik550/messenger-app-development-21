import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { APP_ICONS, appIconSupported, applyAppIcon } from "@/lib/appIcons";

export default function AppIconPanel({
  currentUser, onClose, onUserUpdate, onOpenPro,
}: {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (u: User) => void;
  onOpenPro?: () => void;
}) {
  const isPro = !!currentUser.is_pro;
  const [enabled, setEnabled] = useState<string[]>(APP_ICONS.map((i) => i.id));
  const [selected, setSelected] = useState(currentUser.app_icon || "classic");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    api("app_icons", {}, currentUser.id).then((d) => { if (Array.isArray(d.icons)) setEnabled(d.icons); });
    appIconSupported().then(setSupported);
  }, [currentUser.id]);

  const pick = async (id: string) => {
    if (id !== "classic" && !isPro) { onOpenPro?.(); return; }
    if (id === selected) return;
    setSaving(true);
    setMsg(null);
    const r = await api("update_profile", { app_icon: id }, currentUser.id);
    if (r.error) { setSaving(false); setMsg({ ok: false, t: r.error }); return; }
    setSelected(id);
    if (r.user) {
      onUserUpdate?.(r.user);
      localStorage.setItem("nova_user", JSON.stringify(r.user));
    }
    const applied = await applyAppIcon(id);
    setSaving(false);
    setMsg(applied
      ? { ok: true, t: "Значок изменён — посмотрите на рабочий стол" }
      : { ok: true, t: "Выбор сохранён. Значок сменится на телефоне после обновления приложения" });
  };

  const list = APP_ICONS.filter((i) => enabled.includes(i.id));

  return (
    <div className="fixed inset-0 z-[270] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="font-bold flex-1 text-lg">Значок приложения</h2>
        {saving && <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-md w-full mx-auto space-y-4">
        <p className="text-sm text-muted-foreground">Выберите, как Nova будет выглядеть на рабочем столе телефона.</p>

        <div className="grid grid-cols-2 gap-3">
          {list.map((ic) => {
            const active = selected === ic.id;
            const locked = ic.id !== "classic" && !isPro;
            return (
              <button
                key={ic.id}
                onClick={() => pick(ic.id)}
                disabled={saving}
                className={`relative glass rounded-3xl p-4 flex flex-col items-center gap-3 transition-all ${active ? "ring-2 ring-violet-500 bg-violet-500/10" : "hover:bg-white/8"}`}
              >
                <img src={ic.src} alt={ic.title} className="w-24 h-24 rounded-[22px] shadow-xl shadow-black/40" />
                <span className="text-sm font-semibold">{ic.title}</span>
                {active && (
                  <span className="absolute top-3 right-3 w-6 h-6 rounded-full grad-primary flex items-center justify-center">
                    <Icon name="Check" size={14} className="text-white" />
                  </span>
                )}
                {locked && (
                  <span className="absolute top-3 right-3 text-[10px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}>
                    PRO
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {msg && <p className={`text-sm text-center ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.t}</p>}

        {supported === false && (
          <div className="glass rounded-2xl p-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Icon name="Info" size={14} className="mt-0.5 flex-shrink-0" />
            <span>Значок на рабочем столе меняется в приложении Nova для Android. Ваш выбор сохранится и применится автоматически, когда обновление станет доступно.</span>
          </div>
        )}

        {!isPro && (
          <button onClick={onOpenPro} className="w-full py-3 rounded-2xl text-white font-bold" style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}>
            Подключить Nova Pro
          </button>
        )}
      </div>
    </div>
  );
}
