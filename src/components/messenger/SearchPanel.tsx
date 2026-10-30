import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import ProName from "@/components/messenger/ProName";
import { api, type User } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatComponents";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { useT } from "@/hooks/useT";

export function SearchPanel({ users, currentUser, onStartChat, onBack }: { users: User[]; currentUser: User; onStartChat: (id: number, known?: Pick<User, "name" | "avatar_url">) => void; onBack?: () => void }) {
  useEdgeSwipeBack(onBack);
  const { t: tr } = useT();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<User[] | null>(null);
  const [searching, setSearching] = useState(false);
  const idQuery = query.toLowerCase().replace(/id|#|\s|-/g, "");
  const isIdSearch = /^\d{8}$/.test(idQuery);
  const local = isIdSearch ? [] : users.filter(u => !query || u.name.toLowerCase().includes(query.toLowerCase()));
  const results = query.trim() && found ? [...found, ...local.filter(l => !found.some(f => f.id === l.id))] : local;
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setFound(null); setSearching(false); return; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await api("get_users", { query: q }, currentUser.id).catch(() => null);
      if (!alive) return;
      setSearching(false);
      if (r && Array.isArray(r.users)) setFound(r.users);
    }, 300);
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
            placeholder="Имя, номер или ID из 8 цифр"
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
        {!query && <div className="text-xs text-muted-foreground px-2 pb-2 uppercase tracking-widest font-semibold">{tr("search.allUsers")}</div>}
        {results.map((u, i) => (
          <button key={u.id} onClick={() => onStartChat(u.id, { name: u.name, avatar_url: u.avatar_url })} className={`w-full flex items-center gap-3 p-3 glass rounded-2xl hover:bg-white/8 transition-all animate-fade-in stagger-${Math.min(i + 1, 5)}`}>
            <Avatar label={u.name[0]?.toUpperCase() || "?"} id={u.id} online={currentUser.id !== u.id && Date.now() / 1000 - (u.last_seen || 0) < 60} />
            <div className="text-left">
              <div className="font-semibold text-sm"><ProName name={u.name} isPro={!!u.is_pro} emoji={u.emoji_status} color={u.name_color} badgeSize={12} /></div>
              {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
              {u.nova_id && isIdSearch && <div className="text-xs text-violet-300 font-mono">ID {u.nova_id}</div>}
            </div>
            <div className="ml-auto">
              <Icon name="MessageCircle" size={18} className="text-violet-400" />
            </div>
          </button>
        ))}
        {query && results.length === 0 && !searching && (
          <div className="text-center py-12 text-muted-foreground">
            <Icon name="SearchX" size={40} className="mx-auto mb-3 opacity-40" />
            <p>{isIdSearch ? "Пользователь с таким ID не найден" : tr("search.empty")}</p>
          </div>
        )}
        {query && results.length === 0 && searching && (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}
        {!query && (
          <div className="mx-1 mt-3 mb-2 p-3 rounded-2xl bg-violet-500/10 text-xs text-violet-200/90 flex items-start gap-2">
            <Icon name="Hash" size={14} className="mt-0.5 flex-shrink-0" />
            <span>Знаете ID собеседника? Введите его 8 цифр в поиск — и сразу напишите. Свой ID можно посмотреть в профиле.</span>
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
