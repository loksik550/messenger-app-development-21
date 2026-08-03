import Icon from "@/components/ui/icon";
import type { Group } from "@/lib/api";

interface Props {
  group: Group;
  membersLength: number;
  isMuted: boolean;
  showSearch: boolean;
  searchQuery: string;
  searching: boolean;
  searchResults: { id: number; sender_name: string; text: string; created_at: number }[];
  onBack: () => void;
  onOpenInfo: () => void;
  onOpenAvatar: () => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onSearch: (q: string) => void;
}

export default function GroupChatHeader({
  group,
  membersLength,
  isMuted,
  showSearch,
  searchQuery,
  searching,
  searchResults,
  onBack,
  onOpenInfo,
  onOpenAvatar,
  onOpenSearch,
  onCloseSearch,
  onSearch,
}: Props) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 glass-strong border-b border-white/5 flex-shrink-0"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-white/8 md:hidden">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <button onClick={onOpenInfo} className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition">
          {group.avatar_url ? (
            <img
              src={group.avatar_url}
              className="w-10 h-10 rounded-2xl object-cover flex-shrink-0 active:scale-95 transition-transform"
              onClick={(e) => { e.stopPropagation(); onOpenAvatar(); }}
            />
          ) : (
            <div className="w-10 h-10 rounded-2xl grad-primary flex items-center justify-center flex-shrink-0">
              <Icon name={group.is_channel ? "Radio" : "Users"} size={18} className="text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate flex items-center gap-1.5">
              {group.is_channel && <Icon name="Radio" size={12} className="text-sky-400 flex-shrink-0" />}
              <span className="truncate">{group.name}</span>
              {isMuted && <Icon name="BellOff" size={12} className="text-muted-foreground flex-shrink-0" />}
            </div>
            <div className="text-xs text-muted-foreground">
              {group.members_count ?? membersLength} {(group.members_count ?? membersLength) === 1 ? "участник" : "участников"}
            </div>
          </div>
        </button>
        <button onClick={onOpenSearch} className="p-2 rounded-xl hover:bg-white/8 text-muted-foreground">
          <Icon name="Search" size={18} />
        </button>
        <button onClick={onOpenInfo} className="p-2 rounded-xl hover:bg-white/8 text-muted-foreground">
          <Icon name="Info" size={18} />
        </button>
      </div>

      {/* Search overlay */}
      {showSearch && (
        <div className="absolute inset-0 z-[90] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-2 glass-strong border-b border-white/5 flex-shrink-0"
            style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
            <button onClick={onCloseSearch} className="p-2 rounded-xl hover:bg-white/8">
              <Icon name="ChevronLeft" size={20} />
            </button>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
              <Icon name="Search" size={16} className="text-muted-foreground" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => onSearch(e.target.value)}
                placeholder="Поиск по сообщениям"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button onClick={() => onSearch("")} className="text-muted-foreground hover:text-foreground">
                  <Icon name="X" size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {searching && <div className="text-center text-sm text-muted-foreground py-6">Поиск...</div>}
            {!searching && searchQuery.trim() && searchResults.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-6">Ничего не найдено</div>
            )}
            {searchResults.map(r => (
              <div key={r.id} className="px-3 py-2.5 rounded-xl hover:bg-white/5 transition">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-semibold text-violet-400">{r.sender_name}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(r.created_at * 1000).toLocaleDateString("ru", { day: "numeric", month: "short" })}</span>
                </div>
                <div className="text-sm text-foreground line-clamp-2">{r.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
