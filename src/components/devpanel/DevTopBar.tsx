import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { DevEnvBadge } from "./DevStatusBar";
import { devApi, timeAgo, type DevAdmin } from "@/lib/devApi";

interface Notif {
  id: number;
  kind: string;
  title: string;
  body: string;
  section: string;
  read: boolean;
  created_at: number;
}

const KIND_ICON: Record<string, { icon: string; color: string }> = {
  verification: { icon: "BadgeCheck", color: "text-sky-400" },
  report: { icon: "Flag", color: "text-red-400" },
  support: { icon: "LifeBuoy", color: "text-amber-400" },
  signup: { icon: "UserPlus", color: "text-emerald-400" },
};

const ROLE_COLOR: Record<string, string> = {
  owner: "bg-amber-500/20 text-amber-400",
  admin: "bg-violet-500/20 text-violet-400",
  moderator: "bg-cyan-500/20 text-cyan-400",
  analyst: "bg-emerald-500/20 text-emerald-400",
  developer: "bg-slate-500/20 text-slate-300",
};

export default function DevTopBar({
  admin, title, onMenu, onLogout, onOpenSettings, onNavigate,
  light, compact, onToggleLight, onToggleCompact,
}: {
  admin: DevAdmin;
  title: string;
  onMenu: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onNavigate: (section: string) => void;
  light?: boolean;
  compact?: boolean;
  onToggleLight?: () => void;
  onToggleCompact?: () => void;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await devApi<{ items: Notif[]; unread: number }>("notifications");
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const openNotifs = async () => {
    setProfileOpen(false);
    const next = !notifOpen;
    setNotifOpen(next);
    if (next && unread > 0) {
      try {
        await devApi("notifications_read");
        setUnread(0);
        setItems((prev) => prev.map((i) => ({ ...i, read: true })));
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <header className="px-4 lg:px-8 py-3 border-b border-white/8 flex items-center gap-3 sticky top-0 bg-[#0a0b14]/85 backdrop-blur-xl z-30">
      <button onClick={onMenu} className="lg:hidden p-2 -ml-2 text-slate-400">
        <Icon name="Menu" size={20} />
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2.5">
        <h1 className="text-lg font-bold truncate">{title}</h1>
        <DevEnvBadge />
      </div>

      <div ref={wrapRef} className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Online
        </div>

        {onToggleCompact && (
          <button
            onClick={onToggleCompact}
            title={compact ? "Обычные строки" : "Компактные строки"}
            className={`p-2.5 rounded-xl border transition hidden sm:block ${
              compact
                ? "bg-violet-600/20 border-violet-500/40 text-violet-300"
                : "bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/10"
            }`}
          >
            <Icon name={compact ? "Rows2" : "Rows3"} size={17} />
          </button>
        )}

        {onToggleLight && (
          <button
            onClick={onToggleLight}
            title={light ? "Тёмная тема" : "Светлая тема"}
            className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 hover:bg-white/10 transition"
          >
            <Icon name={light ? "Moon" : "Sun"} size={17} />
          </button>
        )}

        {/* Колокольчик */}
        <div className="relative">
          <button
            onClick={openNotifs}
            className="relative p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 transition"
            title="Уведомления"
          >
            <Icon name="Bell" size={17} className="text-slate-300" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-[#12131f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                <span className="text-sm font-semibold">Уведомления</span>
                <button onClick={load} className="text-slate-500 hover:text-slate-300">
                  <Icon name="RefreshCw" size={13} />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-center text-xs text-slate-600 py-8">Пока пусто</p>
                ) : (
                  items.map((n) => {
                    const meta = KIND_ICON[n.kind] || { icon: "Bell", color: "text-slate-400" };
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          setNotifOpen(false);
                          if (n.section) onNavigate(n.section);
                        }}
                        className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition border-b border-white/5 last:border-0"
                      >
                        <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${meta.color}`}>
                          <Icon name={meta.icon} size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{n.title}</div>
                          {n.body && <div className="text-xs text-slate-500 truncate mt-0.5">{n.body}</div>}
                          <div className="text-[10px] text-slate-600 mt-0.5">{timeAgo(n.created_at)}</div>
                        </div>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-violet-500 mt-1.5 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Профиль */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(false); setProfileOpen(!profileOpen); }}
            className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 transition"
          >
            {admin.avatar_url ? (
              <img src={admin.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-xs font-bold shrink-0">
                {(admin.name || admin.email).slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-left min-w-0 max-w-[140px]">
              <div className="text-xs font-medium truncate">{admin.name || "Администратор"}</div>
              <div className="text-[10px] text-slate-500 truncate">
                {admin.title || admin.role_label || admin.role}
              </div>
            </div>
            <Icon name="ChevronDown" size={14} className="text-slate-500 shrink-0" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[#12131f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-white/8">
                <div className="flex items-center gap-3">
                  {admin.avatar_url ? (
                    <img src={admin.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {(admin.name || admin.email).slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{admin.name || "Администратор"}</div>
                    <div className="text-[10px] text-slate-500 truncate">{admin.email}</div>
                  </div>
                </div>
                <span
                  className={`inline-block mt-2.5 text-[10px] px-2 py-0.5 rounded-full ${
                    ROLE_COLOR[admin.role] || ROLE_COLOR.developer
                  }`}
                >
                  {admin.title || admin.role_label || admin.role}
                </span>
              </div>

              <button
                onClick={() => { setProfileOpen(false); onOpenSettings(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 transition"
              >
                <Icon name="Settings" size={16} className="text-slate-500" />
                Настройки профиля
              </button>
              <button
                onClick={() => { setProfileOpen(false); onNavigate("team"); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 transition"
              >
                <Icon name="UserCog" size={16} className="text-slate-500" />
                Команда и роли
              </button>
              <button
                onClick={() => { setProfileOpen(false); onLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition border-t border-white/8"
              >
                <Icon name="LogOut" size={16} />
                Выйти из панели
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
