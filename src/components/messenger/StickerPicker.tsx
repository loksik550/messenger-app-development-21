import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";

interface MyPack {
  id: number;
  title: string;
  cover_url?: string | null;
}
interface PackDetail {
  id: number;
  title: string;
  items: { id: number; emoji: string; image_url: string; position: number }[];
}

export default function StickerPicker({ currentUser, onPick, onClose, onOpenStore }: {
  currentUser: User;
  onPick: (item: { pack_id: number; sticker_id: number; image_url: string; emoji?: string }) => void;
  onClose: () => void;
  onOpenStore: () => void;
}) {
  const [packs, setPacks] = useState<MyPack[]>([]);
  const [activePack, setActivePack] = useState<PackDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await api("stickers_my", {}, currentUser.id);
      const list: MyPack[] = Array.isArray(r.packs) ? r.packs : [];
      setPacks(list);
      if (list.length > 0) {
        const d = await api("stickers_pack_get", { pack_id: list[0].id }, currentUser.id);
        if (d.pack) setActivePack(d.pack as PackDetail);
      }
      setLoading(false);
    })();
  }, [currentUser.id]);

  const switchPack = async (id: number) => {
    const d = await api("stickers_pack_get", { pack_id: id }, currentUser.id);
    if (d.pack) setActivePack(d.pack as PackDetail);
  };

  return (
    <div className="-mx-3 mt-1.5 border-t border-white/5 flex flex-col animate-fade-in"
      style={{ height: 290 }}
      onClick={e => e.stopPropagation()}>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Загружаем...</div>
      ) : packs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Icon name="Palette" size={28} className="text-pink-400 mx-auto mb-2 opacity-60" />
          <div className="text-xs text-muted-foreground mb-3">У тебя пока нет стикеров</div>
          <button onClick={onOpenStore}
            className="px-4 py-2 rounded-xl grad-primary text-white text-xs font-bold">
            Открыть магазин
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-2">
            {activePack && activePack.items.length > 0 ? (
              <div className="grid grid-cols-5 gap-1.5">
                {activePack.items.map(it => (
                  <button key={it.id}
                    onClick={() => onPick({ pack_id: activePack.id, sticker_id: it.id, image_url: it.image_url, emoji: it.emoji })}
                    className="aspect-square rounded-lg hover:bg-white/10 active:scale-90 transition p-0.5 flex items-center justify-center">
                    <img src={it.image_url} alt={it.emoji} className="w-full h-full object-contain" draggable={false} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-4">В этом паке нет стикеров</div>
            )}
          </div>

          {/* Pack tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-t border-white/5 overflow-x-auto flex-shrink-0">
            {packs.map(p => (
              <button key={p.id} onClick={() => switchPack(p.id)}
                className={`flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden transition ${
                  activePack?.id === p.id ? "ring-2 ring-violet-400" : "opacity-60 hover:opacity-100"
                }`}>
                {p.cover_url ? (
                  <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center text-base">🎨</div>
                )}
              </button>
            ))}
            <button onClick={onOpenStore}
              className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-violet-400">
              <Icon name="Plus" size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}