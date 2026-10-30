import Icon from "@/components/ui/icon";

interface ShopItem {
  key: string;
  title: string;
  desc: string;
  icon: string;
  gradient: string;
}

interface Props {
  onBack?: () => void;
}

export function ShopPanel({ onBack }: Props) {
  const items: ShopItem[] = [
    { key: "premium", title: "Premium", desc: "Все возможности Nova без ограничений", icon: "Crown", gradient: "linear-gradient(135deg, #f59e0b, #f97316)" },
    { key: "pro", title: "Nova Pro", desc: "Значок Pro, цветной ник, инкогнито, большие файлы", icon: "Sparkles", gradient: "linear-gradient(135deg, #8b5cf6, #6366f1)" },
    { key: "lightning", title: "Молнии", desc: "Валюта для подарков и реакций", icon: "Zap", gradient: "linear-gradient(135deg, #eab308, #f59e0b)" },
    { key: "stickers", title: "Стикеры", desc: "Наборы стикеров для чатов", icon: "Smile", gradient: "linear-gradient(135deg, #ec4899, #8b5cf6)" },
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
        <div className="flex flex-col items-center text-center pt-6 pb-2">
          <div className="w-20 h-20 grad-primary rounded-3xl flex items-center justify-center glow-primary animate-float mb-5">
            <Icon name="ShoppingBag" size={36} className="text-white" />
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold uppercase tracking-widest mb-3">Скоро</span>
          <h3 className="text-2xl font-bold grad-text mb-2">Магазин скоро откроется</h3>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Мы готовим подарки, стикеры и улучшения для вашего Nova. Загляните сюда чуть позже.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <div
              key={it.key}
              className="relative flex flex-col items-start gap-3 p-4 glass rounded-2xl text-left opacity-70"
            >
              <span className="absolute top-3 right-3 text-[9px] px-1.5 py-0.5 rounded-md bg-white/10 text-muted-foreground font-bold uppercase">Скоро</span>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white" style={{ background: it.gradient }}>
                <Icon name={it.icon} size={20} />
              </div>
              <div>
                <div className="font-semibold text-sm">{it.title}</div>
                <div className="text-xs text-muted-foreground leading-snug mt-0.5">{it.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ShopPanel;
