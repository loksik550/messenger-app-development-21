import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { IconName } from "@/lib/api";

const ONBOARDING_KEY = "nova_onboarding_v1";

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "done";
  } catch {
    return false;
  }
}

export function setOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "done");
  } catch {
    /* ignore */
  }
}

interface Slide {
  icon: IconName;
  title: string;
  text: string;
  gradient: string;
}

const SLIDES: Slide[] = [
  {
    icon: "MessageCircle",
    title: "Общение без границ",
    text: "Личные и групповые чаты, фото, видео, голосовые сообщения и файлы. Ответы, реакции и пересылка — всё под рукой.",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: "Phone",
    title: "Звонки прямо из чата",
    text: "Аудио- и видеозвонки по защищённому соединению. Качество подстраивается под вашу сеть автоматически.",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    icon: "Users",
    title: "Группы и каналы",
    text: "Создавайте группы с ролями и правами или каналы для публикаций. Приглашайте по ссылке в одно нажатие.",
    gradient: "from-sky-500 to-cyan-600",
  },
  {
    icon: "ShieldCheck",
    title: "Приватность под контролем",
    text: "PIN-код на вход, исчезающие сообщения, скрытие статуса и блокировка нежелательных собеседников.",
    gradient: "from-amber-500 to-orange-600",
  },
];

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const finish = () => {
    setOnboardingSeen();
    onDone();
  };

  return (
    <div className="flex flex-col h-full max-h-[100dvh] bg-background overflow-hidden">
      <div
        className="flex justify-end px-5 shrink-0"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <button
          onClick={finish}
          className="text-sm text-muted-foreground hover:text-foreground transition px-3 py-2"
        >
          Пропустить
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-8 text-center">
        <div
          className={`w-24 h-24 rounded-[2rem] bg-gradient-to-br ${slide.gradient} flex items-center justify-center mb-8 shadow-lg`}
        >
          <Icon name={slide.icon} size={44} className="text-white" />
        </div>

        <h2 className="text-2xl font-bold mb-3">{slide.title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
          {slide.text}
        </p>
      </div>

      <div
        className="shrink-0 px-8 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
      >
        <div className="flex items-center justify-center gap-2 mb-6">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              onClick={() => setIndex(i)}
              aria-label={`Слайд ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? "w-6 grad-primary" : "w-2 bg-white/20"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => (isLast ? finish() : setIndex(index + 1))}
          className="w-full py-4 grad-primary rounded-2xl text-white font-bold text-base glow-primary hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          {isLast ? "Начать пользоваться" : "Далее"}
          <Icon name={isLast ? "Check" : "ArrowRight"} size={18} />
        </button>
      </div>
    </div>
  );
}