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

type Section = "dashboard" | "users" | "reports" | "support" | "logs" | "services";

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: "dashboard", label: "Дашборд", icon: "LayoutDashboard" },
  { key: "users", label: "Пользователи", icon: "Users" },
  { key: "reports", label: "Жалобы", icon: "Flag" },
  { key: "support", label: "Поддержка", icon: "LifeBuoy" },
  { key: "logs", label: "Логи и события", icon: "ScrollText" },
  { key: "services", label: "Серверы и доступ", icon: "Server" },
];

export default function DevPanel() {
  const [admin, setAdmin] = useState<DevAdmin | null>(null);
  const [checking, setChecking] = useState(true);
  const [section, setSection] = useState<Section>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.title = "Nova Dev Panel";
    const token = getDevToken();
    if (!token) {
      setChecking(false);
      return;
    }
    devApi<{ admin: DevAdmin }>("me")
      .then((res) => setAdmin(res.admin))
      .catch(() => clearDevToken())
      .finally(() => setChecking(false));
  }, []);

  const logout = async () => {
    try {
      await devApi("logout");
    } catch {
      /* ignore */
    }
    clearDevToken();
    setAdmin(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!admin) return <DevAuth onSuccess={setAdmin} />;

  const current = NAV.find((n) => n.key === section);

  return (
    <div className="min-h-screen bg-[#0a0b14] text-slate-100 flex">
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#0d0e1a] border-r border-white/8 flex flex-col transition-transform ${
          menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-5 py-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0">
              <Icon name="Terminal" size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm">Nova Dev</div>
              <div className="text-[10px] text-slate-500">Панель управления</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setSection(item.key);
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                section === item.key
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
              <div className="text-sm font-medium truncate">{admin.name || "Администратор"}</div>
              <div className="text-[10px] text-slate-500 truncate">{admin.email}</div>
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

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="px-5 lg:px-8 py-4 border-b border-white/8 flex items-center gap-3 sticky top-0 bg-[#0a0b14]/90 backdrop-blur-xl z-20">
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
          {section === "dashboard" && <DevDashboard />}
          {section === "users" && <DevUsers />}
          {section === "reports" && <DevReports />}
          {section === "support" && <DevSupport />}
          {section === "logs" && <DevLogs />}
          {section === "services" && <DevServices />}
        </div>
      </main>
    </div>
  );
}
