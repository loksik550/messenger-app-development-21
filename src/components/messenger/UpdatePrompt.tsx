import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";

const SNOOZE_KEY = "nova_update_snooze";

function cmp(a: string, b: string) {
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

export default function UpdatePrompt() {
  const [info, setInfo] = useState<{ latest: string; current: string; notes: string[]; url: string } | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let alive = true;
    (async () => {
      try {
        const [app, r] = await Promise.all([App.getInfo(), api("app_version", {})]);
        const latest = String(r?.latest || "").replace(/^v/i, "");
        const current = String(app?.version || "");
        if (!alive || !latest || !current || cmp(latest, current) <= 0) return;
        const snooze = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "null") as { v: string; until: number } | null;
        if (snooze && snooze.v === latest && snooze.until > Date.now()) return;
        const notes = String(r?.whats_new || "")
          .split(/\n|[;•]|(?<=\.)\s+/)
          .map((s) => s.replace(/^[-–—*\s]+/, "").replace(/\.$/, "").trim())
          .filter((s) => s.length > 2)
          .slice(0, 4);
        setInfo({ latest, current, notes, url: r?.url || "https://www.rustore.ru/catalog/app/ru.nova.messenger" });
      } catch { /* нет сети — покажем в следующий раз */ }
    })();
    return () => { alive = false; };
  }, []);

  if (!info) return null;

  const later = () => {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify({ v: info.latest, until: Date.now() + 24 * 60 * 60 * 1000 }));
    setInfo(null);
  };

  const update = async () => {
    try {
      await Browser.open({ url: info.url });
    } catch {
      window.open(info.url, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-[395] bg-black/65 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-fade-in"
         style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
      <div className="glass-strong rounded-[28px] px-5 pt-6 pb-4 w-full max-w-sm text-center border border-violet-400/25 animate-scale-in">
        <div className="w-[72px] h-[72px] mx-auto mb-3.5 rounded-[22px] grad-primary flex items-center justify-center shadow-lg shadow-violet-600/40">
          <Icon name="Download" size={34} className="text-white" />
        </div>
        <h3 className="text-xl font-bold mb-1.5">Доступна новая версия</h3>
        <div className="inline-block text-xs text-violet-300 bg-violet-500/15 px-2.5 py-0.5 rounded-full mb-3">
          Nova {info.latest} · у вас {info.current}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3.5">
          Обновите приложение, чтобы получить новые функции и исправления.
        </p>
        {info.notes.length > 0 && (
          <ul className="text-left bg-white/[0.04] rounded-2xl px-3.5 py-2.5 mb-4 space-y-1">
            {info.notes.map((n, i) => (
              <li key={i} className="text-[13px] text-foreground/85 flex gap-2">
                <span className="text-violet-400">•</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={update}
          className="w-full py-3.5 rounded-[18px] bg-[#0077FF] hover:bg-[#0069e0] text-white font-bold text-[15px] flex items-center justify-center gap-2.5 mb-1"
        >
          <span className="w-[22px] h-[22px] rounded-md bg-white text-[#0077FF] text-[10px] font-black flex items-center justify-center">RS</span>
          Обновить в RuStore
        </button>
        <button onClick={later} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground">
          Позже
        </button>
      </div>
    </div>
  );
}
