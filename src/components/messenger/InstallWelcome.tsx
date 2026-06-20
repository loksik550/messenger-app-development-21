import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "nova_install_welcome_v1";
const ICON_URL = "https://cdn.poehali.dev/projects/6364bfec-87ef-4e7b-8203-730d57164065/files/52e946a1-a32a-4a01-ac9e-228ced39895d.jpg";

type Platform = "ios" | "android" | "desktop";

const detectPlatform = (): Platform => {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
};

const isStandalone = () => {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  return false;
};

/**
 * Экран-приветствие для новых посетителей novaa.pro.
 * Показывается один раз, предлагает установить Nova как приложение.
 */
export default function InstallWelcome() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    setPlatform(detectPlatform());
    setOpen(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      localStorage.setItem(STORAGE_KEY, "installed");
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "seen");
    setOpen(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") localStorage.setItem(STORAGE_KEY, "installed");
    setDeferred(null);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-[#0a0a0f] animate-fade-in overflow-y-auto">
      <div className="mesh-bg" />
      <div className="absolute top-[-10%] right-[-10%] w-80 h-80 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 rounded-full bg-sky-600/15 blur-3xl pointer-events-none" />

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-md mx-auto w-full"
        style={{ paddingTop: "calc(2.5rem + env(safe-area-inset-top))", paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}>

        {/* Иконка приложения */}
        <div className="relative mb-5 animate-float">
          <img src={ICON_URL} alt="Nova" className="w-24 h-24 rounded-[26px] shadow-2xl shadow-violet-500/40 object-cover" />
        </div>

        <h1 className="text-3xl font-black grad-text tracking-tight mb-1">Nova</h1>
        <p className="text-muted-foreground text-sm text-center mb-7">
          Установи Nova на телефон — общайся, как в настоящем мессенджере
        </p>

        {/* Преимущества */}
        <div className="w-full grid grid-cols-3 gap-2 mb-7">
          <Benefit icon="Zap" text="Быстрый запуск" />
          <Benefit icon="Bell" text="Уведомления" />
          <Benefit icon="WifiOff" text="Работает офлайн" />
        </div>

        {/* Инструкция по платформе */}
        <div className="w-full space-y-2.5 mb-7">
          {platform === "ios" && (
            <>
              <Step n={1} icon="Share" text="Нажми «Поделиться» внизу Safari" />
              <Step n={2} icon="SquarePlus" text="Выбери «На экран „Домой“»" />
              <Step n={3} icon="Check" text="Иконка Nova появится на экране" />
            </>
          )}
          {platform === "android" && !deferred && (
            <>
              <Step n={1} icon="EllipsisVertical" text="Открой меню Chrome (три точки)" />
              <Step n={2} icon="Download" text="Выбери «Установить приложение»" />
              <Step n={3} icon="Check" text="Готово — Nova среди приложений" />
            </>
          )}
          {platform === "android" && deferred && (
            <p className="text-sm text-white/80 text-center px-2">
              Нажми кнопку ниже — Nova установится за пару секунд.
            </p>
          )}
          {platform === "desktop" && (
            <p className="text-sm text-white/80 text-center px-2">
              {deferred
                ? "Нажми кнопку ниже, чтобы установить Nova отдельным приложением."
                : "В адресной строке справа нажми иконку установки, чтобы добавить Nova."}
            </p>
          )}
        </div>

        {/* Кнопки */}
        <div className="w-full flex flex-col gap-2.5">
          {deferred && (
            <button
              onClick={install}
              className="w-full py-3.5 rounded-2xl grad-primary text-white font-bold flex items-center justify-center gap-2 glow-primary hover:opacity-90 transition-opacity"
            >
              <Icon name="Download" size={18} />
              Установить Nova
            </button>
          )}
          <button
            onClick={close}
            className="w-full py-3.5 rounded-2xl glass text-white/90 font-semibold hover:bg-white/10 transition-colors"
          >
            {deferred ? "Не сейчас, войти в браузере" : "Продолжить в браузере"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Benefit({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/5 text-center">
      <Icon name={icon} size={20} className="text-violet-400" />
      <span className="text-[11px] text-white/80 leading-tight">{text}</span>
    </div>
  );
}

function Step({ n, icon, text }: { n: number; icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
      <div className="w-7 h-7 rounded-full grad-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <Icon name={icon} size={18} className="text-violet-400 shrink-0" />
      <span className="text-sm text-white/90">{text}</span>
    </div>
  );
}