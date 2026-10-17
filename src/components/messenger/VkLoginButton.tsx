import { useEffect, useRef, useState } from "react";
import { Browser } from "@capacitor/browser";
import { api, type User } from "@/lib/api";
import { native } from "@/lib/native";

const PENDING_KEY = "nova_vk_pending";

export default function VkLoginButton({ onDone }: { onDone: (user: User, token?: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return;
    localStorage.removeItem(PENDING_KEY);
    try {
      const p = JSON.parse(raw);
      if (p?.state && p?.poll_key && Date.now() - (p.at || 0) < 15 * 60 * 1000) {
        setLoading(true);
        poll(p.state, p.poll_key);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError("");
    setLoading(true);
    try {
      const r = await api("vk_start", { native: native.isNative });
      if (!r?.url) { setError(r?.error || "Вход через ВКонтакте недоступен"); setLoading(false); return; }
      const { state, poll_key } = r;
      const popup = native.isNative ? null : window.open(r.url, "nova_vk", "width=520,height=680");
      if (native.isNative) await Browser.open({ url: r.url });
      else if (!popup) {
        localStorage.setItem(PENDING_KEY, JSON.stringify({ state, poll_key, at: Date.now() }));
        window.location.href = r.url;
        return;
      }
      poll(state, poll_key);
    } catch {
      setError("Нет связи с сервером Nova");
      setLoading(false);
    }
  };

  function poll(state: string, poll_key: string) {
    {
      const started = Date.now();
      const check = async () => {
        if (Date.now() - started > 10 * 60 * 1000) { stop(); setError("Время входа истекло"); return; }
        const s = await api("vk_status", { state, poll_key }).catch(() => null);
        if (s?.user) {
          stop();
          if (native.isNative) Browser.close().catch(() => { /* уже закрыт */ });
          onDone(s.user, s.token);
        } else if (s?.status === "error") {
          stop();
          setError(s.error === "banned" ? "Аккаунт заблокирован" : "ВКонтакте не подтвердил вход");
        }
      };
      const stop = () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; setLoading(false); };
      pollRef.current = setInterval(check, 2000);
      const onMsg = (e: MessageEvent) => {
        if (e.origin === window.location.origin && e.data?.type === "nova_vk_done") { check(); window.removeEventListener("message", onMsg); }
      };
      window.addEventListener("message", onMsg);
      if (native.isNative) Browser.addListener("browserFinished", () => { check(); }).catch(() => { /* ignore */ });
      check();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex-1 h-px bg-white/10" />или<div className="flex-1 h-px bg-white/10" />
      </div>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="w-full py-3.5 rounded-2xl bg-[#0077FF] hover:bg-[#0069e0] text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-70 transition-colors"
      >
        {loading ? (
          <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Ждём ВКонтакте…</>
        ) : (
          <><span className="font-black text-lg leading-none">VK</span>Войти через ВКонтакте</>
        )}
      </button>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
