import { useEffect, useState } from "react";
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

const KIND_META: Record<string, { icon: string; color: string; bg: string }> = {
  verification: { icon: "BadgeCheck", color: "text-sky-400", bg: "bg-sky-500/15" },
  ban: { icon: "ShieldX", color: "text-red-400", bg: "bg-red-500/15" },
  unban: { icon: "ShieldCheck", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  promo: { icon: "Gift", color: "text-amber-400", bg: "bg-amber-500/15" },
  premium: { icon: "Crown", color: "text-amber-400", bg: "bg-amber-500/15" },
  referral: { icon: "Users", color: "text-violet-400", bg: "bg-violet-500/15" },
  system: { icon: "Bell", color: "text-violet-400", bg: "bg-violet-500/15" },
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const openPanel = async () => {
    setOpen(true);
    if (unread > 0) {
      await api("my_notifications_read", {}, currentUser.id);
      onRefresh();
    }
  };

  return (
    <>
      <button
        onClick={openPanel}
        className="relative p-2 rounded-full hover:bg-accent transition-colors"
        aria-label="Уведомления"
      >
        <Icon name="Bell" size={20} className="text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full grad-primary text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[300] flex items-end sm:items-start sm:justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md sm:mt-20 bg-[#12131f] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 sm:hidden" />

            <div className="px-5 py-4 flex items-center justify-between border-b border-white/8">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl grad-primary flex items-center justify-center">
                  <Icon name="Bell" size={17} className="text-white" />
                </div>
                <div>
                  <div className="font-bold text-[15px]">Уведомления</div>
                  <div className="text-[11px] text-muted-foreground">
                    {items.length === 0 ? "Пока пусто" : `Всего ${items.length}`}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl hover:bg-white/8 transition text-muted-foreground"
              >
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {items.length === 0 ? (
                <div className="py-16 text-center px-6">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <Icon name="BellOff" size={28} className="text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium mb-1">Уведомлений пока нет</p>
                  <p className="text-xs text-muted-foreground">
                    Здесь появятся сообщения о подтверждении аккаунта, подарках и новостях
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {items.map((n) => {
                    const meta = KIND_META[n.kind] || KIND_META.system;
                    return (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 p-3 rounded-2xl mb-1 transition ${
                          n.read ? "hover:bg-white/[0.03]" : "bg-violet-500/[0.08]"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}
                        >
                          <Icon name={meta.icon} size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <div className="text-sm font-semibold flex-1 leading-snug">{n.title}</div>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                            )}
                          </div>
                          {n.body && (
                            <div className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                              {n.body}
                            </div>
                          )}
                          <div className="text-[11px] text-muted-foreground/60 mt-1.5">
                            {timeAgo(n.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
