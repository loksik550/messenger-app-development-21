import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { IconName } from "@/lib/api";

interface Faq {
  icon: IconName;
  q: string;
  a: string;
}

const FAQ: Faq[] = [
  {
    icon: "UserPlus",
    q: "Как начать переписку?",
    a: "Откройте вкладку «Контакты» и нажмите «Импортировать контакты» — Nova покажет, кто из ваших знакомых уже пользуется мессенджером. Можно также добавить человека вручную по номеру телефона.",
  },
  {
    icon: "Phone",
    q: "Как позвонить собеседнику?",
    a: "Откройте чат и нажмите значок телефона в верхней части экрана — для голосового звонка, или значок камеры — для видеозвонка. Для звонков нужен доступ к микрофону и камере.",
  },
  {
    icon: "Users",
    q: "Чем группа отличается от канала?",
    a: "В группе писать могут все участники — это общий чат. В канале публикации размещает только владелец и администраторы, остальные читают. Создать и то, и другое можно кнопкой «Создать группу или канал».",
  },
  {
    icon: "Timer",
    q: "Что такое исчезающие сообщения?",
    a: "В настройках чата можно включить таймер — от 10 секунд до 7 дней. Сообщения будут автоматически удаляться у обоих собеседников по истечении выбранного времени.",
  },
  {
    icon: "Sparkles",
    q: "Как работают истории?",
    a: "История видна 24 часа, после чего удаляется автоматически. Опубликовать её можно из вкладки «Истории». Вы всегда можете посмотреть, кто её просмотрел.",
  },
  {
    icon: "ShieldCheck",
    q: "Как защитить приложение от посторонних?",
    a: "В разделе «Настройки → Приватность и безопасность» включите PIN-код на вход. Если ваш телефон поддерживает отпечаток пальца или распознавание лица, можно использовать и их.",
  },
  {
    icon: "Ban",
    q: "Что делать, если собеседник ведёт себя недопустимо?",
    a: "Откройте профиль собеседника и выберите «Заблокировать» — он больше не сможет писать и звонить. Также нажмите «Пожаловаться» и укажите причину: жалобы рассматриваются в течение 24 часов.",
  },
  {
    icon: "Bell",
    q: "Не приходят уведомления. Что проверить?",
    a: "Убедитесь, что уведомления разрешены в настройках телефона для Nova, а в самом приложении включены в разделе «Уведомления». Проверьте также, не заглушён ли конкретный чат и не включены ли тихие часы.",
  },
  {
    icon: "Trash2",
    q: "Как удалить аккаунт?",
    a: "«Настройки → Удалить аккаунт». Удаление безвозвратно: стираются профиль, все переписки, контакты и загруженные файлы. Восстановить данные после этого невозможно.",
  },
];

interface Props {
  onBack: () => void;
  onOpenSupport?: () => void;
}

export default function HelpPanel({ onBack, onOpenSupport }: Props) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="flex flex-col h-full max-h-[100dvh] bg-background overflow-hidden">
      <header
        className="flex items-center gap-3 px-4 pb-3 border-b border-border shrink-0"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-accent transition"
          aria-label="Назад"
        >
          <Icon name="ArrowLeft" size={20} />
        </button>
        <h1 className="text-lg font-semibold">Помощь</h1>
      </header>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}
      >
        <p className="text-sm text-muted-foreground mb-4">
          Ответы на частые вопросы о работе Nova.
        </p>

        <div className="space-y-2">
          {FAQ.map((item, i) => {
            const expanded = open === i;
            return (
              <div
                key={item.q}
                className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden"
              >
                <button
                  onClick={() => setOpen(expanded ? null : i)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5 transition"
                >
                  <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                    <Icon name={item.icon} size={18} className="text-violet-400" />
                  </div>
                  <span className="flex-1 text-sm font-medium">{item.q}</span>
                  <Icon
                    name="ChevronDown"
                    size={18}
                    className={`text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
                {expanded && (
                  <div className="px-4 pb-4 pl-16 text-sm text-muted-foreground leading-relaxed animate-fade-in">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {onOpenSupport && (
          <button
            onClick={onOpenSupport}
            className="w-full mt-4 flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-dashed border-white/15 hover:bg-white/5 transition"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Icon name="LifeBuoy" size={18} className="text-emerald-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Не нашли ответ?</div>
              <div className="text-xs text-muted-foreground">Напишите в поддержку — ответим лично</div>
            </div>
            <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}