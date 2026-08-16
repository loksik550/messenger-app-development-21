import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "nova_install_prompt_v1";

type Platform = "ios" | "android" | "desktop" | "unsupported";

const detectPlatform = (): Platform => {
  if (typeof window === "undefined") return "unsupported";
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
};

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  return false;
};

export default function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY) === "dismissed") return;
    if (localStorage.getItem(STORAGE_KEY) === "installed") return;

    setPlatform(detectPlatform());

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

    const t = setTimeout(() => setOpen(true), 4000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "dismissed");
    setOpen(false);
  };

  const remindLater = () => setOpen(false);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(STORAGE_KEY, "installed");
    }
    setDeferred(null);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div data-install-prompt className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#15151f] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 pb-8 shadow-2xl animate-slide-up">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-3xl grad-primary flex items-center justify-center shadow-lg shadow-violet-500/40">
            <Icon name="Download" size={32} className="text-white" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white text-center mb-2">
          Установи Nova как приложение
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Получай звонки и сообщения как в Telegram — даже когда экран заблокирован.
        </p>

        {platform === "ios" && (
          <div className="space-y-3 mb-6">
            <Step n={1} icon="Share" text="Нажми кнопку «Поделиться» внизу Safari" />
            <Step n={2} icon="PlusSquare" text="Выбери «На экран Домой»" />
            <Step n={3} icon="Check" text="Готово — иконка Nova появится на экране" />
          </div>
        )}

        {platform === "android" && (
          <div className="space-y-3 mb-6">
            {deferred ? (
              <p className="text-sm text-white/80 text-center">
                Нажми «Установить» — Nova появится среди приложений.
              </p>
            ) : (
              <>
                <Step n={1} icon="MoreVertical" text="Открой меню Chrome (три точки)" />
                <Step n={2} icon="Download" text="Выбери «Установить приложение»" />
                <Step n={3} icon="Check" text="Готово" />
              </>
            )}
          </div>
        )}

        {platform === "desktop" && (
          <div className="space-y-3 mb-6">
            {deferred ? (
              <p className="text-sm text-white/80 text-center">
                Нажми «Установить» — Nova откроется в отдельном окне.
              </p>
            ) : (
              <p className="text-sm text-white/80 text-center">
                В адресной строке справа есть иконка установки 💾 — нажми её.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {deferred && (
            <button
              onClick={install}
              className="w-full h-12 rounded-2xl grad-primary text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Icon name="Download" size={18} />
              Установить
            </button>
          )}
          <button
            onClick={remindLater}
            className="w-full h-11 rounded-2xl glass text-white/80 font-medium hover:bg-white/10 transition-colors"
          >
            Напомнить позже
          </button>
          <button
            onClick={dismiss}
            className="w-full h-10 text-sm text-muted-foreground hover:text-white/70 transition-colors"
          >
            Больше не показывать
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, icon, text }: { n: number; icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
      <div className="w-8 h-8 rounded-full grad-primary text-white text-sm font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <Icon name={icon} size={18} className="text-violet-400 shrink-0" />
      <span className="text-sm text-white/90">{text}</span>
    </div>
  );
}
