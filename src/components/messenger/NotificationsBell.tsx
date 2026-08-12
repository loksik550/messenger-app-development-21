import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";

export interface UserNotif {
  id: number;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  created_at: number;
}

const KIND_META: Record<string, { icon: string; color: string }> = {
  verification: { icon: "BadgeCheck", color: "text-sky-400" },
  ban: { icon: "ShieldX", color: "text-red-400" },
  unban: { icon: "ShieldCheck", color: "text-emerald-400" },
  system: { icon: "Bell", color: "text-violet-400" },
};

function timeAgo(ts: number) {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`;
  return new Date(ts * 1000).toLocaleDateString("ru", { day: "numeric", month: "short" });
}

export default function NotificationsBell({
  currentUser, items, unread, onRefresh,
}: {
  currentUser: User;
  items: UserNotif[];
  unread: number;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api("my_notifications_read", {}, currentUser.id);
      onRefresh();
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={toggle}
        className="relative p-2 rounded-full hover:bg-accent transition-colors"
        aria-label="Уведомления"
      >
        <Icon name="Bell" size={20} className="text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full grad-primary text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[300px] max-w-[calc(100vw-2rem)] glass-strong rounded-2xl shadow-2xl overflow-hidden z-[120] animate-scale-in">
          <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
            <span className="text-sm font-semibold">Уведомления</span>
            <button onClick={onRefresh} className="text-muted-foreground hover:text-foreground transition">
              <Icon name="RefreshCw" size={13} />
            </button>
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-10 text-center">
                <Icon name="BellOff" size={26} className="text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Уведомлений пока нет</p>
              </div>
            ) : (
              items.map((n) => {
                const meta = KIND_META[n.kind] || KIND_META.system;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0 ${
                      n.read ? "" : "bg-violet-500/[0.06]"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${meta.color}`}>
                      <Icon name={meta.icon} size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{n.title}</div>
                      {n.body && (
                        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</div>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-violet-500 mt-1.5 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
