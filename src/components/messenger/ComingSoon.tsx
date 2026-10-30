import { useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { IconName } from "@/lib/api";

interface Feature {
  id: string;
  title: string;
  desc: string;
  icon: IconName;
  color: string;
  status: "new" | "live" | "beta";
}

const FEATURES: Feature[] = [
  { id: "groups",      title: "Группы и каналы",            desc: "Каналы с подпиской, группы с админами/правами/закрепами, ссылки-приглашения, поиск по каналам.", icon: "Users",       color: "from-sky-500 to-cyan-500",     status: "live" },
  { id: "support",     title: "Поддержка через тикеты",    desc: "Профиль → Поддержка Nova. Пиши в поддержку, отвечают админы.",                                  icon: "LifeBuoy",    color: "from-violet-500 to-pink-500",  status: "live" },
  { id: "themes",      title: "Темы и кастомизация",       desc: "8 тем оформления, акцентные цвета, обои чата, размер шрифта, стили пузырей.",                  icon: "Palette",     color: "from-amber-500 to-rose-500",   status: "live" },
  { id: "privacy",     title: "Безопасность и приватность", desc: "PIN-код на вход, отчёты о прочтении, скрытие «был в сети» и фото, выход со всех устройств.",  icon: "ShieldCheck", color: "from-emerald-500 to-teal-500", status: "live" },
  { id: "saved",       title: "Избранное и заметки",        desc: "Сохраняй важное в личное хранилище — заметки, ссылки, идеи. Закрепляй нужное.",               icon: "Bookmark",    color: "from-yellow-500 to-orange-500", status: "new" },
  { id: "payments",    title: "Платежи и счета",            desc: "Выставляй счёт другу — он оплатит из кошелька в один тап. Подарки, сборы, молнии.",          icon: "ReceiptText", color: "from-emerald-500 to-green-600", status: "new" },
  { id: "notify",      title: "Уведомления",                desc: "Тонкая настройка: личные/группы/звонки, тихие часы, вибрация, выбор звука.",                  icon: "Bell",        color: "from-blue-500 to-indigo-500",  status: "live" },
  { id: "stickers",    title: "Стикеры",                    desc: "Магазин паков, авторские наборы, премиум.",                                                    icon: "Sticker",     color: "from-pink-500 to-fuchsia-600", status: "live" },
  { id: "stories",     title: "Истории",                    desc: "Делись моментами на 24 часа, реакции, ответы.",                                                icon: "Sparkles",    color: "from-orange-500 to-red-500",   status: "live" },
  { id: "calls",       title: "Аудио и видеозвонки",       desc: "WebRTC P2P, встроенные звонки прямо из чата.",                                                icon: "Phone",       color: "from-emerald-500 to-cyan-500", status: "live" },
  { id: "secret",      title: "Исчезающие сообщения",      desc: "Сообщения сами удаляются через выбранное время — 5 сек, 1 час, 1 день, неделя.",              icon: "Timer",       color: "from-zinc-500 to-zinc-700",    status: "live" },
];

export function ComingSoon({ open, onClose, focus }: { open: boolean; onClose: () => void; focus?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const items = focus ? FEATURES.filter(f => f.id === focus) : FEATURES;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="w-full max-w-lg bg-[#15151f] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Все возможности Nova</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8">
            <Icon name="X" size={16} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Полная функциональность готова и работает. Откройте профиль — там собраны все настройки.
        </p>
        <div className="space-y-2">
          {items.map(f => (
            <div key={f.id} className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center flex-shrink-0`}>
                <Icon name={f.icon} size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{f.title}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                    f.status === "live" ? "bg-emerald-500/20 text-emerald-300" :
                    f.status === "new" ? "bg-violet-500/20 text-violet-300" :
                    "bg-amber-500/20 text-amber-300"
                  }`}>
                    {f.status === "live" ? "АКТИВНО" : f.status === "new" ? "НОВОЕ" : "БЕТА"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ComingSoon;
