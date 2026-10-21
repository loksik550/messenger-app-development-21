import { useRef, useState } from "react";
import { getDraft } from "@/lib/drafts";
import Icon from "@/components/ui/icon";
import { avatarGrad, getCallAvatar, type Chat } from "@/lib/api";
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

const ACTION_W = 76;

type RowProps = {
  chat: Chat;
  selectedId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (c: Chat) => void;
  onToggleMute?: (c: Chat) => void;
  onToggleArchive?: (c: Chat) => void;
  onDelete?: (c: Chat) => void;
};

function ChatRow({ chat, selectedId, open, onOpenChange, onSelect, onToggleMute, onToggleArchive, onDelete }: RowProps) {
  const actions: { key: string; icon: string; label: string; bg: string; run: () => void }[] = [
    ...(onToggleMute ? [{ key: "mute", icon: chat.muted ? "Volume2" : "VolumeX", label: chat.muted ? "Вкл. звук" : "Убрать звук", bg: "#c27c2c", run: () => onToggleMute(chat) }] : []),
    ...(onDelete ? [{ key: "del", icon: "Trash2", label: "Удалить", bg: "#b8291f", run: () => onDelete(chat) }] : []),
    ...(onToggleArchive ? [{ key: "arch", icon: chat.archived ? "ArchiveRestore" : "Archive", label: chat.archived ? "Из архива" : "В архив", bg: "#6b6b6b", run: () => onToggleArchive(chat) }] : []),
  ];
  const maxOpen = actions.length * ACTION_W;
  const base = open ? -maxOpen : 0;
  const [drag, setDrag] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const horizontal = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swiped = useRef(false);

  const dx = drag ?? base;

  const cancelHold = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } };
  const startHold = () => {
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
    swiped.current = false;
    startHold();
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null || !actions.length) return;
    const dxRaw = e.touches[0].clientX - startX.current;
    const dyRaw = e.touches[0].clientY - startY.current;
    if (Math.abs(dxRaw) > 6 || Math.abs(dyRaw) > 6) cancelHold();
    if (!horizontal.current && Math.abs(dxRaw) > 8 && Math.abs(dxRaw) > Math.abs(dyRaw) * 1.2) {
      horizontal.current = true;
    }
    if (horizontal.current) {
      swiped.current = true;
      let next = base + dxRaw;
      if (next > 0) next = 0;
      if (next < -maxOpen) next = -maxOpen - (-maxOpen - next) * 0.25;
      setDrag(next);
    }
  };
  const onTouchEnd = () => {
    cancelHold();
    if (horizontal.current && drag !== null) {
      const shouldOpen = open ? drag < -maxOpen * 0.7 : drag < -maxOpen * 0.3;
      onOpenChange(shouldOpen);
    }
    setDrag(null);
    startX.current = null;
    startY.current = null;
    horizontal.current = false;
  };

  const runAction = (a: { run: () => void }) => { onOpenChange(false); a.run(); };

  const menuItems: { icon: string; label: string; red?: boolean; onClick: () => void }[] = [
    ...(onToggleMute ? [{ icon: chat.muted ? "Bell" : "BellOff", label: chat.muted ? "Включить уведомления" : "Выключить уведомления", onClick: () => onToggleMute(chat) }] : []),
    ...(onToggleArchive ? [{ icon: chat.archived ? "ArchiveRestore" : "Archive", label: chat.archived ? "Из архива" : "В архив", onClick: () => onToggleArchive(chat) }] : []),
    { icon: "MailOpen", label: "Открыть чат", onClick: () => onSelect(chat) },
    ...(onDelete ? [{ icon: "Trash2", label: "Удалить чат", red: true, onClick: () => onDelete(chat) }] : []),
  ];

  const reveal = Math.min(1, Math.max(0, -dx / maxOpen));

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
      {dx < 0 && (
        <div className="absolute inset-y-0 right-0 flex items-center" style={{ width: maxOpen, opacity: reveal }}>
          {actions.map(a => (
            <button
              key={a.key}
              onClick={(e) => { e.stopPropagation(); runAction(a); }}
              className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
              style={{ width: ACTION_W }}
            >
              <span className="w-[62px] h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: a.bg }}>
                <Icon name={a.icon} size={17} />
              </span>
              <span className="text-[10.5px] text-muted-foreground leading-none whitespace-nowrap">{a.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => {
          if (swiped.current) { swiped.current = false; return; }
          if (open) { onOpenChange(false); return; }
          if (!menu) onSelect(chat);
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onContextMenu={(e) => { e.preventDefault(); setMenu(true); }}
        style={{ transform: `translateX(${dx}px)`, transition: drag === null ? "transform 0.25s cubic-bezier(.2,.8,.2,1)" : "none", touchAction: "pan-y" }}
        className={`relative w-full flex items-center gap-3 px-4 py-3 transition-colors rounded-2xl
          ${selectedId === chat.id ? "bg-white/8 glass" : "bg-[hsl(var(--background))] hover:bg-white/4"}`}
      >
          <Avatar label={chat.avatar} id={chat.id} online={chat.online} src={(chat.partner_id ? getCallAvatar(chat.partner_id) : null) || chat.avatar_url || undefined} />
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                {chat.pinned && <Icon name="Pin" size={11} className="text-violet-400 flex-shrink-0" />}
                {chat.group && <Icon name="Users" size={12} className="text-sky-400 flex-shrink-0" />}
                <span className="font-semibold text-sm text-foreground truncate">{chat.name}</span>
                {chat.muted && <Icon name="BellOff" size={11} className="text-muted-foreground flex-shrink-0" />}
              </div>
              <span className="flex items-center gap-1 flex-shrink-0 ml-2">
                {chat.lastMine && !chat.group && !chat.saved && chat.time && (
                  <Icon
                    name={chat.lastRead ? "CheckCheck" : "Check"}
                    size={14}
                    className={chat.lastRead ? "text-sky-400" : "text-muted-foreground"}
                  />
                )}
                <span className="text-[11px] text-muted-foreground">{chat.time}</span>
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              {chat.typing ? (
                <span className="text-xs text-violet-400 font-medium">печатает...</span>
              ) : (chat.group ? "" : getDraft(`c${chat.id}`)) && selectedId !== chat.id ? (
                <span className="text-xs truncate"><span className="text-red-400">Черновик: </span><span className="text-muted-foreground">{getDraft(`c${chat.id}`)}</span></span>
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
}

// ─── ChatList ─────────────────────────────────────────────────────────────────

type ChatFilter = "all" | "unread" | "groups" | "personal";

export function ChatList({
  chats, onSelect, selectedId,
  onToggleMute, onToggleArchive, onDelete, onRefresh, onStartChat,
}: {
  chats: Chat[];
  onSelect: (c: Chat) => void;
  selectedId?: number;
  onToggleMute?: (c: Chat) => void;
  onToggleArchive?: (c: Chat) => void;
  onDelete?: (c: Chat, forAll: boolean) => void;
  onRefresh?: () => Promise<void> | void;
  onStartChat?: () => void;
}) {
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Chat | null>(null);
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
      {deleteTarget && (
        <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 animate-fade-in" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm glass-strong rounded-3xl p-5 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <Avatar label={deleteTarget.avatar} id={deleteTarget.id} src={deleteTarget.avatar_url || undefined} size="sm" />
              <h3 className="font-bold text-base truncate">Удалить чат с {deleteTarget.name}?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Переписка исчезнет из списка. Это действие нельзя отменить.</p>
            <div className="flex flex-col gap-2">
              {!deleteTarget.group && (
                <button
                  onClick={() => { const c = deleteTarget; setDeleteTarget(null); setOpenId(null); onDelete?.(c, true); }}
                  className="w-full rounded-xl py-3 text-sm font-bold text-white bg-red-500 hover:bg-red-600"
                >
                  Удалить у меня и у {deleteTarget.name}
                </button>
              )}
              <button
                onClick={() => { const c = deleteTarget; setDeleteTarget(null); setOpenId(null); onDelete?.(c, false); }}
                className="w-full rounded-xl py-3 text-sm font-semibold text-red-400 glass hover:bg-red-500/10"
              >
                Удалить только у меня
              </button>
              <button onClick={() => setDeleteTarget(null)} className="w-full rounded-xl py-3 text-sm font-semibold glass">Отмена</button>
            </div>
          </div>
        </div>
      )}
      <div ref={scrollRef} onScroll={() => { if (openId !== null) setOpenId(null); }} className="flex-1 overflow-y-auto py-2 space-y-0.5 relative">
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
            {filter === "all" && onStartChat && (
              <button
                onClick={onStartChat}
                className="mt-4 grad-primary text-white rounded-xl px-4 py-2.5 text-sm font-semibold glow-primary hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Icon name="UserPlus" size={16} />
                Начать общение
              </button>
            )}
          </div>
        )}
        {pinned.length > 0 && (
          <>
            <div className="px-6 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Закреплённые</div>
            {pinned.map((c) => <ChatRow
              key={c.id}
              chat={c}
              selectedId={selectedId}
              open={openId === c.id}
              onOpenChange={(o) => setOpenId(o ? c.id : (openId === c.id ? null : openId))}
              onSelect={onSelect}
              onToggleMute={onToggleMute}
              onToggleArchive={onToggleArchive}
              onDelete={onDelete ? (ch) => setDeleteTarget(ch) : undefined}
            />)}
            <div className="px-6 py-1 mt-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Все чаты</div>
          </>
        )}
        {rest.map((c) => <ChatRow
              key={c.id}
              chat={c}
              selectedId={selectedId}
              open={openId === c.id}
              onOpenChange={(o) => setOpenId(o ? c.id : (openId === c.id ? null : openId))}
              onSelect={onSelect}
              onToggleMute={onToggleMute}
              onToggleArchive={onToggleArchive}
              onDelete={onDelete ? (ch) => setDeleteTarget(ch) : undefined}
            />)}
        </div>
      </div>
    </div>
  );
}