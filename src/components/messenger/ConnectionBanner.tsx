import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { useOnline } from "@/lib/connection";

export default function ConnectionBanner({ variant = "chat" }: { variant?: "chat" | "auth" }) {
  const online = useOnline();
  const [showRestored, setShowRestored] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) { wasOffline.current = true; setShowRestored(false); return; }
    if (wasOffline.current) {
      wasOffline.current = false;
      setShowRestored(true);
      const t = setTimeout(() => setShowRestored(false), 2000);
      return () => clearTimeout(t);
    }
  }, [online]);

  if (online && !showRestored) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[60] animate-fade-in pointer-events-none w-max max-w-[calc(100vw-1.5rem)]"
      style={{ top: "calc(0.5rem + env(safe-area-inset-top))" }}
    >
      <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium shadow-lg ${
        online ? "bg-emerald-500 text-white" : "bg-amber-500 text-black"
      }`}>
        {online ? (
          <><Icon name="Wifi" size={14} /> Связь восстановлена</>
        ) : (
          <><Icon name="WifiOff" size={14} /> {variant === "auth"
            ? "Нет связи с сервером Nova. Попробуйте Wi-Fi"
            : "Нет связи. Сообщения отправятся позже"}</>
        )}
      </div>
    </div>
  );
}
