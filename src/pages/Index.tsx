import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { api, pushApi, urlBase64ToUint8Array, type View, type Tab, type Chat, type User, type Group } from "@/lib/api";
import { ChatList, ChatWindow, Avatar } from "@/components/messenger/ChatComponents";
import { SearchPanel, ProfilePanel, SettingsPanel } from "@/components/messenger/Panels";
import { AuthScreen } from "@/components/messenger/AuthScreen";
import { ContactsPanel } from "@/components/messenger/ContactsPanel";
import { CallScreen } from "@/components/messenger/CallScreen";
import { AdminPanel } from "@/components/messenger/AdminPanel";
import InstallPrompt from "@/components/messenger/InstallPrompt";
import ComingSoon from "@/components/messenger/ComingSoon";
import { ChatFolders, filterChatsByFolder, useChatFolder } from "@/components/messenger/ChatFolders";
import GroupCreateModal from "@/components/messenger/GroupCreateModal";
import JoinChannelModal from "@/components/messenger/JoinChannelModal";
import { GroupChatWindow } from "@/components/messenger/GroupChatWindow";
import WalletPanel from "@/components/messenger/WalletPanel";
import ProPanel from "@/components/messenger/ProPanel";
import ProSettingsPanel from "@/components/messenger/ProSettingsPanel";
import LightningPanel from "@/components/messenger/LightningPanel";
import StickersStorePanel from "@/components/messenger/StickersStorePanel";
import FundraiserPanel from "@/components/messenger/FundraiserPanel";
import { AdminStickersPanel } from "@/components/messenger/AdminStickersPanel";
import BotsPanel from "@/components/messenger/BotsPanel";
import { RealStoriesBar, RealStoryViewer, type StoryGroup } from "@/components/messenger/RealStories";
import ProgressPanel from "@/components/messenger/ProgressPanel";
import SupportPanel from "@/components/messenger/SupportPanel";
import { useOverlays } from "@/hooks/useOverlays";
import { LanguageSwitcher } from "@/components/messenger/LanguageSwitcher";
import { useT } from "@/hooks/useT";
import PremiumPanel from "@/components/messenger/PremiumPanel";
import PrivacyPanel from "@/components/messenger/PrivacyPanel";
import NotificationsPanel from "@/components/messenger/NotificationsPanel";
import AppearancePanel from "@/components/messenger/AppearancePanel";
import SavedNotesPanel from "@/components/messenger/SavedNotesPanel";
import PaymentRequestsPanel from "@/components/messenger/PaymentRequestsPanel";
import AccountDeletePanel from "@/components/messenger/AccountDeletePanel";
import ConsentScreen, { hasConsent } from "@/components/messenger/ConsentScreen";
import PrivacyPolicyPanel from "@/components/messenger/PrivacyPolicyPanel";
import { type Contact } from "@/lib/api";

interface ChatRaw {
  id: number;
  last_message: string;
  last_message_at: number;
  partner: { id: number; name: string; last_seen: number; avatar_url?: string | null };
  unread: number;
  muted?: boolean;
  pinned?: boolean;
  favorite?: boolean;
}

function mapChat(c: ChatRaw): Chat {
  return {
    id: c.id,
    name: c.partner.name,
    avatar: c.partner.name[0]?.toUpperCase() || "?",
    avatar_url: c.partner.avatar_url || null,
    lastMsg: c.last_message || "Нет сообщений",
    time: c.last_message_at ? new Date(c.last_message_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) : "",
    unread: c.unread || 0,
    online: Date.now() / 1000 - (c.partner.last_seen || 0) < 60,
    partner_id: c.partner.id,
    muted: c.muted || false,
    pinned: c.pinned || false,
    favorite: c.favorite || false,
  };
}

export default function Index() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  // Требование RuStore / 152-ФЗ: явное согласие на обработку ПД при первом запуске
  const [consentGiven, setConsentGiven] = useState<boolean>(() => hasConsent());
  // Внутренние экраны (открываются из настроек)
  const [showAccountDelete, setShowAccountDelete] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  // Восстановление сессии из localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nova_user");
      if (saved) {
        const user = JSON.parse(saved) as User;
        if (user?.id && user?.phone && user?.name) {
          setCurrentUser(user);
        }
      }
    } catch { /* ignore */ }
    setSessionChecked(true);
  }, []);

  // Открытие сбора по ссылке ?fund=ID
  useEffect(() => {
    const url = new URL(window.location.href);
    const fid = url.searchParams.get("fund");
    if (fid) {
      const id = parseInt(fid, 10);
      if (!isNaN(id) && id > 0) {
        setFundraiserView({ mode: "view", id });
        url.searchParams.delete("fund");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, []);

  // Автоматический вход в группу/канал по ссылке ?join=CODE
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("join");
    if (code) {
      setPendingJoin(code);
      url.searchParams.delete("join");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [view, setView] = useState<View>("chats");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [storyView, setStoryView] = useState<{ groups: StoryGroup[]; startUserId: number } | null>(null);
  const [storiesRefresh, setStoriesRefresh] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [realChats, setRealChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCall, setActiveCall] = useState<{ userId: number; name: string; callId: string; incoming: boolean } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [chatFolder, setChatFolder] = useChatFolder();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const overlays = useOverlays();
  const { t: tr } = useT();
  const {
    showAdmin, setShowAdmin,
    showPro, setShowPro,
    showComingSoon, setShowComingSoon,
    showCreateGroup, setShowCreateGroup,
    showJoinChannel, setShowJoinChannel,
    showWallet, setShowWallet,
    showProSettings, setShowProSettings,
    showLightning, setShowLightning,
    showStickers, setShowStickers,
    showAdminStickers, setShowAdminStickers,
    showProgress, setShowProgress,
    showBots, setShowBots,
    showSupport, setShowSupport,
    showPrivacy, setShowPrivacy,
    showNotifications, setShowNotifications,
    showAppearance, setShowAppearance,
    showSavedNotes, setShowSavedNotes,
    showPayments, setShowPayments,
    showPremium, setShowPremium,
    fundraiserView, setFundraiserView,
  } = overlays;
  const openOverlay = overlays.open;

  // Push-подписка
  useEffect(() => {
    if (!currentUser) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const subscribe = async () => {
      try {
        const keyData = await pushApi("vapid_key");
        const publicKey = keyData.public_key;
        if (!publicKey) return;

        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const subJson = sub.toJSON();
        await pushApi("subscribe", {
          endpoint: sub.endpoint,
          p256dh: (subJson.keys as Record<string, string>)?.p256dh || "",
          auth: (subJson.keys as Record<string, string>)?.auth || "",
        }, currentUser.id);
      } catch {
        // Пользователь отклонил или браузер не поддерживает
      }
    };

    // Если уже granted — подписываемся сразу. Иначе ждём первого пользовательского жеста,
    // браузеры (особенно Safari) не дают вызвать requestPermission без тапа.
    if (Notification.permission === "granted") {
      subscribe();
      return;
    }
    if (Notification.permission === "default") {
      const onUserGesture = () => {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") subscribe();
        });
        window.removeEventListener("pointerdown", onUserGesture);
        window.removeEventListener("keydown", onUserGesture);
      };
      window.addEventListener("pointerdown", onUserGesture, { once: true });
      window.addEventListener("keydown", onUserGesture, { once: true });
      return () => {
        window.removeEventListener("pointerdown", onUserGesture);
        window.removeEventListener("keydown", onUserGesture);
      };
    }
  }, [currentUser]);

  // PWA badge на иконке приложения — считаем без замьюченных чатов
  useEffect(() => {
    const total = realChats.reduce((s, c) => s + (c.muted ? 0 : (c.unread || 0)), 0);
    type NavWithBadge = Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    const nav = navigator as NavWithBadge;
    try {
      if (total > 0 && typeof nav.setAppBadge === "function") {
        nav.setAppBadge(total).catch(() => {});
      } else if (typeof nav.clearAppBadge === "function") {
        nav.clearAppBadge().catch(() => {});
      }
    } catch {
      /* badge api недоступен */
    }
    // Также обновляем title вкладки браузера
    const base = "Nova";
    document.title = total > 0 ? `(${total > 99 ? "99+" : total}) ${base}` : base;
  }, [realChats]);

  // Загрузка чатов
  useEffect(() => {
    if (!currentUser) return;
    const loadChats = async () => {
      const data = await api("get_chats", { archived: showArchived }, currentUser.id);
      if (typeof data.archived_count === "number") setArchivedCount(data.archived_count);
      if (data.chats) {
        const mapped: Chat[] = data.chats.map(mapChat);
        // Обновляем только если реально что-то изменилось — иначе мигают ники
        setRealChats(prev => {
          const prevStr = JSON.stringify(prev.map(c => ({ id: c.id, lastMsg: c.lastMsg, unread: c.unread, online: c.online, time: c.time, muted: c.muted, pinned: c.pinned, favorite: c.favorite })));
          const nextStr = JSON.stringify(mapped.map(c => ({ id: c.id, lastMsg: c.lastMsg, unread: c.unread, online: c.online, time: c.time, muted: c.muted, pinned: c.pinned, favorite: c.favorite })));
          return prevStr === nextStr ? prev : mapped;
        });
      }
    };
    loadChats();
    const tick = () => { if (document.visibilityState === "visible") loadChats(); };
    const interval = setInterval(tick, 8000);
    const onVis = () => { if (document.visibilityState === "visible") loadChats(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVis); };
  }, [currentUser, showArchived]);

  // Загрузка групп
  useEffect(() => {
    if (!currentUser) return;
    const loadGroups = () => {
      api("get_groups", {}, currentUser.id).then(d => {
        if (d.groups) setGroups(d.groups);
      });
    };
    loadGroups();
    const tick = () => { if (document.visibilityState === "visible") loadGroups(); };
    const t = setInterval(tick, 10000);
    const onVis = () => { if (document.visibilityState === "visible") loadGroups(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [currentUser]);

  // Обработка ?join=CODE после авторизации
  useEffect(() => {
    if (!currentUser || !pendingJoin) return;
    const code = pendingJoin;
    setPendingJoin(null);
    api("join_by_invite", { invite_link: code }, currentUser.id).then(r => {
      if (r?.error) { alert("Не удалось войти: " + r.error); return; }
      if (r?.group_id) {
        const g: Group = { id: r.group_id, name: r.name || "Группа", owner_id: 0, is_channel: !!r.is_channel };
        setGroups(prev => prev.some(x => x.id === g.id) ? prev : [g, ...prev]);
        setSelectedGroup(g);
        setSelectedChat(null);
        setShowSidebar(false);
        // Подгрузим актуальный список
        api("get_groups", {}, currentUser.id).then(d => { if (d.groups) setGroups(d.groups); });
      }
    });
  }, [currentUser, pendingJoin]);

  // Загрузка пользователей для поиска
  useEffect(() => {
    if (!currentUser) return;
    api("get_users", { exclude_id: currentUser.id }).then((data) => {
      if (data.users) setUsers(data.users);
    });
  }, [currentUser]);

  // Глобальная отправка запланированных сообщений (раз в 2 минуты, только когда вкладка активна)
  useEffect(() => {
    if (!currentUser) return;
    api("scheduled_run_due", {}, currentUser.id);
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api("scheduled_run_due", {}, currentUser.id);
    }, 120000);
    return () => clearInterval(t);
  }, [currentUser]);

  const handleStartChat = async (partnerId: number) => {
    if (!currentUser) return;
    const data = await api("get_or_create_chat", { partner_id: partnerId }, currentUser.id);
    if (data.chat_id) {
      const partner = users.find(u => u.id === partnerId);
      const chat: Chat = {
        id: data.chat_id,
        name: partner?.name || "Пользователь",
        avatar: (partner?.name || "П")[0].toUpperCase(),
        avatar_url: partner?.avatar_url || null,
        lastMsg: "Начните общение",
        time: "",
        partner_id: partnerId,
      };
      setSelectedChat(chat);
      setView("chats");
      setShowSidebar(false);
      const chatsData = await api("get_chats", {}, currentUser.id);
      if (chatsData.chats) setRealChats(chatsData.chats.map(mapChat));
    }
  };

  const startCall = (contact: Contact) => {
    const callId = `${currentUser!.id}_${contact.id}_${Date.now()}`;
    setActiveCall({ userId: contact.id, name: contact.name, callId, incoming: false });
  };

  // Polling входящих звонков (только когда вкладка активна)
  useEffect(() => {
    if (!currentUser) return;
    const since = { val: Math.floor(Date.now() / 1000) - 5 };
    const interval = setInterval(async () => {
      if (activeCall) return;
      if (document.visibilityState !== "visible") return;
      const data = await api("poll_incoming_call", { since: since.val }, currentUser.id);
      if (data.call) {
        since.val = data.call.created_at;
        setActiveCall({ userId: data.call.from_user_id, name: data.call.from_name, callId: data.call.call_id, incoming: true });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUser, activeCall]);

  const login = (user: User) => {
    localStorage.setItem("nova_user", JSON.stringify(user));
    setCurrentUser(user);
  };

  const logout = () => {
    localStorage.removeItem("nova_user");
    setCurrentUser(null);
  };

  if (!sessionChecked) return (
    <div className="h-screen flex items-center justify-center relative overflow-hidden">
      <div className="mesh-bg" />
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 grad-primary rounded-3xl flex items-center justify-center glow-primary animate-float">
          <Icon name="Zap" size={36} className="text-white" />
        </div>
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    </div>
  );

  // Гейт согласия на обработку ПД — обязательное требование RuStore.
  // Показываем ДО любых форм авторизации, чтобы не собирать ни байта данных
  // без явного согласия пользователя.
  if (!consentGiven) {
    return <ConsentScreen onAccept={() => setConsentGiven(true)} />;
  }

  if (!currentUser) return <AuthScreen onDone={login} />;

  // Экран политики конфиденциальности (доступен из настроек)
  if (showPrivacyPolicy) {
    return <PrivacyPolicyPanel onBack={() => setShowPrivacyPolicy(false)} />;
  }

  // Экран удаления аккаунта (доступен из настроек)
  if (showAccountDelete) {
    return (
      <AccountDeletePanel
        user={currentUser}
        onBack={() => setShowAccountDelete(false)}
        onDeleted={() => {
          setShowAccountDelete(false);
          logout();
        }}
      />
    );
  }

  const navItems: { tab: View; icon: string; label: string }[] = [
    { tab: "chats", icon: "MessageCircle", label: "Чаты" },
    { tab: "contacts", icon: "BookUser", label: "Контакты" },
    { tab: "search", icon: "Search", label: "Поиск" },
    { tab: "profile", icon: "User", label: "Профиль" },
    { tab: "settings", icon: "Shield", label: "Безопасность" },
  ];

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setView("chats");
    setShowSidebar(false);
  };

  const handleBack = () => {
    setShowSidebar(true);
  };

  return (
    <div className="flex overflow-hidden relative" style={{ height: "100dvh", minHeight: "100dvh" }}>
      {/* Mesh background */}
      <div className="mesh-bg" />

      {/* Nova Pro panel */}
      {showPro && currentUser && (
        <ProPanel
          currentUser={currentUser}
          onClose={() => setShowPro(false)}
          onUserUpdate={(u) => setCurrentUser(u)}
          onOpenWallet={() => { setShowPro(false); setShowWallet(true); }}
        />
      )}

      {/* Wallet */}
      {showWallet && currentUser && (
        <WalletPanel
          currentUser={currentUser}
          onClose={() => setShowWallet(false)}
          onUserUpdate={(u) => setCurrentUser(u)}
          onOpenLightning={() => { setShowWallet(false); setShowLightning(true); }}
          onOpenStickers={() => { setShowWallet(false); setShowStickers(true); }}
          onCreateFundraiser={() => { setShowWallet(false); setFundraiserView({ mode: "create" }); }}
        />
      )}

      {/* Pro settings (эмодзи-статус, цвет, инкогнито, приватность) */}
      {showProSettings && currentUser && (
        <ProSettingsPanel
          currentUser={currentUser}
          onClose={() => setShowProSettings(false)}
          onUserUpdate={(u) => setCurrentUser(u)}
          onOpenPro={() => { setShowProSettings(false); setShowPro(true); }}
        />
      )}

      {/* Lightning */}
      {showLightning && currentUser && (
        <LightningPanel
          currentUser={currentUser}
          onClose={() => setShowLightning(false)}
          onUserUpdate={(u) => setCurrentUser(u)}
        />
      )}

      {/* Stickers store */}
      {showStickers && currentUser && (
        <StickersStorePanel
          currentUser={currentUser}
          onClose={() => setShowStickers(false)}
          onUserUpdate={(u) => setCurrentUser(u)}
          onOpenAdmin={() => { setShowStickers(false); setShowAdminStickers(true); }}
        />
      )}

      {/* Admin: создание стикерпаков */}
      {showAdminStickers && currentUser && (
        <AdminStickersPanel
          currentUser={currentUser}
          onClose={() => setShowAdminStickers(false)}
        />
      )}

      {/* Прокачка */}
      {showProgress && currentUser && (
        <ProgressPanel
          currentUser={currentUser}
          onClose={() => setShowProgress(false)}
        />
      )}

      {/* Поддержка */}
      {showSupport && currentUser && (
        <SupportPanel
          currentUser={currentUser}
          onClose={() => setShowSupport(false)}
        />
      )}

      {/* Безопасность */}
      {showPrivacy && currentUser && (
        <PrivacyPanel
          currentUser={currentUser}
          onClose={() => setShowPrivacy(false)}
          onUserUpdate={(u) => setCurrentUser(u)}
        />
      )}

      {/* Уведомления */}
      {showNotifications && currentUser && (
        <NotificationsPanel
          currentUser={currentUser}
          onClose={() => setShowNotifications(false)}
          onUserUpdate={(u) => setCurrentUser(u)}
        />
      )}

      {/* Оформление */}
      {showAppearance && currentUser && (
        <AppearancePanel
          currentUser={currentUser}
          onClose={() => setShowAppearance(false)}
          onUserUpdate={(u) => setCurrentUser(u)}
        />
      )}

      {/* Избранное / заметки */}
      {showSavedNotes && currentUser && (
        <SavedNotesPanel
          currentUser={currentUser}
          onClose={() => setShowSavedNotes(false)}
        />
      )}

      {/* Счета */}
      {showPayments && currentUser && (
        <PaymentRequestsPanel
          currentUser={currentUser}
          onClose={() => setShowPayments(false)}
        />
      )}

      {/* Мои боты */}
      {showBots && currentUser && (
        <div className="fixed inset-0 z-[200] bg-background animate-fade-in">
          <BotsPanel
            currentUser={currentUser}
            onBack={() => setShowBots(false)}
          />
        </div>
      )}

      {/* Fundraiser */}
      {fundraiserView && currentUser && (
        <FundraiserPanel
          currentUser={currentUser}
          fundraiserId={fundraiserView.mode === "view" ? fundraiserView.id : undefined}
          mode={fundraiserView.mode}
          onClose={() => setFundraiserView(null)}
          onCreated={(id, title) => {
            navigator.clipboard?.writeText(`${window.location.origin}/?fund=${id}`).catch(() => {});
            alert(`Сбор «${title}» создан! Ссылка скопирована — отправь её друзьям.`);
          }}
        />
      )}

      {/* Premium витрина */}
      {showPremium && currentUser && (
        <PremiumPanel
          currentUser={currentUser}
          onClose={() => setShowPremium(false)}
          onSubscribe={() => { setShowPremium(false); openOverlay(setShowPro); }}
        />
      )}

      {/* Admin Panel */}
      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}

      {/* Call screen */}
      {activeCall && (
        <CallScreen
          currentUser={currentUser}
          remoteUserId={activeCall.userId}
          remoteName={activeCall.name}
          callId={activeCall.callId}
          isIncoming={activeCall.incoming}
          onClose={() => setActiveCall(null)}
        />
      )}

      {/* Real Stories Viewer */}
      {storyView && currentUser && (
        <RealStoryViewer
          groups={storyView.groups}
          startUserId={storyView.startUserId}
          currentUser={currentUser}
          onClose={() => { setStoryView(null); setStoriesRefresh(k => k + 1); }}
          onChanged={() => setStoriesRefresh(k => k + 1)}
        />
      )}

      {/* PWA install prompt */}
      <InstallPrompt />

      {/* Coming soon */}
      <ComingSoon open={showComingSoon} onClose={() => setShowComingSoon(false)} />

      {/* ── Sidebar ── */}
      <aside
        className={`
          flex flex-col flex-shrink-0
          glass-strong border-r border-white/5
          transition-transform duration-300 ease-in-out
          md:w-80 lg:w-96
          absolute inset-y-0 left-0 z-20 w-full
          md:relative md:translate-x-0 md:z-auto
          ${showSidebar ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 pb-3" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 grad-primary rounded-xl flex items-center justify-center glow-primary">
              <Icon name="Zap" size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold grad-text">Nova</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Premium badge */}
            <button
              onClick={() => openOverlay(setShowPremium)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "#fff" }}
            >
              <Icon name="Crown" size={12} />
              Premium
            </button>
            {/* Язык */}
            <LanguageSwitcher variant="compact" />
            {/* Скоро */}
            <button
              onClick={() => openOverlay(setShowComingSoon)}
              className="p-2 rounded-xl hover:bg-white/8 transition-colors text-muted-foreground hover:text-violet-400"
              title="Скоро в Nova"
            >
              <Icon name="Sparkles" size={18} />
            </button>
            {/* Dev Panel */}
            <button
              onClick={() => openOverlay(setShowAdmin)}
              className="p-2 rounded-xl hover:bg-white/8 transition-colors text-muted-foreground hover:text-violet-400"
              title="Dev Panel"
            >
              <Icon name="Terminal" size={18} />
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex mx-4 mb-3 glass rounded-2xl p-1">
          {(["chats", "stories", "contacts"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeTab === t ? "grad-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tr({ chats: "nav.chats", stories: "nav.stories", contacts: "nav.contacts" }[t])}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 mx-4 mb-2 glass rounded-2xl px-3 py-2">
          <Icon name="Search" size={15} className="text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={tr("common.search") + "..."}
            className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder-muted-foreground"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === "chats" && (
            <>
              {currentUser && (
              <RealStoriesBar
                currentUser={currentUser}
                refreshKey={storiesRefresh}
                onOpen={(groups, startUserId) => setStoryView({ groups, startUserId })}
              />
            )}
              {showArchived && (
                <button
                  onClick={() => setShowArchived(false)}
                  className="flex items-center gap-3 px-4 py-3 mx-2 rounded-2xl hover:bg-white/5 transition-colors"
                >
                  <Icon name="ChevronLeft" size={18} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Назад к чатам</span>
                </button>
              )}
              {!showArchived && archivedCount > 0 && (
                <button
                  onClick={() => setShowArchived(true)}
                  className="flex items-center gap-3 px-4 py-3 mx-2 rounded-2xl hover:bg-white/5 transition-colors animate-fade-in"
                >
                  <div className="w-11 h-11 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon name="Archive" size={18} className="text-violet-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-sm">Архив</div>
                    <div className="text-xs text-muted-foreground">{archivedCount} {archivedCount === 1 ? "чат" : archivedCount < 5 ? "чата" : "чатов"}</div>
                  </div>
                  <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
                </button>
              )}
              {!showArchived && (
                <ChatFolders folder={chatFolder} onChange={setChatFolder} chats={realChats} />
              )}
              <ChatList
                chats={filterChatsByFolder(
                  realChats.filter(c => {
                    if (!searchQuery) return true;
                    const q = searchQuery.toLocaleLowerCase().trim();
                    if (!q) return true;
                    const name = (c.name || "").toLocaleLowerCase();
                    const lastMsg = (c.lastMsg || "").toLocaleLowerCase();
                    return name.includes(q) || lastMsg.includes(q);
                  }),
                  chatFolder,
                )}
                onSelect={handleSelectChat}
                selectedId={selectedChat?.id}
                onToggleMute={async (c) => {
                  const next = !c.muted;
                  setRealChats(prev => prev.map(x => x.id === c.id ? { ...x, muted: next } : x));
                  try {
                    await api("set_chat_setting", { chat_id: c.id, field: "muted", value: next }, currentUser!.id);
                  } catch {
                    setRealChats(prev => prev.map(x => x.id === c.id ? { ...x, muted: !next } : x));
                  }
                }}
                onToggleArchive={async (c) => {
                  const next = !c.archived;
                  setRealChats(prev => prev.filter(x => x.id !== c.id));
                  try {
                    await api("archive_chat", { chat_id: c.id, archived: next }, currentUser!.id);
                  } catch {
                    setRealChats(prev => [...prev, { ...c, archived: !next }]);
                  }
                }}
                onRefresh={async () => {
                  if (!currentUser) return;
                  const data = await api("get_chats", { archived: showArchived }, currentUser.id);
                  if (data.chats) setRealChats(data.chats.map(mapChat));
                  if (typeof data.archived_count === "number") setArchivedCount(data.archived_count);
                }}
              />

              {/* Группы и каналы */}
              {groups.filter(g => {
                if (!searchQuery) return true;
                const q = searchQuery.toLocaleLowerCase().trim();
                return !q || (g.name || "").toLocaleLowerCase().includes(q);
              }).length > 0 && (
                <div className="px-4 pt-2 pb-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Группы и каналы</span>
                  </div>
                  <div className="space-y-0.5">
                    {groups.filter(g => {
                      if (!searchQuery) return true;
                      const q = searchQuery.toLocaleLowerCase().trim();
                      return !q || (g.name || "").toLocaleLowerCase().includes(q);
                    }).map(g => (
                      <button
                        key={g.id}
                        onClick={() => { setSelectedGroup(g); setSelectedChat(null); setShowSidebar(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all ${selectedGroup?.id === g.id ? "bg-white/8 glass" : "hover:bg-white/4"}`}
                      >
                        {g.avatar_url
                          ? <img src={g.avatar_url} className="w-11 h-11 rounded-2xl object-cover flex-shrink-0" />
                          : <div className="w-11 h-11 rounded-2xl grad-primary flex items-center justify-center flex-shrink-0">
                              <Icon name={g.is_channel ? "Radio" : "Users"} size={18} className="text-white" />
                            </div>
                        }
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm truncate">{g.name}</span>
                            {g.last_message_at ? (
                              <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">
                                {new Date(g.last_message_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {g.last_message || `${g.members_count ?? 0} участников`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Кнопки группы/каналы */}
              <div className="px-4 pt-2 pb-2 space-y-1.5">
                <button
                  onClick={() => openOverlay(setShowCreateGroup)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/5 transition text-muted-foreground hover:text-foreground border border-dashed border-white/10"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Icon name="Plus" size={20} className="text-violet-400" />
                  </div>
                  <span className="text-sm font-medium">Создать группу или канал</span>
                </button>
                <button
                  onClick={() => openOverlay(setShowJoinChannel)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/5 transition text-muted-foreground hover:text-foreground border border-dashed border-white/10"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Icon name="Search" size={20} className="text-cyan-400" />
                  </div>
                  <span className="text-sm font-medium">Найти канал по ссылке</span>
                </button>
              </div>
            </>
          )}
          {activeTab === "stories" && currentUser && (
            <div className="flex-1 overflow-y-auto p-4">
              <RealStoriesBar
                currentUser={currentUser}
                refreshKey={storiesRefresh}
                onOpen={(groups, startUserId) => setStoryView({ groups, startUserId })}
              />
              <p className="text-center text-xs text-muted-foreground mt-4">
                Истории живут 24 часа. Видны только твоим контактам и тебе.
              </p>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex items-center justify-around px-4 pt-3 border-t border-white/5" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          {navItems.map(item => {
            // Считаем непрочитанные только по НЕзаглушённым чатам — иначе
            // шумные группы постоянно бы дёргали значок на навигации.
            const totalUnread = item.tab === "chats"
              ? realChats.reduce((s, c) => s + (c.muted ? 0 : (c.unread || 0)), 0)
              : 0;
            return (
              <button
                key={item.tab}
                onClick={() => {
                  setView(item.tab);
                  setSelectedChat(null);
                  // На мобильном для вкладок «профиль/настройки/поиск/контакты» показываем сразу контент,
                  // а не сайдбар поверх. Сайдбар — только для «чатов».
                  setShowSidebar(item.tab === "chats");
                }}
                className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                  view === item.tab && !selectedChat ? "text-violet-400" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon name={item.icon as string} size={20} />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 grad-primary rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
                <span className="text-[9px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main area ── */}
      <main className={`
        flex-1 flex flex-col overflow-hidden
        transition-transform duration-300 ease-in-out
        absolute inset-0 md:relative
        ${showSidebar && !selectedChat && !selectedGroup ? "translate-x-full md:translate-x-0" : "translate-x-0"}
      `}>
        {selectedGroup ? (
          <GroupChatWindow
            group={selectedGroup}
            currentUser={currentUser}
            onBack={() => { setSelectedGroup(null); setShowSidebar(true); }}
            onGroupUpdated={(g) => {
              setSelectedGroup(g);
              setGroups(prev => prev.map(gr => gr.id === g.id ? { ...gr, ...g } : gr));
            }}
            onGroupDeleted={() => {
              const removedId = selectedGroup.id;
              setGroups(prev => prev.filter(gr => gr.id !== removedId));
              setSelectedGroup(null);
              setShowSidebar(true);
            }}
          />
        ) : selectedChat ? (
          <ChatWindow
            chat={selectedChat}
            onBack={handleBack}
            currentUser={currentUser}
            onCall={(partnerId, name) => {
              const callId = `${currentUser.id}_${partnerId}_${Date.now()}`;
              setActiveCall({ userId: partnerId, name, callId, incoming: false });
            }}
            onVideoCall={(partnerId, name) => {
              const callId = `video_${currentUser.id}_${partnerId}_${Date.now()}`;
              setActiveCall({ userId: partnerId, name, callId, incoming: false });
            }}
            onChatUpdated={(updated) => {
              setSelectedChat(updated);
              setRealChats(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
            }}
            onChatDeleted={() => {
              setRealChats(prev => prev.filter(c => c.id !== selectedChat.id));
              setSelectedChat(null);
            }}
            onUserUpdate={(u) => setCurrentUser(u)}
            onOpenFundraiser={(id) => setFundraiserView(id === -1 ? { mode: "create" } : { mode: "view", id })}
            onOpenStickersStore={() => openOverlay(setShowStickers)}
          />
        ) : view === "search" ? (
          <SearchPanel users={users} currentUser={currentUser} onStartChat={handleStartChat} onBack={() => { setView("chats"); setShowSidebar(true); }} />
        ) : view === "contacts" ? (
          <ContactsPanel currentUser={currentUser} onStartChat={(chat) => { setSelectedChat(chat); setShowSidebar(false); }} onCall={startCall} onBack={() => { setView("chats"); setShowSidebar(true); }} />
        ) : view === "profile" ? (
          <ProfilePanel
            onSettings={() => setView("settings")}
            currentUser={currentUser}
            onUserUpdate={(u) => { setCurrentUser(u); }}
            onBack={() => { setView("chats"); setShowSidebar(true); }}
            chatsCount={realChats.length}
            onOpenWallet={() => openOverlay(setShowWallet)}
            onOpenPro={() => openOverlay(setShowPro)}
            onOpenProSettings={() => openOverlay(setShowProSettings)}
            onOpenProgress={() => openOverlay(setShowProgress)}
            onOpenBots={() => openOverlay(setShowBots)}
            onOpenSupport={() => openOverlay(setShowSupport)}
            onOpenPrivacy={() => openOverlay(setShowPrivacy)}
            onOpenNotifications={() => openOverlay(setShowNotifications)}
            onOpenAppearance={() => openOverlay(setShowAppearance)}
            onOpenSavedNotes={() => openOverlay(setShowSavedNotes)}
            onOpenPayments={() => openOverlay(setShowPayments)}
          />
        ) : view === "settings" ? (
          <SettingsPanel
            onLogout={logout}
            onBack={() => setView("profile")}
            onDeleteAccount={() => setShowAccountDelete(true)}
            onOpenPrivacyPolicy={() => setShowPrivacyPolicy(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 animate-fade-in">
            <div className="w-20 h-20 grad-primary rounded-3xl flex items-center justify-center mb-6 glow-primary animate-float">
              <Icon name="MessageCircle" size={36} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2 grad-text">Nova</h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              Выберите диалог слева, чтобы начать общение. Все сообщения защищены сквозным шифрованием.
            </p>
            <div className="flex items-center gap-2 mt-4 px-4 py-2 glass rounded-full">
              <Icon name="Lock" size={13} className="text-violet-400" />
              <span className="text-xs text-muted-foreground">E2E шифрование активно</span>
            </div>
          </div>
        )}
      </main>

      {/* GroupCreateModal */}
      {currentUser && (
        <GroupCreateModal
          currentUser={currentUser}
          open={showCreateGroup}
          onClose={() => setShowCreateGroup(false)}
          onCreated={(g) => {
            setGroups(prev => [g, ...prev]);
            setSelectedGroup(g);
            setSelectedChat(null);
            setShowSidebar(false);
          }}
        />
      )}

      {/* JoinChannelModal */}
      {currentUser && (
        <JoinChannelModal
          open={showJoinChannel}
          currentUser={currentUser}
          onClose={() => setShowJoinChannel(false)}
          onJoined={(g) => {
            // обновляем список групп
            api("get_groups", {}, currentUser.id).then(d => {
              if (d?.groups) setGroups(d.groups);
            });
            setSelectedGroup(g);
            setSelectedChat(null);
            setShowSidebar(false);
          }}
        />
      )}
    </div>
  );
}