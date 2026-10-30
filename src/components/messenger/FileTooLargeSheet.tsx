import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { formatMb } from "@/lib/api";

type Detail = { message: string; isPro: boolean; proMb: number; limitMb: number };

export default function FileTooLargeSheet({ onOpenPro }: { onOpenPro: () => void }) {
  const [d, setD] = useState<Detail | null>(null);

  useEffect(() => {
    const on = (e: Event) => setD((e as CustomEvent<Detail>).detail || null);
    window.addEventListener("nova:file-too-large", on);
    return () => window.removeEventListener("nova:file-too-large", on);
  }, []);

  if (!d) return null;
  return (
    <div className="fixed inset-0 z-[330] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 animate-fade-in" onClick={() => setD(null)}>
      <div className="w-full max-w-sm glass-strong rounded-3xl p-5 animate-scale-in text-center" onClick={e => e.stopPropagation()} style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}>
          <Icon name={d.isPro ? "FileWarning" : "Zap"} fallback="File" size={26} className="text-white" />
        </div>
        <h3 className="font-bold text-lg mb-1">Файл слишком большой</h3>
        <p className="text-sm text-muted-foreground mb-5">
          {d.isPro
            ? d.message
            : <>Без подписки можно отправлять файлы до {formatMb(d.limitMb)}. С <b className="text-foreground">Nova Pro</b> — до {formatMb(d.proMb)}: длинные видео, архивы и документы.</>}
        </p>
        {!d.isPro && (
          <button
            onClick={() => { setD(null); onOpenPro(); }}
            className="w-full py-3 rounded-2xl text-white font-bold mb-2 shadow-lg shadow-violet-600/30"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}
          >
            Подключить Nova Pro
          </button>
        )}
        <button onClick={() => setD(null)} className="w-full py-2.5 rounded-2xl glass text-sm font-semibold">
          {d.isPro ? "Понятно" : "Не сейчас"}
        </button>
      </div>
    </div>
  );
}
