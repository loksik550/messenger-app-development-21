import { useEffect, useRef, useState } from "react";
import { Browser } from "@capacitor/browser";
import { api } from "@/lib/api";
import { native } from "@/lib/native";

export function VkLinkRow({ userId }: { userId: number }) {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [canUnlink, setCanUnlink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () =>
    api("vk_link_info", {}, userId)
      .then((r) => { setLinked(!!r?.linked); setCanUnlink(!!r?.can_unlink); })
      .catch(() => setLinked(false));

  useEffect(() => {
    load();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const stop = () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; setBusy(false); };

  const link = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const r = await api("vk_start", { native: native.isNative, link: true }, userId);
      if (!r?.url) { setMsg({ text: r?.error || "Привязка недоступна", ok: false }); setBusy(false); return; }
      const { state, poll_key } = r;
      if (native.isNative) await Browser.open({ url: r.url });
      else if (!window.open(r.url, "nova_vk", "width=520,height=680")) {
        setMsg({ text: "Разрешите всплывающие окна для сайта и попробуйте снова", ok: false });
        setBusy(false);
        return;
      }
      const started = Date.now();
      const check = async () => {
        if (Date.now() - started > 10 * 60 * 1000) { stop(); return; }
        const s = await api("vk_status", { state, poll_key }).catch(() => null);
        if (s?.status === "linked" || s?.status === "used") {
          stop();
          if (native.isNative) Browser.close().catch(() => { /* уже закрыт */ });
          setMsg({ text: "ВКонтакте привязан. Теперь можно входить через ВК.", ok: true });
          load();
        } else if (s?.status === "error") {
          stop();
          setMsg({ text: s.error === "taken" ? "Этот ВКонтакте уже привязан к другому аккаунту Nova" : "ВКонтакте не подтвердил привязку", ok: false });
        }
      };
      pollRef.current = setInterval(check, 2000);
    } catch {
      setMsg({ text: "Нет связи с сервером Nova", ok: false });
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!window.confirm("Отвязать ВКонтакте? Входить через ВК больше не получится.")) return;
    setBusy(true);
    const r = await api("vk_unlink", {}, userId).catch(() => null);
    setBusy(false);
    if (r?.ok) { setMsg({ text: "ВКонтакте отвязан", ok: true }); load(); }
    else setMsg({ text: r?.error || "Не удалось отвязать", ok: false });
  };

  if (linked === null) return null;

  return (
    <div className="glass rounded-2xl px-4 py-3 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#0077FF] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-xs">VK</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">ВКонтакте</div>
          <div className="text-xs text-muted-foreground truncate">
            {linked ? "Привязан — можно входить через ВК" : "Входите в Nova в одно касание"}
          </div>
        </div>
        {!linked ? (
          <button
            onClick={link}
            disabled={busy}
            className="px-3 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0069e0] text-white text-xs font-semibold disabled:opacity-60 flex-shrink-0"
          >
            {busy ? "Ждём ВК…" : "Привязать"}
          </button>
        ) : canUnlink ? (
          <button
            onClick={unlink}
            disabled={busy}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-foreground text-xs font-semibold disabled:opacity-60 flex-shrink-0"
          >
            Отвязать
          </button>
        ) : (
          <span className="text-xs text-emerald-400 font-semibold flex-shrink-0">Привязан</span>
        )}
      </div>
      {msg && <p className={`text-xs mt-2 ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
    </div>
  );
}
