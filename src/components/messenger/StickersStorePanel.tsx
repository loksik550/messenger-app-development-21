import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User, type StickerPack } from "@/lib/api";

interface Props {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (u: User) => void;
  onOpenAdmin?: () => void;
}

export default function StickersStorePanel({ currentUser, onClose, onUserUpdate, onOpenAdmin }: Props) {
  const [tab, setTab] = useState<"store" | "my">("store");
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [myPacks, setMyPacks] = useState<{ id: number; title: string; cover_url?: string | null; acquired_at: number }[]>([]);
  const [selected, setSelected] = useState<StickerPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSubModal, setShowSubModal] = useState(false);

  const subActive = (currentUser.stickers_subscription_until || 0) * 1000 > Date.now();

  const reload = async () => {
    setLoading(true);
    const [s, m] = await Promise.all([
      api("stickers_list", {}, currentUser.id),
      api("stickers_my", {}, currentUser.id),
    ]);
    if (Array.isArray(s.packs)) setPacks(s.packs);
    if (Array.isArray(m.packs)) setMyPacks(m.packs);
    setLoading(false);
  };

  useEffect(() => { reload();   }, [currentUser.id]);

  const openPack = async (id: number) => {
    const r = await api("stickers_pack_get", { pack_id: id }, currentUser.id);
    if (r.pack) setSelected(r.pack as StickerPack);
  };

  const buyPack = async () => {
    if (!selected) return;
    setError(""); setBusy(true);
    const r = await api("stickers_buy_pack", { pack_id: selected.id }, currentUser.id);
    setBusy(false);
    if (r.owned) {
      const userR = await api("get_me", {}, currentUser.id);
      if (userR.user) {
        onUserUpdate?.(userR.user);
        localStorage.setItem("nova_user", JSON.stringify(userR.user));
      }
      await reload();
      await openPack(selected.id);
    } else {
      if (selected.is_premium && !subActive) {
        setShowSubModal(true);
      } else {
        setError(r.error || "Ошибка покупки");
      }
    }
  };

  const subscribeStickers = async () => {
    setBusy(true); setError("");
    const r = await api("buy_stickers_subscription", {}, currentUser.id);
    setBusy(false);
    if (r.stickers_subscription_until) {
      const userR = await api("get_me", {}, currentUser.id);
      if (userR.user) {
        onUserUpdate?.(userR.user);
        localStorage.setItem("nova_user", JSON.stringify(userR.user));
      }
      setShowSubModal(false);
    } else {
      setError(r.error || "Ошибка");
    }
  };

  return (
    <div className="fixed inset-0 z-[260] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="font-bold flex-1 text-lg">Стикеры</h2>
        {onOpenAdmin && (
          <button onClick={onOpenAdmin} title="Добавить пак (для админов)"
            className="p-2 rounded-xl hover:bg-white/8 text-muted-foreground hover:text-violet-400">
            <Icon name="Plus" size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
        {/* Sub status */}
        {subActive ? (
          <div className="rounded-2xl p-3 flex items-center gap-3"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(236,72,153,0.15))", border: "1px solid rgba(245,158,11,0.25)" }}>
            <Icon name="Sparkles" size={18} className="text-amber-400" />
            <div className="flex-1">
              <div className="text-sm font-bold">Подписка активна</div>
              <div className="text-[11px] text-muted-foreground">
                Эксклюзивные паки доступны до {new Date((currentUser.stickers_subscription_until || 0) * 1000).toLocaleDateString("ru")}
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowSubModal(true)}
            className="w-full rounded-2xl p-3 text-left flex items-center gap-3"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.10), rgba(236,72,153,0.10))", border: "1px dashed rgba(245,158,11,0.35)" }}>
            <Icon name="Sparkles" size={18} className="text-amber-400" />
            <div className="flex-1">
              <div className="text-sm font-bold">Подписка на авторские стикеры</div>
              <div className="text-[11px] text-muted-foreground">100 ₽/мес — все эксклюзивные паки</div>
            </div>
            <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
          </button>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 rounded-2xl">
          <button onClick={() => setTab("store")}
            className={`py-2 rounded-xl text-sm font-bold transition ${tab === "store" ? "bg-white/15" : "text-muted-foreground"}`}>
            Магазин
          </button>
          <button onClick={() => setTab("my")}
            className={`py-2 rounded-xl text-sm font-bold transition ${tab === "my" ? "bg-white/15" : "text-muted-foreground"}`}>
            Мои паки ({myPacks.length})
          </button>
        </div>

        {loading && <div className="text-center text-sm text-muted-foreground py-8">Загружаем...</div>}

        {!loading && tab === "store" && (
          <div className="grid grid-cols-2 gap-3">
            {packs.length === 0 && (
              <div className="col-span-2 text-center text-sm text-muted-foreground py-8">
                Магазин пока пуст
              </div>
            )}
            {packs.map(p => (
              <button key={p.id} onClick={() => openPack(p.id)}
                className="glass rounded-2xl p-3 text-left active:scale-95 transition relative">
                {p.is_premium && (
                  <span className="absolute top-2 right-2 text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded">PRO</span>
                )}
                {p.owned && (
                  <span className="absolute top-2 left-2 text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded">МОЁ</span>
                )}
                <div className="aspect-square rounded-xl bg-white/5 mb-2 overflow-hidden flex items-center justify-center">
                  {p.cover_url ? <img src={p.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="text-4xl">🎨</span>}
                </div>
                <div className="text-sm font-bold truncate">{p.title}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">{p.total_sales} продаж</span>
                  <span className="text-xs font-black text-amber-400">
                    {p.is_premium ? "PRO" : p.price === 0 ? "Бесплатно" : `${p.price} ₽`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && tab === "my" && (
          <div className="grid grid-cols-2 gap-3">
            {myPacks.length === 0 && (
              <div className="col-span-2 text-center text-sm text-muted-foreground py-8">
                У тебя пока нет паков. Загляни в магазин ↑
              </div>
            )}
            {myPacks.map(p => (
              <div key={p.id} className="glass rounded-2xl p-3">
                <div className="aspect-square rounded-xl bg-white/5 mb-2 overflow-hidden flex items-center justify-center">
                  {p.cover_url ? <img src={p.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="text-4xl">🎨</span>}
                </div>
                <div className="text-sm font-bold truncate">{p.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pack details modal */}
      {selected && (
        <div className="fixed inset-0 z-[270] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelected(null)}>
          <div className="glass-strong rounded-3xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto animate-slide-up"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-16 h-16 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center flex-shrink-0">
                {selected.cover_url ? <img src={selected.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🎨</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-black">{selected.title}</div>
                <div className="text-xs text-muted-foreground">{selected.total_sales} продаж</div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-white/8">
                <Icon name="X" size={16} />
              </button>
            </div>
            {selected.description && <p className="text-xs text-muted-foreground mb-3">{selected.description}</p>}

            <div className="grid grid-cols-4 gap-2 mb-4">
              {(selected.items || []).map(it => (
                <div key={it.id} className="aspect-square rounded-xl bg-white/5 overflow-hidden flex items-center justify-center">
                  <img src={it.image_url} alt={it.emoji} className="w-full h-full object-contain" />
                </div>
              ))}
              {(!selected.items || selected.items.length === 0) && (
                <div className="col-span-4 text-center text-xs text-muted-foreground py-4">Стикеров пока нет</div>
              )}
            </div>

            {error && <p className="text-xs text-red-400 text-center mb-2">{error}</p>}

            {selected.owned ? (
              <div className="w-full py-3 rounded-2xl bg-emerald-500/15 text-emerald-400 text-center text-sm font-bold">
                ✓ В твоей коллекции
              </div>
            ) : (
              <button onClick={buyPack} disabled={busy}
                className="w-full py-3.5 rounded-2xl font-black text-white grad-primary disabled:opacity-50">
                {busy ? "Покупаем..."
                  : selected.is_premium ? (subActive ? "Получить (по подписке)" : "Оформить подписку 100 ₽/мес")
                  : selected.price === 0 ? "Получить бесплатно"
                  : `Купить за ${selected.price} ₽`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sub modal */}
      {showSubModal && (
        <div className="fixed inset-0 z-[280] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowSubModal(false)}>
          <div className="glass-strong rounded-3xl p-6 w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="text-5xl text-center mb-2">🎨</div>
            <h3 className="text-xl font-black text-center mb-2">Авторские стикеры</h3>
            <p className="text-xs text-muted-foreground text-center mb-4">
              Доступ ко всем эксклюзивным пакам от художников. Оплата с твоего кошелька Nova.
            </p>
            <div className="text-center mb-4">
              <div className="text-3xl font-black text-amber-400">100 ₽<span className="text-sm font-normal text-muted-foreground"> / месяц</span></div>
            </div>
            <div className="text-[11px] text-muted-foreground text-center mb-4">
              Кошелёк: {(currentUser.wallet_balance || 0).toFixed(2)} ₽
            </div>
            {error && <p className="text-xs text-red-400 text-center mb-2">{error}</p>}
            <button onClick={subscribeStickers} disabled={busy || (currentUser.wallet_balance || 0) < 100}
              className="w-full py-3 rounded-2xl font-black text-white grad-primary disabled:opacity-50">
              {busy ? "Оформляем..." : "Оформить за 100 ₽"}
            </button>
            <button onClick={() => setShowSubModal(false)} className="w-full py-2.5 mt-1 text-xs text-muted-foreground">
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}