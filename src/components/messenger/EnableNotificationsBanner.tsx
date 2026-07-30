import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { subscribeToPush } from "@/lib/api";

const DISMISS_KEY = "nova_push_banner_dismissed_until";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // «Позже» прячет баннер на 3 дня, а не навсегда

/**
 * Подсказка внизу экрана: предлагает включить push-уведомления, если они ещё
 * не разрешены. Если пользователь отложил — напомним снова через несколько дней,
 * чтобы он не остался без уведомлений навсегда.
 */
export default function EnableNotificationsBanner({ userId }: { userId: number }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    // Показываем, пока разрешение не выдано (default). Если уже granted/denied — не мешаем.
    if (Notification.permission !== "default") return;
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (until && Date.now() < until) return;
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const enable = async () => {
    setBusy(true);
    await subscribeToPush(userId);
    setBusy(false);
    setShow(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000));
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_MS));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[240] px-3 animate-fade-in"
      style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-md mx-auto glass-strong border border-violet-400/30 rounded-2xl p-3 flex items-center gap-3 shadow-2xl shadow-violet-500/20">
        <div className="w-10 h-10 rounded-xl grad-primary flex items-center justify-center shrink-0">
          <Icon name="Bell" size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Включить уведомления?</div>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Не пропускай сообщения, когда приложение закрыто
          </p>
        </div>
        <button
          onClick={dismiss}
          className="px-2.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-white/8"
        >
          Позже
        </button>
        <button
          onClick={enable}
          disabled={busy}
          className="px-3 py-1.5 rounded-xl grad-primary text-white text-xs font-bold disabled:opacity-50"
        >
          {busy ? "..." : "Включить"}
        </button>
      </div>
    </div>
  );
}