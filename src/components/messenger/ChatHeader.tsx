import Icon from "@/components/ui/icon";
import { type Chat, type IconName } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatAtoms";
import { useT } from "@/hooks/useT";

export function ChatHeader({
  chat,
  onBack,
  showMenu,
  setShowMenu,
  onOpenProfile,
  onCall,
  onVideoCall,
  searchQuery,
  setSearchQuery,
  showSearch,
  setShowSearch,
  onToggleMute,
  onTogglePin,
  onToggleFavorite,
  onClearHistory,
  onBlock,
  onToggleArchive,
  onSetDisappearing,
  disappearingSeconds,
  onChooseWallpaper,
}: {
  chat: Chat;
  onBack: () => void;
  showMenu: boolean;
  setShowMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
  onOpenProfile?: () => void;
  onCall?: (partnerId: number, name: string) => void;
  onVideoCall?: (partnerId: number, name: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  onToggleMute: () => void;
  onTogglePin: () => void;
  onToggleFavorite: () => void;
  onClearHistory: () => void;
  onBlock: () => void;
  onToggleArchive: () => void;
  onSetDisappearing?: () => void;
  disappearingSeconds?: number | null;
  onChooseWallpaper?: () => void;
}) {
  const { t } = useT();
  if (showSearch) {
    return (
      <div className="flex items-center gap-2 px-3 glass-strong border-b border-white/5" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))", paddingBottom: "0.75rem" }}>
        <button
          onClick={() => { setShowSearch(false); setSearchQuery(""); }}
          className="p-2 rounded-xl hover:bg-white/8 transition-colors"
        >
          <Icon name="ChevronLeft" size={20} />
        </button>
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
          <Icon name="Search" size={16} className="text-muted-foreground" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("chat.searchInChat")}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  const menuItems: Array<{ icon: IconName; label: string; red?: boolean; active?: boolean; onClick: () => void }> = [
    ...(onOpenProfile ? [{ icon: "User" as IconName, label: t("partner.title"), onClick: onOpenProfile }] : []),
    { icon: "Search", label: t("chat.searchInChat"), onClick: () => setShowSearch(true) },
    { icon: chat.muted ? "BellOff" : "Bell", label: chat.muted ? t("chat.muteOn") : t("chat.muteOff"), active: chat.muted, onClick: onToggleMute },
    { icon: "Pin", label: chat.pinned ? t("chat.unpin") : t("chat.pin"), active: chat.pinned, onClick: onTogglePin },
    { icon: "Star", label: chat.favorite ? t("chat.favoriteOff") : t("chat.favoriteOn"), active: chat.favorite, onClick: onToggleFavorite },
    { icon: "Archive", label: chat.archived ? t("chat.archiveOff") : t("chat.archiveOn"), active: chat.archived, onClick: onToggleArchive },
    ...(onSetDisappearing ? [{
      icon: "Timer" as IconName,
      label: disappearingSeconds
        ? `${t("chat.disappearing")}: ${disappearingSeconds === 10 ? "10s" : disappearingSeconds === 60 ? "1m" : disappearingSeconds === 300 ? "5m" : disappearingSeconds === 3600 ? "1h" : disappearingSeconds === 86400 ? "24h" : "7d"}`
        : t("chat.disappearing"),
      active: !!disappearingSeconds,
      onClick: onSetDisappearing,
    }] : []),
    ...(onChooseWallpaper ? [{ icon: "Image" as IconName, label: t("chat.wallpaper"), onClick: onChooseWallpaper }] : []),
    { icon: "Trash2", label: t("chat.clearHistory"), red: true, onClick: onClearHistory },
    { icon: "Ban", label: t("chat.block"), red: true, onClick: onBlock },
  ];

  return (
    <div className="flex items-center gap-2 px-3 glass-strong border-b border-white/5 relative" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))", paddingBottom: "0.5rem" }}>
      <button onClick={onBack} className="md:hidden p-2 rounded-xl hover:bg-white/8 transition-colors">
        <Icon name="ChevronLeft" size={20} />
      </button>
      <button
        type="button"
        className="flex-1 flex items-center gap-3 min-w-0 select-none cursor-pointer text-left"
        onClick={() => (onOpenProfile ? onOpenProfile() : setShowMenu(true))}
        onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
      >
        <Avatar label={chat.avatar} id={chat.id} size="md" online={chat.online} src={chat.avatar_url || undefined} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground truncate">{chat.name}</span>
            {chat.muted && <Icon name="BellOff" size={12} className="text-muted-foreground flex-shrink-0" />}
            {chat.pinned && <Icon name="Pin" size={12} className="text-violet-400 flex-shrink-0" />}
            {chat.group && <span className="text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full font-medium">{t("chat.groupBadge")}</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {chat.typing ? (
              <span className="text-violet-400">{t("common.typing")}</span>
            ) : chat.online ? (
              <span className="text-emerald-400">{t("partner.online")}</span>
            ) : (
              t("partner.recently")
            )}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onCall && chat.partner_id && onCall(chat.partner_id, chat.name)}
          className="p-2 rounded-xl hover:bg-white/8 transition-colors text-emerald-400 hover:text-emerald-300"
        >
          <Icon name="Phone" size={18} />
        </button>
        <button
          onClick={() => onVideoCall && chat.partner_id && onVideoCall(chat.partner_id, chat.name)}
          className="p-2 rounded-xl hover:bg-white/8 transition-colors text-sky-400 hover:text-sky-300"
        >
          <Icon name="Video" size={18} />
        </button>
        <button
          onClick={() => setShowMenu(true)}
          className="p-2 rounded-xl hover:bg-white/8 transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Меню"
        >
          <Icon name="MoreVertical" size={18} />
        </button>
      </div>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 animate-fade-in" onClick={() => setShowMenu(false)} />
          <div
            className="absolute right-3 top-[calc(env(safe-area-inset-top)+3.5rem)] z-50 rounded-2xl overflow-hidden shadow-2xl border border-white/10 min-w-[240px] animate-scale-in"
            style={{ backgroundColor: "#16151f" }}
          >
            {menuItems.map(item => (
              <button
                key={item.label}
                onClick={() => { setShowMenu(false); item.onClick(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 transition-colors text-sm ${item.red ? "text-red-400 hover:bg-red-500/10" : ""} ${item.active ? "text-violet-400" : ""}`}
              >
                <Icon name={item.icon} size={16} className={item.red ? "text-red-400" : item.active ? "text-violet-400" : "text-muted-foreground"} />
                <span className="text-left flex-1">{item.label}</span>
                {item.active && <Icon name="Check" size={14} className="text-violet-400" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ChatHeader;