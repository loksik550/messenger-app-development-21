import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";

type Target = { key: string; kind: "chat" | "group"; id: number; name: string; avatar_url?: string | null; saved?: boolean; channel?: boolean };

function getCurrentUser(): User | null {
  try { return JSON.parse(localStorage.getItem("nova_user") || "null"); } catch { return null; }
}

export default function ForwardMediaDialog({ url, type, onClose, onDone }: {
  url: string;
  type: "image" | "video";
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const me = useMemo(getCurrentUser, []);
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [query, setQuery] = useState("");
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!me) { setTargets([]); return; }
    Promise.all([
      api("saved_chat", {}, me.id).catch(() => null),
      api("get_chats", {}, me.id).catch(() => null),
      api("get_groups", {}, me.id).catch(() => null),
    ]).then(([saved, chats, groups]) => {
      const list: Target[] = [];
      if (saved?.chat_id) list.push({ key: `c${saved.chat_id}`, kind: "chat", id: saved.chat_id, name: "Избранное", saved: true });
      for (const c of chats?.chats || []) {
        if (saved?.chat_id && c.id === saved.chat_id) continue;
        list.push({ key: `c${c.id}`, kind: "chat", id: c.id, name: c.partner?.name || "Чат", avatar_url: c.partner?.avatar_url });
      }
      for (const g of groups?.groups || []) {
        const canWrite = !g.is_channel || g.owner_id === me.id || g.my_role === "admin" || g.role === "admin";
        if (!canWrite) continue;
        list.push({ key: `g${g.id}`, kind: "group", id: g.id, name: g.name, avatar_url: g.avatar_url, channel: !!g.is_channel });
      }
      setTargets(list);
    });
  }, [me]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (targets || []).filter(t => !q || t.name.toLowerCase().includes(q));
  }, [targets, query]);

  const send = async (t: Target) => {
    if (!me || sendingKey) return;
    setSendingKey(t.key);
    setError("");
    const media = { media_type: type, media_url: url, file_name: type === "video" ? "video.mp4" : "photo.jpg" };
    try {
      const r = t.kind === "group"
        ? await api("send_group_message", { group_id: t.id, ...media }, me.id)
        : await api("send_message", { chat_id: t.id, ...media }, me.id);
      if (!r?.id) throw new Error(r?.error || "Не удалось переслать");
      onDone(t.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось переслать");
      setSendingKey(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] bg-black/60 flex items-end md:items-center justify-center animate-fade-in"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div
        className="glass-strong rounded-t-3xl md:rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col animate-scale-in"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="font-semibold">{type === "video" ? "Переслать видео" : "Переслать фото"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground" aria-label="Закрыть">
            <Icon name="X" size={18} />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
            <Icon name="Search" size={16} className="text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск чата или группы..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>
          {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {!targets ? (
            <div className="flex justify-center py-8"><Icon name="Loader2" size={22} className="animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">{me ? "Ничего не нашли" : "Войдите в аккаунт"}</div>
          ) : filtered.map((t) => (
            <button
              key={t.key}
              disabled={!!sendingKey}
              onClick={() => send(t)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/8 transition-colors disabled:opacity-60"
            >
              {t.avatar_url ? (
                <img src={t.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white shrink-0 ${t.saved ? "bg-gradient-to-br from-sky-500 to-violet-600" : "grad-primary"}`}>
                  {t.saved ? <Icon name="Bookmark" size={18} /> : (t.name[0] || "?").toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <div className="font-medium truncate">{t.name}</div>
                {t.kind === "group" && <div className="text-[11px] text-muted-foreground">{t.channel ? "Канал" : "Группа"}</div>}
              </div>
              {sendingKey === t.key && <Icon name="Loader2" size={18} className="animate-spin text-violet-400" />}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
