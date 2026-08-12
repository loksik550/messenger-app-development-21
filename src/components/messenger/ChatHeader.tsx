import Icon from "@/components/ui/icon";
import { type Chat, getCallAvatar, formatLastSeen } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatAtoms";
import { useT } from "@/hooks/useT";

// Пункты меню чата перенесены в профиль собеседника,
// но пропсы сохранены для совместимости с вызывающим кодом.
export function ChatHeader({
  chat,
  onBack,
  onOpenProfile,
  onCall,
  onVideoCall,
  searchQuery,
  setSearchQuery,
  showSearch,
  setShowSearch,
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

  return (
    <div className="flex items-center gap-2 px-3 glass-strong border-b border-white/5 relative" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))", paddingBottom: "0.5rem" }}>
      <button onClick={onBack} className="md:hidden p-2 rounded-xl hover:bg-white/8 transition-colors">
        <Icon name="ChevronLeft" size={20} />
      </button>
      <button
        type="button"
        className="flex-1 flex items-center gap-3 min-w-0 select-none cursor-pointer text-left"
        onClick={() => onOpenProfile?.()}
        onContextMenu={(e) => { e.preventDefault(); onOpenProfile?.(); }}
      >
        <Avatar label={chat.avatar} id={chat.id} size="md" online={chat.online} src={(chat.partner_id ? getCallAvatar(chat.partner_id) : null) || chat.avatar_url || undefined} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground truncate">{chat.name}</span>
            {chat.verified && <Icon name="BadgeCheck" size={14} className="text-sky-400 flex-shrink-0" />}
            {chat.muted && <Icon name="BellOff" size={12} className="text-muted-foreground flex-shrink-0" />}
            {chat.pinned && <Icon name="Pin" size={12} className="text-violet-400 flex-shrink-0" />}
            {chat.group && <span className="text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full font-medium">{t("chat.groupBadge")}</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {chat.typing ? (
              <span className="text-violet-400">{t("common.typing")}</span>
            ) : chat.online ? (
              <span className="text-emerald-400">{t("partner.online")}</span>
            ) : chat.group ? (
              t("partner.recently")
            ) : (
              formatLastSeen(chat.lastSeen)
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
      </div>
    </div>
  );
}

export default ChatHeader;