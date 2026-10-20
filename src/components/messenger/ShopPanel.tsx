import Icon from "@/components/ui/icon";
import { type User } from "@/lib/api";

interface ShopItem {
  key: string;
  title: string;
  desc: string;
  icon: string;
  gradient: string;
  onClick: () => void;
}

interface Props {
  currentUser: User;
  onBack?: () => void;
  onOpenPremium: () => void;
  onOpenPro: () => void;
  onOpenLightning: () => void;
  onOpenStickers: () => void;
  onOpenWallet: () => void;
}

export function ShopPanel({ currentUser, onBack, onOpenPremium, onOpenPro, onOpenLightning, onOpenStickers, onOpenWallet }: Props) {
  const items: ShopItem[] = [
    { key: "premium", title: "Premium", desc: "Все возможности Nova без ограничений", icon: "Crown", gradient: "linear-gradient(135deg, #f59e0b, #f97316)", onClick: onOpenPremium },
    { key: "pro", title: "Nova Pro", desc: "Эмодзи-статус, цвет имени, инкогнито", icon: "Sparkles", gradient: "linear-gradient(135deg, #8b5cf6, #6366f1)", onClick: onOpenPro },
    { key: "lightning", title: "Молнии", desc: "Валюта для подарков и реакций", icon: "Zap", gradient: "linear-gradient(135deg, #eab308, #f59e0b)", onClick: onOpenLightning },
    { key: "stickers", title: "Стикеры", desc: "Наборы стикеров для чатов", icon: "Smile", gradient: "linear-gradient(135deg, #ec4899, #8b5cf6)", onClick: onOpenStickers },
  ];

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="px-4 pb-3" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-xl hover:bg-white/8 transition-colors">
              <Icon name="ChevronLeft" size={20} />
            </button>
          )}
          <h2 className="text-xl font-bold">Магазин</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        <button
          onClick={onOpenWallet}
          className="w-full flex items-center gap-3 p-4 glass rounded-2xl hover:bg-white/8 transition-all text-left"
        >
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <Icon name="Wallet" size={20} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">Кошелёк</div>
            <div className="text-lg font-bold">{(currentUser.wallet_balance || 0).toLocaleString("ru-RU")} ₽</div>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 text-sm font-semibold">
            <Icon name="Zap" size={14} />
            {(currentUser.lightning_balance || 0).toLocaleString("ru-RU")}
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
        </button>

        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <button
              key={it.key}
              onClick={it.onClick}
              className="flex flex-col items-start gap-3 p-4 glass rounded-2xl hover:bg-white/8 active:scale-[0.98] transition-all text-left"
            >
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white" style={{ background: it.gradient }}>
                <Icon name={it.icon} size={20} />
              </div>
              <div>
                <div className="font-semibold text-sm">{it.title}</div>
                <div className="text-xs text-muted-foreground leading-snug mt-0.5">{it.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ShopPanel;
