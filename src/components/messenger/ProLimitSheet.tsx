import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

export type ProLimitDetail = {
  kind: "pins" | "folders" | "original";
  is_pro: boolean;
  pins_free?: number;
  pins_pro?: number;
  folders_free?: number;
  folders_pro?: number;
  message?: string;
};

export function showProLimit(d: ProLimitDetail) {
  window.dispatchEvent(new CustomEvent("nova:pro-limit", { detail: d }));
}

export default function ProLimitSheet({ onOpenPro }: { onOpenPro: () => void }) {
  const [d, setD] = useState<ProLimitDetail | null>(null);

  useEffect(() => {
    const on = (e: Event) => setD((e as CustomEvent<ProLimitDetail>).detail || null);
    window.addEventListener("nova:pro-limit", on);
    return () => window.removeEventListener("nova:pro-limit", on);
  }, []);

  if (!d) return null;
  if (d.kind === "original") {
    return (
      <div className="fixed inset-0 z-[330] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 animate-fade-in" onClick={() => setD(null)}>
        <div className="w-full max-w-sm glass-strong rounded-3xl p-5 animate-scale-in text-center" onClick={(e) => e.stopPropagation()} style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}>
            <Icon name="ImageUp" fallback="Image" size={26} className="text-white" />
          </div>
          <h3 className="font-bold text-lg mb-1">Фото в исходном качестве</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Без подписки фото сжимаются. С <b className="text-foreground">Nova Pro</b> можно отправлять фото и видео в оригинале — без потери качества и размера.
          </p>
          <button onClick={() => { setD(null); onOpenPro(); }} className="w-full py-3 rounded-2xl text-white font-bold mb-2 shadow-lg shadow-violet-600/30" style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}>
            Подключить Nova Pro
          </button>
          <button onClick={() => setD(null)} className="w-full py-2.5 rounded-2xl glass text-sm font-semibold">Не сейчас</button>
        </div>
      </div>
    );
  }
  const pins = d.kind === "pins";
  const free = pins ? d.pins_free : d.folders_free;
  const pro = pins ? d.pins_pro : d.folders_pro;
  return (
    <div className="fixed inset-0 z-[330] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 animate-fade-in" onClick={() => setD(null)}>
      <div className="w-full max-w-sm glass-strong rounded-3xl p-5 animate-scale-in text-center" onClick={(e) => e.stopPropagation()} style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}>
          <Icon name={pins ? "Pin" : "FolderPlus"} fallback="Folder" size={26} className="text-white" />
        </div>
        <h3 className="font-bold text-lg mb-1">{pins ? "Закреплено максимум чатов" : "Создано максимум папок"}</h3>
        <p className="text-sm text-muted-foreground mb-5">
          {d.is_pro
            ? d.message || (pins ? "Открепите один из чатов, чтобы закрепить новый." : "Удалите одну из папок, чтобы создать новую.")
            : <>Без подписки — до {free} {pins ? "закреплённых чатов" : "папок"}. С <b className="text-foreground">Nova Pro</b> — до {pro}.</>}
        </p>
        {!d.is_pro && (
          <button
            onClick={() => { setD(null); onOpenPro(); }}
            className="w-full py-3 rounded-2xl text-white font-bold mb-2 shadow-lg shadow-violet-600/30"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}
          >
            Подключить Nova Pro
          </button>
        )}
        <button onClick={() => setD(null)} className="w-full py-2.5 rounded-2xl glass text-sm font-semibold">
          {d.is_pro ? "Понятно" : "Не сейчас"}
        </button>
      </div>
    </div>
  );
}
