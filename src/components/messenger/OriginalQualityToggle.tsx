import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { getSendOriginal, setSendOriginal } from "@/lib/originalQuality";
import { showProLimit } from "@/components/messenger/ProLimitSheet";

export default function OriginalQualityToggle({ isPro }: { isPro: boolean }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(getSendOriginal());
    const h = (e: Event) => setOn(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener("nova:send-original", h);
    return () => window.removeEventListener("nova:send-original", h);
  }, []);

  useEffect(() => {
    if (!isPro && getSendOriginal()) setSendOriginal(false);
  }, [isPro]);

  const active = isPro && on;

  return (
    <button
      type="button"
      onClick={() => {
        if (!isPro) { showProLimit({ kind: "original", is_pro: false }); return; }
        setSendOriginal(!on);
      }}
      className={`w-full mb-2 flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${active ? "bg-violet-500/15 ring-1 ring-violet-500/40" : "glass hover:bg-white/8"}`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? "grad-primary" : "bg-white/8"}`}>
        <Icon name="ImageUp" fallback="Image" size={16} className={active ? "text-white" : "text-muted-foreground"} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold flex items-center gap-1.5">
          Фото и видео в оригинале
          {!isPro && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}>PRO</span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {active ? "Без сжатия — полное качество и размер" : "Сейчас фото сжимаются для быстрой отправки"}
        </div>
      </div>
      <span className={`w-10 h-6 rounded-full p-0.5 transition-colors flex-shrink-0 ${active ? "bg-violet-500" : "bg-white/15"}`}>
        <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${active ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}
