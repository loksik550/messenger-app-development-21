import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatComponents";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { useT } from "@/hooks/useT";

export function SearchPanel({ users, currentUser, onStartChat, onBack }: { users: User[]; currentUser: User; onStartChat: (id: number) => void; onBack?: () => void }) {
  useEdgeSwipeBack(onBack);
  const { t: tr } = useT();
  const [query, setQuery] = useState("");
  const [bots, setBots] = useState<{ id: number; name: string; username: string; description?: string | null; avatar_url?: string | null }[]>([]);
  const results = users.filter(u => !query || u.name.toLowerCase().includes(query.toLowerCase()) || u.phone.includes(query));
  useEffect(() => {
    const q = query.trim().replace(/^@/, "");
    if (q.length < 2) { setBots([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const r = await api("bot_search", { query: q }, currentUser.id);
      if (alive && r && Array.isArray(r.bots)) setBots(r.bots);
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [query, currentUser.id]);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="px-4 pt-4 pb-3" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2 mb-3">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-xl hover:bg-white/8 transition-colors">
              <Icon name="ChevronLeft" size={20} />
            </button>
          )}
          <h2 className="text-xl font-bold">{tr("nav.search")}</h2>
        </div>
        <div className="flex items-center gap-3 glass rounded-2xl px-4 py-3">
          <Icon name="Search" size={18} className="text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={tr("search.placeholder")}
            className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <Icon name="X" size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-1">
        {bots.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground px-2 pb-2 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <Icon name="Bot" size={12} className="text-cyan-400" />
              {tr("nav.bots")}
            </div>
            {bots.map(b => (
              <button
                key={`bot-${b.id}`}
                onClick={() => onStartChat(b.id)}
                className="w-full flex items-center gap-3 p-3 glass rounded-2xl hover:bg-white/8 transition-all"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}>
                  {b.avatar_url ? <img src={b.avatar_url} alt={b.name} className="w-full h-full object-cover rounded-full" /> : <Icon name="Bot" size={16} />}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <div className="font-semibold text-sm flex items-center gap-1">
                    <span className="truncate">{b.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 font-bold flex-shrink-0">BOT</span>
                  </div>
                  <div className="text-xs text-violet-400 truncate">@{b.username}</div>
                </div>
                <Icon name="MessageCircle" size={18} className="text-violet-400 flex-shrink-0" />
              </button>
            ))}
            <div className="h-2" />
          </>
        )}
        {!query && <div className="text-xs text-muted-foreground px-2 pb-2 uppercase tracking-widest font-semibold">{tr("search.allUsers")}</div>}
        {results.map((u, i) => (
          <button key={u.id} onClick={() => onStartChat(u.id)} className={`w-full flex items-center gap-3 p-3 glass rounded-2xl hover:bg-white/8 transition-all animate-fade-in stagger-${Math.min(i + 1, 5)}`}>
            <Avatar label={u.name[0]?.toUpperCase() || "?"} id={u.id} online={currentUser.id !== u.id && Date.now() / 1000 - (u.last_seen || 0) < 60} />
            <div className="text-left">
              <div className="font-semibold text-sm">{u.name}</div>
              <div className="text-xs text-muted-foreground">{u.phone}</div>
            </div>
            <div className="ml-auto">
              <Icon name="MessageCircle" size={18} className="text-violet-400" />
            </div>
          </button>
        ))}
        {query && results.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Icon name="SearchX" size={40} className="mx-auto mb-3 opacity-40" />
            <p>{tr("search.empty")}</p>
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        <button className="w-full flex items-center justify-center gap-2 py-3 grad-primary rounded-2xl text-white font-semibold glow-primary transition-opacity hover:opacity-90">
          <Icon name="UserPlus" size={18} />
          {tr("search.addContact")}
        </button>
      </div>
    </div>
  );
}

export default SearchPanel;
