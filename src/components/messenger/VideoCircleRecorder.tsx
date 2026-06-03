import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

const MAX_SECONDS = 15;

export function VideoCircleRecorder({
  open,
  onClose,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  onRecorded: (file: File, duration: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const secsRef = useRef(0);
  useEffect(() => { secsRef.current = secs; }, [secs]);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setErr("Запись недоступна. Нужен https и современный браузер.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 360 }, height: { ideal: 360 }, facingMode: "user", frameRate: { ideal: 24, max: 30 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        const msg = (e as DOMException).name === "NotAllowedError"
          ? "Доступ к камере запрещён"
          : "Камера недоступна";
        setErr(msg);
      }
    };
    start();

    return () => {
      cancelled = true;
      cleanup();
    };
     
  }, [open]);

  const cleanup = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    streamRef.current?.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setSecs(0);
    setRecording(false);
  };

  const startRec = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    // Приоритет mp4 (iOS/Safari), затем webm (Android/Chrome)
    const candidates = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    let mime = "";
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported?.(c)) { mime = c; break; }
    }

    // Ограничиваем битрейт, чтобы кружок гарантированно влезал в лимит загрузки
    const opts: MediaRecorderOptions = { videoBitsPerSecond: 700_000, audioBitsPerSecond: 48_000 };
    if (mime) opts.mimeType = mime;
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(streamRef.current, opts);
    } catch {
      rec = mime ? new MediaRecorder(streamRef.current, { mimeType: mime }) : new MediaRecorder(streamRef.current);
    }
    recorderRef.current = rec;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      // Берём реальный тип от рекордера (на iOS это будет video/mp4, а не webm)
      const realType = rec.mimeType || mime || "video/webm";
      const ext = realType.includes("mp4") ? "mp4" : realType.includes("quicktime") ? "mov" : "webm";
      const blob = new Blob(chunksRef.current, { type: realType });
      const file = new File([blob], `circle_${Date.now()}.${ext}`, { type: realType });
      const dur = secsRef.current;
      cleanup();
      onClose();
      if (file.size <= 1024) {
        alert("Кружок не записался. Попробуй ещё раз.");
        return;
      }
      if (file.size > 4.5 * 1024 * 1024) {
        alert("Кружок получился слишком большой. Запиши покороче (до 10-15 секунд).");
        return;
      }
      onRecorded(file, dur);
    };
    rec.start();
    setRecording(true);
    setSecs(0);
    timerRef.current = setInterval(() => {
      setSecs(s => {
        const next = s + 1;
        if (next >= MAX_SECONDS) {
          stopRec();
          return MAX_SECONDS;
        }
        return next;
      });
    }, 1000);
  };

  const stopRec = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
  };

  const cancel = () => {
    chunksRef.current = [];
    cleanup();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in p-4">
      <div className="text-white text-sm mb-4 font-medium">
        {err
          ? err
          : recording
            ? `Запись… ${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")} / 00:${String(MAX_SECONDS).padStart(2, "0")}`
            : "Видео-сообщение"}
      </div>

      <div className="relative w-72 h-72 max-w-[80vw] max-h-[80vw] rounded-full overflow-hidden bg-zinc-900 border-4 border-violet-500/40 shadow-2xl shadow-violet-500/30">
        <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline autoPlay muted />
        {recording && (
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(239,68,68,0.3)" strokeWidth="2" />
            <circle
              cx="50" cy="50" r="48"
              fill="none"
              stroke="#ef4444"
              strokeWidth="3"
              strokeDasharray={`${(secs / MAX_SECONDS) * 301.6} 301.6`}
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      <div className="flex items-center gap-6 mt-8">
        <button
          onClick={cancel}
          className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
        >
          <Icon name="X" size={24} className="text-white" />
        </button>
        {!recording ? (
          <button
            onClick={startRec}
            disabled={!!err}
            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-30 flex items-center justify-center transition shadow-lg shadow-red-500/40"
          >
            <div className="w-10 h-10 rounded-full bg-white" />
          </button>
        ) : (
          <button
            onClick={stopRec}
            className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40 animate-pulse"
          >
            <div className="w-8 h-8 rounded-md bg-white" />
          </button>
        )}
        <div className="w-14 h-14" />
      </div>

      <p className="text-xs text-white/60 mt-6 text-center max-w-xs">
        Нажми кнопку для старта записи. Максимум {MAX_SECONDS} секунд.
      </p>
    </div>
  );
}

export default VideoCircleRecorder;