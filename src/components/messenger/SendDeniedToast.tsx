import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

export default function SendDeniedToast() {
  const [text, setText] = useState("");

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      const err = (e as CustomEvent<{ error?: string }>).detail?.error;
      if (!err) return;
      setText(err);
      clearTimeout(t);
      t = setTimeout(() => setText(""), 4500);
    };
    window.addEventListener("nova:send-denied", on);
    return () => { window.removeEventListener("nova:send-denied", on); clearTimeout(t); };
  }, []);

  if (!text) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[400] max-w-[90vw] px-4 py-2.5 rounded-2xl bg-red-500/90 text-white text-sm font-medium shadow-lg animate-fade-in flex items-center gap-2"
      style={{ top: "calc(4rem + env(safe-area-inset-top))" }}
      onClick={() => setText("")}
    >
      <Icon name="ShieldOff" fallback="Ban" size={16} className="flex-shrink-0" />
      {text}
    </div>
  );
}
