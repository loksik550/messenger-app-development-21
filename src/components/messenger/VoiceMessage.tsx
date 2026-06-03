import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

function generateBars(seed: string, count = 32): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (Math.imul(1664525, h) + 1013904223) | 0;
    const v = ((h >>> 0) % 80) + 20;
    bars.push(v);
  }
  return bars;
}

const SPEED_KEY = "nova_voice_speed";
const SPEEDS = [1, 1.5, 2] as const;

export function VoiceMessage({ url, out, knownDuration }: { url: string; out: boolean; knownDuration?: number }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(knownDuration && isFinite(knownDuration) ? knownDuration : 0);
  const [curTime, setCurTime] = useState(0);
  const [speed, setSpeed] = useState<number>(() => {
    const v = Number(localStorage.getItem(SPEED_KEY));
    return SPEEDS.includes(v as 1 | 1.5 | 2) ? v : 1;
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  const bars = useRef(generateBars(url, 32)).current;

  useEffect(() => {
    const a = audioRef.current;
    return () => { a?.pause(); };
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = speed;
  }, [speed]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = speed;
    if (a.paused) {
      // Если запись закончилась — начинаем сначала
      if (a.ended || (duration && a.currentTime >= duration - 0.05)) {
        try { a.currentTime = 0; } catch { /* ignore */ }
      }
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  };

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed as 1 | 1.5 | 2);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
    try { localStorage.setItem(SPEED_KEY, String(next)); } catch { /* ignore */ }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  const filledBars = Math.round(progress * bars.length);
  const activeColor = out ? "rgba(255,255,255,0.95)" : "#a78bfa";
  const inactiveColor = out ? "rgba(255,255,255,0.35)" : "rgba(167,139,250,0.35)";

  return (
    <div
      className="flex items-center gap-3 px-1 py-1"
      style={{ minWidth: 220 }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
        style={{ background: out ? "rgba(255,255,255,0.22)" : "rgba(139,92,246,0.25)" }}
      >
        <Icon
          name={playing ? "Pause" : "Play"}
          size={18}
          className={out ? "text-white" : "text-violet-400"}
        />
      </button>

      <div className="flex-1 min-w-0">
        <div
          className="flex items-end gap-[2px] h-7 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); seek(e); }}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-full"
              style={{
                height: `${h}%`,
                minWidth: 2,
                background: i < filledBars ? activeColor : inactiveColor,
                transition: "background 0.1s",
              }}
            />
          ))}
        </div>
        <div
          className="text-[10px] tabular-nums mt-1"
          style={{ color: out ? "rgba(255,255,255,0.7)" : "hsl(var(--muted-foreground))" }}
        >
          {fmt(curTime > 0 ? curTime : duration)}
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); cycleSpeed(); }}
        className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums active:scale-95 transition-transform"
        style={{
          background: speed === 1 ? "transparent" : (out ? "rgba(255,255,255,0.22)" : "rgba(139,92,246,0.25)"),
          color: speed === 1
            ? (out ? "rgba(255,255,255,0.6)" : "hsl(var(--muted-foreground))")
            : (out ? "#fff" : "#a78bfa"),
          border: speed === 1 ? `1px solid ${out ? "rgba(255,255,255,0.3)" : "rgba(167,139,250,0.4)"}` : "none",
        }}
        title="Скорость воспроизведения"
      >
        {speed}×
      </button>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const a = e.currentTarget;
          const d = a.duration;
          if (isFinite(d) && d > 0) {
            setDuration(d);
          } else if (d === Infinity) {
            // Трюк для WebM/Opus без длительности: форсируем подсчёт
            const onSeeked = () => {
              if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration);
              a.currentTime = 0;
              a.removeEventListener("seeked", onSeeked);
            };
            a.addEventListener("seeked", onSeeked);
            try { a.currentTime = 1e101; } catch { /* ignore */ }
          }
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (!isFinite(a.currentTime)) return;
          setCurTime(a.currentTime);
          const dur = isFinite(a.duration) && a.duration > 0 ? a.duration : duration;
          if (dur > 0) setProgress(Math.min(1, a.currentTime / dur));
        }}
        onEnded={() => { setPlaying(false); setProgress(0); setCurTime(0); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}