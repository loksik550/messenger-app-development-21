import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";

interface Invite {
  id: number;
  group_id: number;
  group_name: string;
  is_channel: boolean;
  avatar_url?: string | null;
  inviter_name: string;
  members_count: number;
}

export default function GroupInvitePrompt({ userId }: { userId: number }) {
  const [item, setItem] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const handledRef = useRef<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const r = await api("my_group_invites", {}, userId);
      const list: Invite[] = Array.isArray(r?.items) ? r.items : [];
      setItem(list.find((x) => !handledRef.current.has(x.id)) || null);
    } catch { /* сеть */ }
  }, [userId]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const decide = async (accept: boolean) => {
    if (!item) return;
    const cur = item;
    handledRef.current.add(cur.id);
    setBusy(true);
    const r = await api("group_invite_decide", { invite_id: cur.id, accept }, userId).catch(() => null);
    setBusy(false);
    setItem(null);
    const word = cur.is_channel ? "канал" : "группу";
    setDone(r?.ok ? (accept ? `Вы вступили в ${word} «${cur.group_name}»` : "Приглашение отклонено") : (r?.error || "Не удалось, попробуйте позже"));
    setTimeout(() => { setDone(""); load(); }, 2500);
  };

  if (done) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] glass-strong rounded-2xl px-4 py-3 text-sm animate-fade-in max-w-[90vw]">
        {done}
      </div>
    );
  }
  if (!item) return null;

  const word = item.is_channel ? "канал" : "группу";
  return (
    <div className="fixed inset-0 z-[385] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-fade-in">
      <div className="glass-strong rounded-3xl p-5 w-full max-w-sm animate-scale-in text-center">
        {item.avatar_url ? (
          <img src={item.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-violet-500/15 text-violet-400 flex items-center justify-center mx-auto mb-3">
            <Icon name={item.is_channel ? "Megaphone" : "Users"} size={30} />
          </div>
        )}
        <h3 className="text-lg font-bold mb-1">Приглашение в {word}</h3>
        <p className="text-sm text-muted-foreground mb-1">
          <span className="text-foreground font-medium">{item.inviter_name}</span> приглашает вас в {word}
        </p>
        <p className="text-base font-semibold mb-1 break-words">«{item.group_name}»</p>
        <p className="text-xs text-muted-foreground mb-5">Участников: {item.members_count}</p>
        <div className="flex gap-2">
          <button
            onClick={() => decide(false)}
            disabled={busy}
            className="flex-1 py-3 rounded-2xl glass hover:bg-white/10 font-semibold disabled:opacity-50"
          >
            Отклонить
          </button>
          <button
            onClick={() => decide(true)}
            disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-50"
          >
            Вступить
          </button>
        </div>
      </div>
    </div>
  );
}
