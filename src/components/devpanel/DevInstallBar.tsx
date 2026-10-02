import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { useDevPwa } from "@/lib/devPwa";

const HIDE_KEY = "nova_dev_install_hidden";

export default function DevInstallBar({ pwa }: { pwa: ReturnType<typeof useDevPwa> }) {
  const [hidden, setHidden] = useState(() => localStorage.getItem(HIDE_KEY) === "1");
  const [updating, setUpdating] = useState(false);

  if (pwa.updateReady) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl bg-[#14151f] border border-violet-500/40 shadow-2xl shadow-black/50 animate-fade-in">
        <Icon name="Sparkles" size={16} className="text-violet-300 shrink-0" />
        <span className="text-sm text-slate-200">Вышла новая версия панели</span>
        <button
          onClick={() => { setUpdating(true); pwa.applyUpdate(); }}
          disabled={updating}
          className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-60"
        >
          {updating ? "Обновляем…" : "Обновить"}
        </button>
      </div>
    );
  }

  if (!pwa.canInstall || pwa.installed || hidden) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[300] flex items-center gap-3 pl-3 pr-2 py-2 rounded-2xl bg-[#14151f] border border-white/10 shadow-2xl shadow-black/50 animate-fade-in">
      <img src="/dev-icon-192.png" alt="" className="w-9 h-9 rounded-xl" />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-100">Nova Dev на рабочий стол</div>
        <div className="text-[11px] text-slate-400">Отдельное окно, иконка, обновления сами</div>
      </div>
      <button
        onClick={() => pwa.install()}
        className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5"
      >
        <Icon name="Download" size={13} /> Установить
      </button>
      <button
        onClick={() => { localStorage.setItem(HIDE_KEY, "1"); setHidden(true); }}
        title="Скрыть"
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5"
      >
        <Icon name="X" size={14} />
      </button>
    </div>
  );
}
