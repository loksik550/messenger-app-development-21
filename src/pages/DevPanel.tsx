import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, getDevToken, clearDevToken, setPasswordAsker, type DevAdmin } from "@/lib/devApi";
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
import DevBroadcast from "@/components/devpanel/DevBroadcast";
import DevConfirm, { DevLoginToast } from "@/components/devpanel/DevConfirm";
import DevStatusBar from "@/components/devpanel/DevStatusBar";
import DevModeration from "@/components/devpanel/DevModeration";

type Section =
  | "dashboard" | "users" | "channels" | "verification" | "reports"
  | "support" | "broadcast" | "plans" | "promo" | "payments"
  | "moderation" | "logs" | "services" | "team" | "settings";

const NAV: { key: Section; label: string; icon: string; perm: string; hint: string; keywords: string }[] = [
  { key: "dashboard", label: "Дашборд", icon: "LayoutDashboard", perm: "dashboard", hint: "Главные цифры и что требует внимания", keywords: "статистика главная обзор цифры" },
  { key: "users", label: "Пользователи", icon: "Users", perm: "users", hint: "Найти человека, заблокировать, продлить Premium", keywords: "люди аккаунты бан блокировка кошелёк баланс удалить" },
  { key: "channels", label: "Каналы и группы", icon: "Radio", perm: "channels", hint: "Список сообществ, переименовать или удалить", keywords: "чаты сообщества группы каналы" },
  { key: "verification", label: "Верификация", icon: "BadgeCheck", perm: "reports", hint: "Заявки на синюю галочку", keywords: "галочка подтверждение заявки" },
  { key: "reports", label: "Жалобы", icon: "Flag", perm: "reports", hint: "На что жалуются пользователи", keywords: "модерация нарушения спам" },
  { key: "support", label: "Поддержка", icon: "LifeBuoy", perm: "support", hint: "Обращения пользователей и ответы", keywords: "тикеты вопросы обращения помощь" },
  { key: "broadcast", label: "Рассылка", icon: "Send", perm: "settings", hint: "Отправить объявление всем или выборочно", keywords: "объявление уведомление сообщение всем новость" },
  { key: "plans", label: "Тарифы Premium", icon: "Crown", perm: "dashboard", hint: "Цены, сроки и что входит в подписку", keywords: "цены подписка премиум стоимость лимиты" },
  { key: "promo", label: "Промокоды и бонусы", icon: "Ticket", perm: "dashboard", hint: "Скидки, подарки и приглашения друзей", keywords: "скидка акция подарок рефералы бонус" },
  { key: "payments", label: "Платежи", icon: "Receipt", perm: "dashboard", hint: "Кто и сколько заплатил, возвраты, отчёты", keywords: "деньги доход оплата возврат выручка чеки экспорт" },
  { key: "moderation", label: "Автомодерация", icon: "ShieldCheck", perm: "settings", hint: "Стоп-слова и защита от спама", keywords: "фильтр мат стоп-слова антиспам блокировка" },
  { key: "logs", label: "Логи и события", icon: "ScrollText", perm: "logs", hint: "Кто из команды что сделал", keywords: "история действия журнал аудит" },
  { key: "services", label: "Серверы и доступ", icon: "Server", perm: "services", hint: "Работают ли база, хранилище и звонки", keywords: "статус сервисы база хранилище приглашения" },
  { key: "team", label: "Команда", icon: "UserCog", perm: "team", hint: "Администраторы и их права", keywords: "админы роли доступ сотрудники" },
  { key: "settings", label: "Настройки", icon: "Settings", perm: "dashboard", hint: "Оформление панели, пароль и техработы", keywords: "оформление пароль почта профиль техработы обслуживание" },
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
  const [navQuery, setNavQuery] = useState("");
  const [confirmAsk, setConfirmAsk] = useState<{
    action: string; resolve: (v: string | null) => void;
  } | null>(null);
  const [loginNotice, setLoginNotice] = useState<{
    name: string; role: string; device: string; ip: string; when: string;
  } | null>(null);

  // Сервер может попросить подтвердить действие паролем — показываем окно
  useEffect(() => {
    setPasswordAsker(
      (action: string) =>
        new Promise<string | null>((resolve) => setConfirmAsk({ action, resolve })),
    );
  }, []);
  const [light, setLight] = useState(() => {
    try { return localStorage.getItem("nova_dev_light") === "1"; } catch { return false; }
  });
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem("nova_dev_compact") === "1"; } catch { return false; }
  });

  const toggleLight = () => {
    setLight((v) => {
      try { localStorage.setItem("nova_dev_light", v ? "0" : "1"); } catch { /* ignore */ }
      return !v;
    });
  };
  const toggleCompact = () => {
    setCompact((v) => {
      try { localStorage.setItem("nova_dev_compact", v ? "0" : "1"); } catch { /* ignore */ }
      return !v;
    });
  };

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

  const afterAuth = async (a: DevAdmin, notice?: {
    name: string; role: string; device: string; ip: string; when: string;
  }) => {
    setAdmin(a);
    if (notice) setLoginNotice(notice);
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
  // Поиск ищет и по названию раздела, и по тому, что внутри
  const q = navQuery.trim().toLowerCase();
  const shownNav = q
    ? visibleNav.filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.hint.toLowerCase().includes(q) ||
          n.keywords.includes(q),
      )
    : visibleNav;
  const current = visibleNav.find((n) => n.key === section) || visibleNav[0];
  const activeSection = current?.key || "dashboard";

  const go = (s: string) => {
    if (NAV.some((n) => n.key === s)) setSection(s as Section);
  };

  return (
    <div
      className={`h-[100dvh] bg-[#0a0b14] text-slate-100 flex overflow-hidden relative ${
        light ? "dev-light" : ""
      } ${compact ? "dev-compact" : ""}`}
    >
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

        <div className="px-3 pt-3 shrink-0">
          <div className="relative">
            <Icon
              name="Search"
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"
            />
            <input
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Поиск по панели"
              className="w-full bg-black/30 border border-white/8 rounded-xl pl-8 pr-8 py-2 text-xs outline-none focus:border-violet-500/40 placeholder-slate-600"
            />
            {navQuery && (
              <button
                onClick={() => setNavQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
              >
                <Icon name="X" size={13} />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 min-h-0 p-3 space-y-1 overflow-y-auto">
          {shownNav.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-600">
              Ничего не найдено
            </div>
          )}
          {shownNav.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setSection(item.key);
                setMenuOpen(false);
                setNavQuery("");
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition ${
                activeSection === item.key
                  ? "bg-gradient-to-r from-violet-600/25 to-purple-600/10 text-violet-300 border border-violet-500/25"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent"
              }`}
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <Icon name={item.icon} size={17} />
                {item.label}
              </span>
              <span
                className={`block text-[10px] mt-0.5 ml-[30px] leading-tight ${
                  activeSection === item.key ? "text-violet-400/70" : "text-slate-600"
                }`}
              >
                {item.hint}
              </span>
            </button>
          ))}
        </nav>

        {/* Версия приложения — на месте прежнего блока профиля */}
        <div className="p-3 shrink-0">
          <div className="relative rounded-2xl overflow-hidden border border-violet-500/25 bg-gradient-to-br from-violet-600/25 via-fuchsia-600/10 to-transparent px-4 py-3.5">
            <div className="absolute -right-6 -bottom-8 w-24 h-24 rounded-full bg-gradient-to-br from-violet-400/40 to-fuchsia-500/10 blur-[2px]" />
            <div className="absolute -right-6 -bottom-8 w-24 h-24 rounded-full border border-white/10" />
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/30">
                <Icon name="Orbit" size={19} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black tracking-[0.15em] leading-none">NOVA</div>
                <div className="text-[9px] tracking-[0.28em] text-violet-300/80 mt-1">
                  MESSENGER
                </div>
              </div>
            </div>
            <div className="relative text-[10px] text-slate-400 mt-2.5">v{APP_VERSION}</div>
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
          light={light}
          compact={compact}
          onToggleLight={toggleLight}
          onToggleCompact={toggleCompact}
        />

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-5 lg:p-8">
          {activeSection === "dashboard" && <DevDashboard onNavigate={go} />}
          {activeSection === "users" && <DevUsers can={can} compact={compact} />}
          {activeSection === "channels" && <DevChannels can={can} />}
          {activeSection === "verification" && <DevVerification can={can} />}
          {activeSection === "reports" && <DevReports />}
          {activeSection === "support" && <DevSupport />}
          {activeSection === "plans" && <DevPlans can={can} />}
          {activeSection === "promo" && <DevPromo can={can} />}
          {activeSection === "payments" && <DevPayments can={can} />}
          {activeSection === "broadcast" && <DevBroadcast can={can} />}
          {activeSection === "moderation" && <DevModeration can={can} />}
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

        <DevStatusBar />
      </main>
      {confirmAsk && (
        <DevConfirm
          action={confirmAsk.action}
          onSubmit={(pwd) => {
            confirmAsk.resolve(pwd);
            setConfirmAsk(null);
          }}
          onCancel={() => {
            confirmAsk.resolve(null);
            setConfirmAsk(null);
          }}
        />
      )}

      {loginNotice && (
        <DevLoginToast notice={loginNotice} onClose={() => setLoginNotice(null)} />
      )}

    </div>
  );
}