import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, uploadMedia, type User } from "@/lib/api";
import { PROFILE_BG_PRESETS, profileBgStyle } from "@/lib/profileBg";

export default function ProfileBgPicker({ currentUser, onClose, onUserUpdate, onOpenPro }: {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (u: User) => void;
  onOpenPro?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const current = currentUser.profile_bg || null;
  const isPro = !!currentUser.is_pro;
  const ownPhoto = current && current.startsWith("https://") ? current : null;

  const save = async (bg: string | null) => {
    setBusy(true); setError("");
    const r = await api("update_profile", { profile_bg: bg }, currentUser.id).catch(() => null);
    setBusy(false);
    if (!r || r.error) { setError(r?.error || "Нет связи, попробуйте ещё раз"); return; }
    if (r.user) {
      onUserUpdate?.(r.user);
      localStorage.setItem("nova_user", JSON.stringify(r.user));
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Выберите фото"); return; }
    setBusy(true); setError("");
    try {
      const up = await uploadMedia(f, currentUser.id);
      await save(up.url);
    } catch (err) {
      setBusy(false);
      setError((err as Error).message || "Не удалось загрузить фото");
    }
  };

  return (
    <div className="fixed inset-0 z-[270] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-3xl p-5 animate-scale-in max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-lg">Фон профиля</h3>
          <div className="flex items-center gap-2">
            {busy && <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />}
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/8"><Icon name="X" size={18} /></button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Его видят все, кто открывает ваш профиль.</p>

        <button
          onClick={() => (isPro ? fileRef.current?.click() : onOpenPro?.())}
          disabled={busy}
          className={`relative w-full h-28 rounded-2xl overflow-hidden mb-3 text-left ${ownPhoto ? "ring-2 ring-violet-500" : "border border-dashed border-white/20"}`}
          style={ownPhoto ? (profileBgStyle(ownPhoto) || undefined) : undefined}
        >
          <div className={`absolute inset-0 flex items-center gap-3 px-4 ${ownPhoto ? "bg-black/35" : "bg-white/[0.03]"}`}>
            <span className="w-10 h-10 rounded-xl grad-primary flex items-center justify-center flex-shrink-0">
              <Icon name={isPro ? "ImagePlus" : "Lock"} fallback="Image" size={18} className="text-white" />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-1.5 text-sm font-bold">
                {ownPhoto ? "Сменить своё фото" : "Своё фото"}
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}>PRO</span>
              </span>
              <span className="block text-[11px] text-muted-foreground">{isPro ? "Любое фото из галереи" : "Доступно с Nova Pro"}</span>
            </span>
            {ownPhoto && <Icon name="Check" size={18} className="text-white" />}
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

        <div className="text-xs text-muted-foreground mb-2">Готовые фоны — бесплатно</div>
        <div className="grid grid-cols-4 gap-2">
          {PROFILE_BG_PRESETS.map((p) => {
            const on = current === p.id;
            return (
              <button key={p.id} onClick={() => save(p.id)} disabled={busy} className="flex flex-col items-center gap-1">
                <span className={`relative w-full aspect-[3/4] rounded-xl ${on ? "ring-2 ring-violet-500" : "ring-1 ring-white/10"}`} style={{ background: p.css }}>
                  {on && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full grad-primary flex items-center justify-center">
                      <Icon name="Check" size={11} className="text-white" />
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground">{p.title}</span>
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        {current && (
          <button onClick={() => save(null)} disabled={busy} className="w-full mt-4 py-2.5 rounded-2xl glass text-sm font-semibold text-muted-foreground">
            Убрать фон
          </button>
        )}
      </div>
    </div>
  );
}
