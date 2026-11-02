import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, uploadAny, FileTooLargeError } from "@/lib/api";
import type { WatchState } from "./watchTypes";

const YT_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/;

export default function WatchStartSheet({
  chatId, userId, onStarted, onClose,
}: {
  chatId: number;
  userId: number;
  onStarted: (st: WatchState) => void;
  onClose: () => void;
}) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const start = async (source: "youtube" | "file", url: string, title = "") => {
    setBusy(true); setError("");
    const r = await api("watch_start", { chat_id: chatId, source, url, title }, userId).catch(() => null);
    setBusy(false);
    if (r?.watch) { onStarted(r.watch); onClose(); }
    else setError(r?.error || "Не удалось запустить. Попробуйте ещё раз.");
  };

  const startLink = () => {
    const v = link.trim();
    if (!v) { setError("Вставьте ссылку на видео"); return; }
    if (YT_RE.test(v)) { start("youtube", v); return; }
    if (/^https:\/\/\S+\.(mp4|webm|mov|m4v)(\?\S*)?$/i.test(v)) { start("file", v, decodeURIComponent(v.split("/").pop()?.split("?")[0] || "")); return; }
    setError("Подходят ссылки YouTube или прямые ссылки на файл .mp4 / .webm");
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("video/")) { setError("Выберите видеофайл"); return; }
    setBusy(true); setError(""); setProgress(0);
    try {
      const res = await uploadAny(f, userId, (d, t) => setProgress(Math.round((d / t) * 100)), { original: true });
      setProgress(null);
      await start("file", res.url, f.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      setProgress(null); setBusy(false);
      setError(err instanceof FileTooLargeError ? err.message : "Не удалось загрузить видео");
    }
  };

  return (
    <div className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={() => !busy && onClose()}>
      <div className="glass-strong w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 animate-scale-in" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-violet-500/15 text-violet-400 flex items-center justify-center">
            <Icon name="MonitorPlay" size={22} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold">Смотреть вместе</h3>
            <p className="text-xs text-muted-foreground">Видео будет идти у вас обоих одновременно</p>
          </div>
          <button onClick={onClose} disabled={busy} className="p-2 rounded-xl hover:bg-white/8"><Icon name="X" size={18} /></button>
        </div>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl glass hover:bg-white/8 transition text-left disabled:opacity-60"
        >
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center"><Icon name="Film" size={18} /></div>
          <div className="flex-1">
            <div className="text-sm font-medium">Фильм или видео с телефона</div>
            <div className="text-xs text-muted-foreground">
              {progress !== null ? `Загрузка… ${progress}%` : "MP4, MOV, WEBM — в пределах лимита файлов"}
            </div>
          </div>
        </button>
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onFile} />

        <div className="flex items-center gap-2 my-4 text-[11px] text-muted-foreground">
          <div className="flex-1 h-px bg-white/10" /> или ссылка <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startLink()}
            placeholder="Ссылка YouTube или .mp4"
            disabled={busy}
            className="flex-1 min-w-0 px-3.5 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm outline-none focus:border-violet-500/60"
          />
          <button onClick={startLink} disabled={busy} className="px-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-60">
            Начать
          </button>
        </div>

        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </div>
    </div>
  );
}
