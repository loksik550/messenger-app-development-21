import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { IconName } from "@/lib/api";

interface Rule {
  icon: IconName;
  color: string;
  q: string;
  a: string;
}

const RULES: Rule[] = [
  {
    icon: "UserCheck",
    color: "#8b5cf6",
    q: "Какое имя можно указать при регистрации?",
    a: "Указывайте настоящее имя — так, как вас зовут знакомые. Имя может состоять только из букв (русских или латинских), между словами — один пробел. Например: «Анна», «Иван Петров».",
  },
  {
    icon: "Ban",
    color: "#ef4444",
    q: "Какие имена запрещены?",
    a: "Нельзя использовать точки, тире, цифры, смайлы и другие символы вместо имени («..», «---», «Vladimir777»). Запрещены маты, оскорбления, имена известных людей и чужие имена, названия брендов и слова, вводящие в заблуждение («Администратор», «Поддержка Nova»).",
  },
  {
    icon: "Clock",
    color: "#f59e0b",
    q: "Что будет, если имя не по правилам?",
    a: "Приложение попросит сменить имя. На это даётся 72 часа. Если за это время имя не изменить, аккаунт будет удалён автоматически.",
  },
  {
    icon: "Image",
    color: "#06b6d4",
    q: "Какое фото можно ставить на аватар?",
    a: "Своё фото или любую нейтральную картинку. Запрещены изображения насилия, обнажённости, символика запрещённых организаций, чужие фото с целью выдать себя за другого человека.",
  },
  {
    icon: "MessageSquareWarning",
    color: "#f97316",
    q: "Как нужно общаться?",
    a: "Уважайте собеседников. Запрещены оскорбления, травля, угрозы, разжигание вражды, мат в адрес других людей и в публичных группах и каналах.",
  },
  {
    icon: "MailX",
    color: "#ec4899",
    q: "Можно ли рассылать рекламу?",
    a: "Нет. Запрещены спам, массовые рассылки незнакомым людям, мошенничество, фишинговые ссылки, продажа запрещённых товаров и услуг.",
  },
  {
    icon: "Lock",
    color: "#10b981",
    q: "Можно ли передавать аккаунт другому человеку?",
    a: "Нет. Аккаунт личный: не сообщайте никому пароль и коды, не продавайте и не передавайте аккаунт. Сотрудники Nova никогда не спрашивают ваш пароль.",
  },
  {
    icon: "Flag",
    color: "#64748b",
    q: "Что делать, если кто-то нарушает правила?",
    a: "Откройте профиль человека и нажмите «Пожаловаться», укажите причину. Модераторы проверяют жалобы и могут заблокировать нарушителя. Также его можно заблокировать самостоятельно.",
  },
  {
    icon: "ShieldAlert",
    color: "#dc2626",
    q: "Какие бывают наказания?",
    a: "В зависимости от нарушения: предупреждение, временная блокировка или удаление аккаунта без возможности восстановления.",
  },
];

export default function RulesPanel({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-background animate-fade-in">
      <header
        className="flex items-center gap-3 px-4 pb-3 border-b border-border shrink-0"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-accent transition" aria-label="Назад">
          <Icon name="ArrowLeft" size={20} />
        </button>
        <h1 className="text-lg font-semibold">Правила Nova</h1>
      </header>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}
      >
        <div className="rounded-2xl bg-violet-500/10 border border-violet-500/20 p-4 mb-4 flex gap-3">
          <Icon name="BookOpen" size={20} className="text-violet-400 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Памятка о том, как пользоваться Nova правильно. Соблюдая правила, вы помогаете сделать мессенджер удобным и безопасным для всех.
          </p>
        </div>

        <div className="space-y-2">
          {RULES.map((item, i) => {
            const expanded = open === i;
            return (
              <div key={item.q} className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
                <button
                  onClick={() => setOpen(expanded ? null : i)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5 transition"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${item.color}26` }}
                  >
                    <Icon name={item.icon} fallback="CircleHelp" size={18} style={{ color: item.color }} />
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
      </div>
    </div>
  );
}
