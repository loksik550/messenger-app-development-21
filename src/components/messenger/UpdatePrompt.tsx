import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

/**
 * Отслеживает обновление service worker и показывает баннер
 * «Доступна новая версия — Обновить» прямо внутри приложения.
 */
export default function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;

    const promote = (worker: ServiceWorker | null) => {
      if (worker) setWaitingWorker(worker);
    };

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return;
      reg = registration;

      // Уже есть ожидающий обновлённый SW
      if (registration.waiting && navigator.serviceWorker.controller) {
        promote(registration.waiting);
      }

      // Появился новый SW — ждём, пока он установится
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            promote(installing);
          }
        });
      });
    });

    // Периодически проверяем сервер на наличие новой версии
    const checkInterval = setInterval(() => {
      reg?.update().catch(() => { /* offline — пропускаем */ });
    }, 60 * 1000);

    // Когда новый SW взял управление — перезагружаем страницу один раз
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      clearInterval(checkInterval);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = () => {
    if (!waitingWorker) return;
    setUpdating(true);
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  if (!waitingWorker) return null;

  return (
    <div className="fixed left-4 right-4 z-[260] flex justify-center animate-slide-up"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
      <div className="w-full max-w-md glass-strong border border-violet-500/30 rounded-2xl p-3.5 flex items-center gap-3 shadow-2xl shadow-violet-500/20">
        <div className="w-11 h-11 grad-primary rounded-xl flex items-center justify-center flex-shrink-0 glow-primary">
          <Icon name="Sparkles" size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-white">Доступна новая версия</p>
          <p className="text-xs text-muted-foreground">Обнови Nova, чтобы получить улучшения</p>
        </div>
        <button
          onClick={applyUpdate}
          disabled={updating}
          className="px-4 py-2 grad-primary rounded-xl text-white text-sm font-bold flex-shrink-0 flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-70"
        >
          {updating ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Icon name="RefreshCw" size={15} />
          )}
          Обновить
        </button>
      </div>
    </div>
  );
}
