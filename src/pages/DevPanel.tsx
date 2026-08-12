import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, getDevToken, clearDevToken, type DevAdmin } from "@/lib/devApi";
import { APP_VERSION } from "@/lib/version";
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
import DevVerification from "@/components/devpanel/DevVerification";
import DevPlans from "@/components/devpanel/DevPlans";
import DevPromo from "@/components/devpanel/DevPromo";
import DevPayments from "@/components/devpanel/DevPayments";
import DevTopBar from "@/components/devpanel/DevTopBar";

type Section =
  | "dashboard" | "users" | "channels" | "verification" | "reports"
  | "support" | "plans" | "promo" | "payments" | "logs" | "services" | "team" | "settings";

const NAV: { key: Section; label: string; icon: string; perm: string }[] = [
  { key: "dashboard", label: "Дашборд", icon: "LayoutDashboard", perm: "dashboard" },
  { key: "users", label: "Пользователи", icon: "Users", perm: "users" },
  { key: "channels", label: "Каналы и группы", icon: "Radio", perm: "channels" },
  { key: "verification", label: "Верификация", icon: "BadgeCheck", perm: "reports" },
  { key: "reports", label: "Жалобы", icon: "Flag", perm: "reports" },
  { key: "support", label: "Поддержка", icon: "LifeBuoy", perm: "support" },
  { key: "plans", label: "Тарифы Premium", icon: "Crown", perm: "dashboard" },
  { key: "promo", label: "Промокоды и бонусы", icon: "Ticket", perm: "dashboard" },
  { key: "payments", label: "Платежи", icon: "Receipt", perm: "dashboard" },
  { key: "logs", label: "Логи и события", icon: "ScrollText", perm: "logs" },
  { key: "services", label: "Серверы и доступ", icon: "Server", perm: "services" },
  { key: "team", label: "Команда", icon: "UserCog", perm: "team" },
  { key: "settings", label: "Настройки", icon: "Settings", perm: "dashboard" },
];

export default function DevPanel() {
  const [admin, setAdmin] = useState<DevAdmin | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [panelName, setPanelName] = useState("Nova Dev Panel");
  const [panelSubtitle, setPanelSubtitle] = useState("Панель управления мессенджером");
  const [panelLogo, setPanelLogo] = useState("/app-icon-512.png");
  const [bgStyle, setBgStyle] = useState("aurora");
  const [bgImage, setBgImage] = useState("");
  const [checking, setChecking] = useState(true);
  const [section, setSection] = useState<Section>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const can = (perm: string) => perms.includes("*") || perms.includes(perm);

  const applySettings = (st: Record<string, string>) => {
    if (st?.panel_name) setPanelName(st.panel_name);
    if (st?.panel_subtitle) setPanelSubtitle(st.panel_subtitle);
    if (st?.panel_logo_url !== undefined) setPanelLogo(st.panel_logo_url);
    if (st?.panel_bg_style) setBgStyle(st.panel_bg_style);
    if (st?.panel_bg_image !== undefined) setBgImage(st.panel_bg_image);
  };

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
        applySettings(res.settings);
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
      applySettings(res.settings);
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

  const go = (s: string) => {
    if (NAV.some((n) => n.key === s)) setSection(s as Section);
  };

  return (
    <div className="h-[100dvh] bg-[#0a0b14] text-slate-100 flex overflow-hidden relative">
      {/* Фон панели */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {bgImage ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${bgImage})` }}
            />
            <div className="absolute inset-0 bg-[#0a0b14]/85" />
          </>
        ) : bgStyle === "grid" ? (
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
        ) : bgStyle === "gradient" ? (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950/40 via-[#0a0b14] to-cyan-950/30" />
        ) : bgStyle === "plain" ? null : (
          <>
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
          </>
        )}
      </div>

      {menuOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#0d0e1a]/95 backdrop-blur-xl border-r border-white/8 flex flex-col transition-transform ${
          menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-5 py-5 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            {panelLogo ? (
              <img src={panelLogo} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0">
                <Icon name="Terminal" size={18} className="text-white" />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{panelName}</div>
              <div className="text-[10px] text-slate-500 truncate">{panelSubtitle}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 min-h-0 p-3 space-y-1 overflow-y-auto">
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

        {/* Версия приложения — на месте прежнего блока профиля */}
        <div className="p-4 border-t border-white/8 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <Icon name="Smartphone" size={14} className="text-slate-500" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400">Nova Messenger</div>
              <div className="text-[10px] text-slate-600">Версия {APP_VERSION}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
        <DevTopBar
          admin={admin}
          title={current?.label || ""}
          onMenu={() => setMenuOpen(true)}
          onLogout={logout}
          onOpenSettings={() => setSection("settings")}
          onNavigate={go}
        />

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-5 lg:p-8">
          {activeSection === "dashboard" && <DevDashboard onNavigate={go} />}
          {activeSection === "users" && <DevUsers can={can} />}
          {activeSection === "channels" && <DevChannels can={can} />}
          {activeSection === "verification" && <DevVerification can={can} />}
          {activeSection === "reports" && <DevReports />}
          {activeSection === "support" && <DevSupport />}
          {activeSection === "plans" && <DevPlans can={can} />}
          {activeSection === "promo" && <DevPromo can={can} />}
          {activeSection === "payments" && <DevPayments can={can} />}
          {activeSection === "logs" && <DevLogs />}
          {activeSection === "services" && <DevServices />}
          {activeSection === "team" && <DevTeam myId={admin.id} can={can} />}
          {activeSection === "settings" && (
            <DevSettings
              can={can}
              admin={admin}
              onEmailChanged={(email) => setAdmin({ ...admin, email })}
              onProfileChanged={(a) => setAdmin(a)}
              onSaved={(n, sub, logo, bg, bgImg) => {
                setPanelName(n);
                setPanelSubtitle(sub);
                setPanelLogo(logo);
                setBgStyle(bg);
                setBgImage(bgImg);
              }}
            />
          )}
          <div className="h-10" />
        </div>
      </main>
    </div>
  );
}
