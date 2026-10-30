import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { applySkin, getStoredSkinId, loadSkins, type Skin } from "@/lib/skins";

/** Тестовые темы мессенджера — видны только тем, кому открыли доступ в Dev-панели. */
export default function TestThemesPanel({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [skins, setSkins] = useState<Skin[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(getStoredSkinId());
    loadSkins(userId, true).then((r) => setSkins(r.skins));
  }, [userId]);

  const pick = (s: Skin | null) => { applySkin(s); setCurrent(s?.id || null); };

  return (
    <div className="fixed inset-0 z-[260] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[88%] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#12101c] text-white p-4 animate-scale-in"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-bold flex-1">Тестовые темы</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" aria-label="Закрыть"><Icon name="X" size={18} /></button>
        </div>
        <p className="text-xs text-slate-400 mb-4">Темы в разработке. Их видите только вы и те, кому открыт доступ.</p>
        {!skins ? (
          <div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" /></div>
        ) : skins.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Тем пока нет — добавьте их в Dev-панели</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {skins.map((s) => (
              <button
                key={s.id}
                onClick={() => pick(s)}
                className={`relative rounded-2xl overflow-hidden aspect-[9/16] border-2 transition ${current === s.id ? "border-violet-500" : "border-transparent"}`}
              >
                <img src={s.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 to-transparent text-left">
                  <div className="text-xs font-bold">{s.name}</div>
                </div>
                {current === s.id && (
                  <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center"><Icon name="Check" size={14} /></span>
                )}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => pick(null)}
          className={`w-full mt-4 py-3 rounded-2xl text-sm font-semibold ${current ? "bg-white/10" : "bg-white/5 text-slate-500"}`}
          disabled={!current}
        >
          Вернуть обычный вид
        </button>
      </div>
    </div>
  );
}
