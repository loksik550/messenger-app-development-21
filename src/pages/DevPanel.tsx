import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, getDevToken, clearDevToken, type DevAdmin } from "@/lib/devApi";
import DevAuth from "@/components/devpanel/DevAuth";
import DevDashboard, { Loading } from "@/components/devpanel/DevDashboard";
import DevUsers from "@/components/devpanel/DevUsers";
import DevLogs from "@/components/devpanel/DevLogs";
import DevSupport from "@/components/devpanel/DevSupport";
import DevServices from "@/components/devpanel/DevServices";
import DevReports from "@/components/devpanel/DevReports";
import DevChannels from "@/components/devpanel/DevChannels";
import DevTeam from "@/components/devpanel/DevTeam";
import DevSettings from "@/components/devpanel/DevSettings";

type Section =
  | "dashboard" | "users" | "channels" | "reports"
  | "support" | "logs" | "services" | "team" | "settings";

const NAV: { key: Section; label: string; icon: string; perm: string }[] = [
  { key: "dashboard", label: "Дашборд", icon: "LayoutDashboard", perm: "dashboard" },
  { key: "users", label: "Пользователи", icon: "Users", perm: "users" },
  { key: "channels", label: "Каналы и группы", icon: "Radio", perm: "channels" },
  { key: "reports", label: "Жалобы", icon: "Flag", perm: "reports" },
  { key: "support", label: "Поддержка", icon: "LifeBuoy", perm: "support" },
  { key: "logs", label: "Логи и события", icon: "ScrollText", perm: "logs" },
  { key: "services", label: "Серверы и доступ", icon: "Server", perm: "services" },
  { key: "team", label: "Команда", icon: "UserCog", perm: "team" },
  { key: "settings", label: "Настройки", icon: "Settings", perm: "dashboard" },
];

const ROLE_COLOR: Record<string, string> = {
  owner: "bg-amber-500/20 text-amber-400",
  admin: "bg-violet-500/20 text-violet-400",
  moderator: "bg-cyan-500/20 text-cyan-400",
  analyst: "bg-emerald-500/20 text-emerald-400",
  developer: "bg-slate-500/20 text-slate-300",
};

export default function DevPanel() {
  const [admin, setAdmin] = useState<DevAdmin | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [panelName, setPanelName] = useState("Nova Dev Panel");
  const [panelSubtitle, setPanelSubtitle] = useState("Панель управления мессенджером");
  const [checking, setChecking] = useState(true);
  const [section, setSection] = useState<Section>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const can = (perm: string) => perms.includes("*") || perms.includes(perm);

  useEffect(() => {
    const token = getDevToken();
    if (!token) {
      setChecking(false);
      return;
    }
    devApi<{ admin: DevAdmin; perms: string[]; settings: Record<string, string> }>("me")
      .then((res) => {
        setAdmin(res.admin);
        setPerms(res.perms || []);
        if (res.settings?.panel_name) setPanelName(res.settings.panel_name);
        if (res.settings?.panel_subtitle) setPanelSubtitle(res.settings.panel_subtitle);
      })
      .catch(() => clearDevToken())
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    document.title = panelName;
  }, [panelName]);

  const afterAuth = async (a: DevAdmin) => {
    setAdmin(a);
    try {
      const res = await devApi<{ perms: string[]; settings: Record<string, string> }>("me");
      setPerms(res.perms || []);
      if (res.settings?.panel_name) setPanelName(res.settings.panel_name);
      if (res.settings?.panel_subtitle) setPanelSubtitle(res.settings.panel_subtitle);
    } catch {
      /* ignore */
    }
  };

  const logout = async () => {
    try {
      await devApi("logout");
    } catch {
      /* ignore */
    }
    clearDevToken();
    setAdmin(null);
    setPerms([]);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!admin) return <DevAuth onSuccess={afterAuth} />;

  const visibleNav = NAV.filter((n) => can(n.perm));
  const current = visibleNav.find((n) => n.key === section) || visibleNav[0];
  const activeSection = current?.key || "dashboard";

  return (
    <div className="min-h-screen bg-[#0a0b14] text-slate-100 flex relative">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-violet-600/12 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-32 w-[460px] h-[460px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[420px] h-[420px] bg-fuchsia-600/8 rounded-full blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      {menuOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#0d0e1a]/95 backdrop-blur-xl border-r border-white/8 flex flex-col transition-transform ${
          menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-5 py-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0">
              <Icon name="Terminal" size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{panelName}</div>
              <div className="text-[10px] text-slate-500 truncate">{panelSubtitle}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setSection(item.key);
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                activeSection === item.key
                  ? "bg-gradient-to-r from-violet-600/25 to-purple-600/10 text-violet-300 border border-violet-500/25"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent"
              }`}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/8">
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-xs font-bold shrink-0">
              {(admin.name || admin.email).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">
                {admin.name || "Администратор"}
                {admin.title && <span className="text-slate-500 font-normal"> · {admin.title}</span>}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${ROLE_COLOR[admin.role] || ROLE_COLOR.developer}`}>
                  {admin.role_label || admin.role}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <Icon name="LogOut" size={17} />
            Выйти
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col relative">
        <header className="px-5 lg:px-8 py-4 border-b border-white/8 flex items-center gap-3 sticky top-0 bg-[#0a0b14]/80 backdrop-blur-xl z-20">
          <button onClick={() => setMenuOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-400">
            <Icon name="Menu" size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{current?.label}</h1>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </div>
        </header>

        <div className="flex-1 p-5 lg:p-8 overflow-x-hidden">
          {activeSection === "dashboard" && <DevDashboard />}
          {activeSection === "users" && <DevUsers can={can} />}
          {activeSection === "channels" && <DevChannels can={can} />}
          {activeSection === "reports" && <DevReports />}
          {activeSection === "support" && <DevSupport />}
          {activeSection === "logs" && <DevLogs />}
          {activeSection === "services" && <DevServices />}
          {activeSection === "team" && <DevTeam myId={admin.id} can={can} />}
          {activeSection === "settings" && (
            <DevSettings
              can={can}
              onSaved={(n, s) => {
                setPanelName(n);
                setPanelSubtitle(s);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
