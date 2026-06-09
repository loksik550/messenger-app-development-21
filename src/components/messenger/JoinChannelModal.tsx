import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User, type Group } from "@/lib/api";
import { useT } from "@/hooks/useT";

interface ChannelItem {
  id: number;
  name: string;
  description: string;
  avatar_url?: string | null;
  is_channel: boolean;
  members_count: number;
}

export default function JoinChannelModal({
  open,
  currentUser,
  onClose,
  onJoined,
}: {
  open: boolean;
  currentUser: User;
  onClose: () => void;
  onJoined: (group: Group) => void;
}) {
  const { t: tr } = useT();
  const [tab, setTab] = useState<"search" | "invite">("search");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("search"); setQ(""); setItems([]); setInvite(""); setError("");
  }, [open]);

  useEffect(() => {
    if (tab !== "search" || !q.trim()) { setItems([]); return; }
    let cancel = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await api("search_channels", { q: q.trim() });
      if (cancel) return;
      setItems(Array.isArray(r?.items) ? r.items : []);
      setLoading(false);
    }, 300);
    return () => { cancel = true; clearTimeout(t); };
  }, [q, tab]);

  const joinById = async (item: ChannelItem) => {
    setBusy(true); setError("");
    try {
      const r = await api("join_by_invite", { invite_link: String(item.id) }, currentUser.id);
      if (r?.error) throw new Error(r.error);
      onJoined({
        id: item.id,
        name: item.name,
        owner_id: 0,
        is_channel: item.is_channel,
        avatar_url: item.avatar_url || undefined,
        description: item.description || undefined,
        members_count: item.members_count,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message || "Не удалось присоединиться");
    } finally {
      setBusy(false);
    }
  };

  const joinByInvite = async () => {
    const v = invite.trim();
    if (!v) { setError("Вставь ссылку или код"); return; }
    setBusy(true); setError("");
    try {
      const r = await api("join_by_invite", { invite_link: v }, currentUser.id);
      if (r?.error) throw new Error(r.error);
      if (r?.group_id) {
        onJoined({ id: r.group_id, name: r.name || "Группа", owner_id: 0, is_channel: !!r.is_channel });
      }
      onClose();
    } catch (e) {
      setError((e as Error).message || "Не удалось присоединиться");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()} style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Найти канал или группу</h3>
          <button onClick={onClose} className="p-2 glass rounded-xl text-muted-foreground">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="flex gap-1 glass rounded-xl p-1 mb-4">
          <button
            onClick={() => setTab("search")}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${tab === "search" ? "bg-violet-500/30 text-violet-200" : "text-muted-foreground"}`}
          >
            <Icon name="Search" size={12} className="inline mr-1" /> {tr("common.search")}
          </button>
          <button
            onClick={() => setTab("invite")}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${tab === "invite" ? "bg-violet-500/30 text-violet-200" : "text-muted-foreground"}`}
          >
            <Icon name="Link" size={12} className="inline mr-1" /> По ссылке
          </button>
        </div>

        {tab === "search" ? (
          <>
            <div className="flex items-center gap-2 glass rounded-xl px-3 py-2 mb-3">
              <Icon name="Search" size={14} className="text-muted-foreground" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                autoFocus
                placeholder="Название канала или группы"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
            {loading && <div className="text-center text-xs text-muted-foreground py-3">{tr("common.loading")}</div>}
            {!loading && q.trim().length > 0 && items.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">{tr("search.empty")}</p>
            )}
            <div className="space-y-2">
              {items.map(it => (
                <div key={it.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center font-bold text-white flex-shrink-0">
                    {it.avatar_url
                      ? <img src={it.avatar_url} alt={it.name} className="w-full h-full object-cover" />
                      : it.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm truncate">{it.name}</span>
                      {it.is_channel && <span className="text-[9px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded-full">канал</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{it.members_count} участников</p>
                    {it.description && <p className="text-xs text-muted-foreground line-clamp-1">{it.description}</p>}
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => joinById(it)}
                    className="px-3 py-1.5 grad-primary text-white text-xs font-bold rounded-xl disabled:opacity-50"
                  >
                    Войти
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">Вставь invite-ссылку или код:</p>
            <input
              value={invite}
              onChange={e => setInvite(e.target.value)}
              autoFocus
              placeholder="nova.app/join/abc123 или abc123"
              className="w-full glass rounded-xl px-4 py-3 text-sm outline-none mb-3"
            />
            <button
              onClick={joinByInvite}
              disabled={busy || !invite.trim()}
              className="w-full grad-primary text-white rounded-xl py-3 font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Icon name="LogIn" size={14} /> Присоединиться</>}
            </button>
          </>
        )}

        {error && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}