import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";
import { native } from "@/lib/native";
import { APP_VERSION } from "@/lib/version";
import { NovaUpdate, RUSTORE_URL, cmpVersion, hasInAppUpdate } from "@/lib/appUpdate";

const SNOOZE_KEY = "nova_update_snooze";
const DONE_KEY = "nova_update_pending";

type Phase = "offer" | "downloading" | "installing" | "done" | "error";

/** Плашка снизу «Вышло обновление Nova». В приложении из RuStore обновляет прямо внутри, иначе открывает RuStore. */
export default function UpdateBanner() {
  const [latest, setLatest] = useState("");
  const [phase, setPhase] = useState<Phase | null>(null);
  const [progress, setProgress] = useState(0);
  const [doneVersion, setDoneVersion] = useState("");
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    (async () => {
      const isNative = Capacitor.isNativePlatform();
      const installed = isNative ? (await App.getInfo().catch(() => ({ version: APP_VERSION }))).version : APP_VERSION;

      const pending = localStorage.getItem(DONE_KEY);
      if (pending) {
        localStorage.removeItem(DONE_KEY);
        if (cmpVersion(installed, pending) >= 0) {
          setDoneVersion(installed);
          setPhase("done");
          return;
        }
      }
      if (!isNative) return;

      const r = await api("app_version", {}).catch(() => null);
      const lv = String(r?.latest || "");
      if (!lv || cmpVersion(lv, installed) <= 0) return;
      const snooze = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "null") as { v: string; until: number } | null;
      if (snooze && snooze.v === lv && Date.now() < snooze.until) return;
      setLatest(lv);
      setPhase("offer");
    })();
  }, []);

  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => setPhase(null), 6000);
    return () => clearTimeout(t);
  }, [phase]);

  const later = () => {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify({ v: latest, until: Date.now() + 24 * 3600 * 1000 }));
    setPhase(null);
  };

  const openStore = () => { native.openUrl(RUSTORE_URL); setPhase(null); };

  const update = async () => {
    if (!hasInAppUpdate()) { openStore(); return; }
    try {
      const info = await NovaUpdate.check();
      if (!info.available && !info.downloaded) { openStore(); return; }
      localStorage.setItem(DONE_KEY, latest);
      if (info.downloaded) {
        setPhase("installing");
        await NovaUpdate.complete();
        return;
      }
      setPhase("downloading");
      setProgress(0);
      const sub = await NovaUpdate.addListener("state", async (s) => {
        if (s.status === "downloading") setProgress(s.progress);
        if (s.status === "downloaded") {
          sub.remove();
          setProgress(100);
          setPhase("installing");
          await NovaUpdate.complete().catch(() => setPhase("error"));
        }
        if (s.status === "failed") { sub.remove(); localStorage.removeItem(DONE_KEY); setPhase("error"); }
      });
      await NovaUpdate.start();
    } catch {
      localStorage.removeItem(DONE_KEY);
      setPhase("error");
    }
  };

  if (!phase) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[400] flex justify-center px-3 pointer-events-none"
      style={{ paddingBottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#17142a]/95 backdrop-blur-xl text-white shadow-2xl shadow-black/50 p-3.5 animate-fade-in">
        {phase === "done" ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0"><Icon name="CircleCheck" size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">Приложение обновлено</div>
              <div className="text-xs text-slate-400">Nova v{doneVersion} — приятного общения!</div>
            </div>
            <button onClick={() => setPhase(null)} className="p-1.5 text-slate-400" aria-label="Закрыть"><Icon name="X" size={16} /></button>
          </div>
        ) : phase === "error" ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0"><Icon name="TriangleAlert" size={20} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">Не получилось обновить</div>
              <div className="text-xs text-slate-400">Обновите Nova через RuStore</div>
            </div>
            <button onClick={openStore} className="px-3.5 py-2 rounded-xl grad-primary text-white text-xs font-bold">RuStore</button>
          </div>
        ) : phase === "offer" ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl grad-primary flex items-center justify-center flex-shrink-0"><Icon name="Download" size={20} className="text-white" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">Вышло обновление Nova v{latest}</div>
              <button onClick={later} className="text-xs text-slate-400">Позже</button>
            </div>
            <button onClick={update} className="px-4 py-2 rounded-xl grad-primary text-white text-sm font-bold">Обновить</button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <div className="w-5 h-5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{phase === "installing" ? "Устанавливаем обновление..." : `Загружаем Nova v${latest}`}</div>
                <div className="text-xs text-slate-400">{phase === "installing" ? "Приложение перезапустится само" : `${progress}% · можно продолжать общение`}</div>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 mt-3 overflow-hidden">
              <div className="h-full rounded-full grad-primary transition-all duration-300" style={{ width: `${phase === "installing" ? 100 : Math.max(4, progress)}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
