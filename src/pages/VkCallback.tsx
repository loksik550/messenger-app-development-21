import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";

export default function VkCallback() {
  const [state, setState] = useState<"loading" | "done" | "native" | "error">("loading");
  const [isLink, setIsLink] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const code = p.get("code") || "";
    const st = p.get("state") || "";
    const deviceId = p.get("device_id") || "";
    if (!code || !st) {
      setState("error");
      setError(p.get("error_description") || "ВКонтакте не передал данные для входа");
      return;
    }
    api("vk_finish", { code, state: st, device_id: deviceId })
      .then((r) => {
        if (r?.link) setIsLink(true);
        if (r?.status === "done" || r?.status === "used" || r?.status === "linked") {
          if (r.native) {
            setState("native");
          } else {
            setState("done");
            try { window.opener?.postMessage({ type: "nova_vk_done", state: st }, window.location.origin); } catch { /* ignore */ }
            setTimeout(() => {
              if (window.opener) window.close();
              else window.location.replace("/");
            }, 600);
          }
        } else {
          setState("error");
          setError(r?.error || "Не удалось войти, попробуйте ещё раз");
        }
      })
      .catch(() => { setState("error"); setError("Нет связи с сервером Nova"); });
  }, []);

  return (
    <div className="h-screen flex items-center justify-center p-6 text-center">
      <div className="mesh-bg" />
      <div className="glass-strong rounded-3xl p-6 max-w-sm w-full relative">
        {state === "loading" && (
          <>
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="font-semibold">Входим через ВКонтакте…</p>
          </>
        )}
        {state === "done" && (
          <>
            <Icon name="CircleCheck" size={44} className="text-emerald-400 mx-auto mb-3" />
            <p className="font-semibold">{isLink ? "ВКонтакте привязан!" : "Готово! Открываем Nova…"}</p>
          </>
        )}
        {state === "native" && (
          <>
            <Icon name="CircleCheck" size={44} className="text-emerald-400 mx-auto mb-3" />
            <p className="font-semibold mb-1">{isLink ? "ВКонтакте привязан" : "Вход подтверждён"}</p>
            <p className="text-sm text-muted-foreground">Закройте это окно и вернитесь в приложение Nova.</p>
          </>
        )}
        {state === "error" && (
          <>
            <Icon name="CircleAlert" size={44} className="text-red-400 mx-auto mb-3" />
            <p className="font-semibold mb-1">Не получилось войти</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <a href="/" className="inline-block px-5 py-2.5 rounded-2xl grad-primary text-white font-semibold text-sm">На главную</a>
          </>
        )}
      </div>
    </div>
  );
}
