import { useEffect, useRef, useState } from "react";
import { devApi } from "@/lib/devApi";

type PollResult = { status: string; error?: string; token?: string; admin?: unknown };

export function useDevVk(onFinish: (r: PollResult) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setBusy(false);
  };

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const start = async (action: "vk_start" | "vk_link_start") => {
    setError("");
    const popup = window.open("about:blank", "nova_dev_vk", "width=520,height=680");
    setBusy(true);
    try {
      const r = await devApi<{ url: string; state: string; poll_key: string }>(action);
      if (popup) popup.location.href = r.url;
      else window.location.href = r.url;
      const started = Date.now();
      timer.current = setInterval(async () => {
        if (Date.now() - started > 10 * 60 * 1000) { stop(); return; }
        try {
          const s = await devApi<PollResult>("vk_poll", { state: r.state, poll_key: r.poll_key });
          if (s.status === "done" || s.status === "linked") { stop(); onFinish(s); }
          else if (s.status === "no_access" || s.status === "error") {
            stop();
            setError(s.error === "taken" ? "Этот ВКонтакте уже привязан к другому сотруднику" : s.error || "ВКонтакте не подтвердил вход");
          }
        } catch (e) {
          stop();
          setError(e instanceof Error ? e.message : "Не удалось войти");
        }
      }, 2000);
    } catch (e) {
      popup?.close();
      setBusy(false);
      setError(e instanceof Error ? e.message : "Вход через ВКонтакте недоступен");
    }
  };

  return { busy, error, start, setError };
}
