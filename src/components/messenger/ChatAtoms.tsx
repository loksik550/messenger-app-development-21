import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { avatarGrad, type Chat } from "@/lib/api";
import { MediaViewer } from "@/components/messenger/MediaViewer";
import usePullToRefresh from "@/hooks/usePullToRefresh";

// ─── Avatar ───────────────────────────────────────────────────────────────────

export function Avatar({ label, id, size = "md", online, src, zoomable }: { label: string; id: number; size?: "sm" | "md" | "lg" | "xl"; online?: boolean; src?: string | null; zoomable?: boolean }) {
  const [open, setOpen] = useState(false);
  const sz = { sm: "w-9 h-9 text-sm", md: "w-11 h-11 text-base", lg: "w-14 h-14 text-xl", xl: "w-20 h-20 text-3xl" }[size];
  const canZoom = zoomable && !!src;
  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${sz} rounded-full bg-gradient-to-br ${avatarGrad(id)} flex items-center justify-center font-bold text-white overflow-hidden ${canZoom ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
        onClick={canZoom ? (e) => { e.stopPropagation(); setOpen(true); } : undefined}
      >
        {src ? (
          <img src={src} alt={label} className="w-full h-full object-cover" />
        ) : (
          label
        )}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[hsl(var(--background))] rounded-full" />
      )}
      {open && src && (
        <MediaViewer items={[{ url: src, type: "image" }]} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

// ─── TypingIndicator ──────────────────────────────────────────────────────────

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <div className="typing-dot w-2 h-2 rounded-full bg-violet-400" />
      <div className="typing-dot w-2 h-2 rounded-full bg-violet-400" />
      <div className="typing-dot w-2 h-2 rounded-full bg-violet-400" />
    </div>
  );
}

// ─── ChatList ─────────────────────────────────────────────────────────────────

type ChatFilter = "all" | "unread" | "groups" | "personal";

export function ChatList({
  chats, onSelect, selectedId,
  onToggleMute, onToggleArchive, onRefresh,
}: {
  chats: Chat[];
  onSelect: (c: Chat) => void;
  selectedId?: number;
  onToggleMute?: (c: Chat) => void;
  onToggleArchive?: (c: Chat) => void;
  onRefresh?: () => Promise<void> | void;
}) {
  const [filter, setFilter] = useState<ChatFilter>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pull, refreshing, threshold } = usePullToRefresh(scrollRef, onRefresh || (() => {}));

  const filtered = chats.filter(c => {
    if (filter === "unread") return (c.unread || 0) > 0;
    if (filter === "groups") return !!c.group;
    if (filter === "personal") return !c.group;
    return true;
  });

  const pinned = filtered.filter(c => c.pinned);
  const rest = filtered.filter(c => !c.pinned);

  const ChatRow = ({ chat }: { chat: Chat }) => {
    const [dx, setDx] = useState(0);
    const [menu, setMenu] = useState(false);
    const startX = useRef<number | null>(null);
    const startY = useRef<number | null>(null);
    const horizontal = useRef(false);
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const moved = useRef(false);

    const cancelHold = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } };
    const startHold = () => {
      moved.current = false;
      cancelHold();
      holdTimer.current = setTimeout(() => {
        try { (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(15); } catch { /* ignore */ }
        setMenu(true);
      }, 450);
    };

    const onTouchStart = (e: React.TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      horizontal.current = false;
      startHold();
    };
    const onTouchMove = (e: React.TouchEvent) => {
      if (startX.current === null || startY.current === null) return;
      const dxRaw = e.touches[0].clientX - startX.current;
      const dyRaw = e.touches[0].clientY - startY.current;
      if (Math.abs(dxRaw) > 6 || Math.abs(dyRaw) > 6) { moved.current = true; cancelHold(); }
      if (!horizontal.current && Math.abs(dxRaw) > 8 && Math.abs(dxRaw) > Math.abs(dyRaw)) {
        horizontal.current = true;
      }
      if (horizontal.current) {
        // ограничиваем диапазон, чтобы не уезжало далеко
        setDx(Math.max(-110, Math.min(110, dxRaw)));
      }
    };
    const onTouchEnd = () => {
      cancelHold();
      if (horizontal.current) {
        if (dx <= -70 && onToggleMute) onToggleMute(chat);
        else if (dx >= 70 && onToggleArchive) onToggleArchive(chat);
      }
      setDx(0);
      startX.current = null;
      startY.current = null;
      horizontal.current = false;
    };

    const menuItems: { icon: string; label: string; red?: boolean; onClick: () => void }[] = [
      ...(onToggleMute ? [{ icon: chat.muted ? "Bell" : "BellOff", label: chat.muted ? "Включить уведомления" : "Выключить уведомления", onClick: () => onToggleMute(chat) }] : []),
      ...(onToggleArchive ? [{ icon: chat.archived ? "ArchiveRestore" : "Archive", label: chat.archived ? "Из архива" : "В архив", onClick: () => onToggleArchive(chat) }] : []),
      { icon: "MailOpen", label: "Открыть чат", onClick: () => onSelect(chat) },
    ];

    return (
      <div className="relative mx-2 overflow-hidden rounded-2xl">
        {menu && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setMenu(false)}>
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 min-w-[240px] max-w-[320px] animate-scale-in" style={{ backgroundColor: "#16151f" }} onClick={e => e.stopPropagation()}>
              <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3">
                <Avatar label={chat.avatar} id={chat.id} src={chat.avatar_url || undefined} size="sm" />
                <span className="font-semibold text-sm truncate">{chat.name}</span>
              </div>
              {menuItems.map(item => (
                <button
                  key={item.label}
                  onClick={() => { setMenu(false); item.onClick(); }}
                  className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-white/8 transition-colors text-sm ${item.red ? "text-red-400 hover:bg-red-500/10" : ""}`}
                >
                  <Icon name={item.icon} size={16} className={item.red ? "" : "text-muted-foreground"} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* фон под свайпом */}
        {dx !== 0 && (
          <div className="absolute inset-0 flex items-center justify-between px-5 text-xs font-semibold pointer-events-none">
            <span className={`transition-opacity ${dx > 0 ? "opacity-100" : "opacity-0"} text-amber-400 flex items-center gap-1.5`}>
              <Icon name={chat.archived ? "ArchiveRestore" : "Archive"} size={16} />
              {chat.archived ? "Из архива" : "В архив"}
            </span>
            <span className={`transition-opacity ${dx < 0 ? "opacity-100" : "opacity-0"} text-violet-400 flex items-center gap-1.5`}>
              <Icon name={chat.muted ? "Bell" : "BellOff"} size={16} />
              {chat.muted ? "Включить" : "Заглушить"}
            </span>
          </div>
        )}
        <button
          onClick={() => { if (Math.abs(dx) < 5 && !menu) onSelect(chat); }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onContextMenu={(e) => { e.preventDefault(); setMenu(true); }}
          style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? "transform 0.2s ease" : "none" }}
          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors rounded-2xl
            ${selectedId === chat.id ? "bg-white/8 glass" : "bg-[hsl(var(--background))] hover:bg-white/4"}`}
        >
          <Avatar label={chat.avatar} id={chat.id} online={chat.online} src={chat.avatar_url || undefined} />
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                {chat.pinned && <Icon name="Pin" size={11} className="text-violet-400 flex-shrink-0" />}
                {chat.group && <Icon name="Users" size={12} className="text-sky-400 flex-shrink-0" />}
                <span className="font-semibold text-sm text-foreground truncate">{chat.name}</span>
                {chat.muted && <Icon name="BellOff" size={11} className="text-muted-foreground flex-shrink-0" />}
              </div>
              <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">{chat.time}</span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              {chat.typing ? (
                <span className="text-xs text-violet-400 font-medium">печатает...</span>
              ) : (
                <span className="text-xs text-muted-foreground truncate">{chat.lastMsg}</span>
              )}
              {chat.unread ? (
                <span className={`ml-2 flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${chat.muted ? "bg-white/15" : "grad-primary"}`}>
                  {chat.unread}
                </span>
              ) : null}
            </div>
          </div>
        </button>
      </div>
    );
  };

  const tabs: { key: ChatFilter; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "unread", label: "Непрочитанные" },
    { key: "groups", label: "Группы" },
    { key: "personal", label: "Личные" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 overflow-x-auto scrollbar-none flex-shrink-0">
        {tabs.map(t => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
                active ? "grad-primary text-white" : "glass text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-2 space-y-0.5 relative">
        {(pull > 0 || refreshing) && onRefresh && (
          <div
            className="absolute left-0 right-0 top-0 flex items-center justify-center text-violet-400 pointer-events-none"
            style={{ height: Math.max(pull, refreshing ? threshold : 0), transition: refreshing ? "height 0.2s ease" : "none" }}
          >
            {refreshing ? (
              <Icon name="Loader2" size={18} className="animate-spin" />
            ) : (
              <Icon name="ArrowDown" size={18} style={{ transform: `rotate(${Math.min(180, (pull / threshold) * 180)}deg)`, transition: "transform 0.1s linear" }} />
            )}
          </div>
        )}
        <div style={{ paddingTop: pull > 0 ? pull : 0, transition: pull === 0 ? "padding-top 0.2s ease" : "none" }}>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <div className="w-16 h-16 glass rounded-3xl flex items-center justify-center mb-4">
              <Icon name="MessageCircle" size={28} className="text-violet-400" />
            </div>
            <p className="font-semibold mb-1">
              {filter === "all" ? "Чатов пока нет" : "Ничего не найдено"}
            </p>
            <p className="text-sm text-muted-foreground">
              {filter === "all" ? "Найди людей через поиск или добавь контакты" : "Попробуй другой фильтр"}
            </p>
          </div>
        )}
        {pinned.length > 0 && (
          <>
            <div className="px-6 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Закреплённые</div>
            {pinned.map((c) => <ChatRow key={c.id} chat={c} />)}
            <div className="px-6 py-1 mt-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Все чаты</div>
          </>
        )}
        {rest.map((c) => <ChatRow key={c.id} chat={c} />)}
        </div>
      </div>
    </div>
  );
}