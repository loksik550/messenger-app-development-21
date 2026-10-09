import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";

interface Pending { id: number; device_name: string; ip: string; created_at: number }

export default function ResetApprovalPrompt({ userId }: { userId: number }) {
  const [item, setItem] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api("reset_pending", {}, userId);
      setItem(Array.isArray(r?.items) && r.items.length ? r.items[0] : null);
    } catch { /* сеть */ }
  }, [userId]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 20000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const decide = async (approve: boolean) => {
    if (!item) return;
    setBusy(true);
    const r = await api("reset_decide", { request_id: item.id, approve }, userId).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      setDone(approve ? "Пароль изменён. Остальные устройства отключены." : "Запрос отклонён. Ваш пароль не изменился.");
      setItem(null);
      setTimeout(() => setDone(""), 3500);
    } else {
      setDone(r?.error || "Не удалось, попробуйте ещё раз");
      setTimeout(() => setDone(""), 3500);
      load();
    }
  };

  if (done) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] glass-strong rounded-2xl px-4 py-3 text-sm animate-fade-in max-w-[90vw]">
        {done}
      </div>
    );
  }
  if (!item) return null;

  const when = new Date(item.created_at * 1000).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-fade-in">
      <div className="glass-strong rounded-3xl p-5 w-full max-w-sm animate-scale-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-3">
          <Icon name="ShieldAlert" size={28} />
        </div>
        <h3 className="text-lg font-bold text-center mb-1">Кто-то хочет сменить пароль</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Запрос в {when} с устройства «{item.device_name || "неизвестно"}». Если это не вы — отклоните, и пароль останется прежним.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => decide(false)}
            disabled={busy}
            className="w-full py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm disabled:opacity-60"
          >
            Это не я — отклонить
          </button>
          <button
            onClick={() => decide(true)}
            disabled={busy}
            className="w-full py-3 rounded-2xl glass text-foreground font-semibold text-sm disabled:opacity-60"
          >
            Это я — подтвердить смену
          </button>
        </div>
      </div>
    </div>
  );
}
