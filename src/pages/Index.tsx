import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import ConnectionBanner from "@/components/messenger/ConnectionBanner";
import { getDraft, useDraftsVersion } from "@/lib/drafts";
import { track, setTrackUser } from "@/lib/track";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import Icon from "@/components/ui/icon";
import { api, type View, type Tab, type Chat, type User, type Group } from "@/lib/api";
import { ChatList, ChatWindow } from "@/components/messenger/ChatComponents";
import { SearchPanel, ProfilePanel, SettingsPanel } from "@/components/messenger/Panels";
import { AuthScreen } from "@/components/messenger/AuthScreen";
import { ContactsPanel } from "@/components/messenger/ContactsPanel";
import { CallScreen } from "@/components/messenger/CallScreen";
import EnableNotificationsBanner from "@/components/messenger/EnableNotificationsBanner";
import NotificationsBell from "@/components/messenger/NotificationsBell";
import NovaToaster from "@/components/messenger/NovaToast";
import ComingSoon from "@/components/messenger/ComingSoon";
import { ChatFolders, filterChatsByFolder, useChatFolder } from "@/components/messenger/ChatFolders";
import { RealStoriesBar, type StoryGroup } from "@/components/messenger/RealStories";
import { useOverlays } from "@/hooks/useOverlays";
import { LanguageSwitcher } from "@/components/messenger/LanguageSwitcher";
import { useT } from "@/hooks/useT";
import ConsentScreen, { hasConsent } from "@/components/messenger/ConsentScreen";
import OnboardingScreen, { hasSeenOnboarding } from "@/components/messenger/OnboardingScreen";
import PinLockScreen from "@/components/messenger/PinLockScreen";
import IndexOverlays from "@/pages/IndexOverlays";
import { useDeepLinks, useJoinByInvite } from "@/pages/index-hooks/useDeepLinks";
import { usePushSetup, usePushOpen } from "@/pages/index-hooks/usePushSetup";
import { useUserNotifications } from "@/pages/index-hooks/useUserNotifications";
import { useAccountStatus } from "@/pages/index-hooks/useAccountStatus";
import { useChatsAndGroups, mapChat } from "@/pages/index-hooks/useChatsAndGroups";
import { useIncomingCalls } from "@/pages/index-hooks/useIncomingCalls";

// Редкие панели грузятся лениво — это ускоряет первый запуск приложения
const GroupChatWindow = lazyWithRetry(() => import("@/components/messenger/GroupChatWindow"));
const RealStoryViewer = lazyWithRetry(() => import("@/components/messenger/RealStories").then(m => ({ default: m.RealStoryViewer })));
const GroupCreateModal = lazyWithRetry(() => import("@/components/messenger/GroupCreateModal"));
const JoinChannelModal = lazyWithRetry(() => import("@/components/messenger/JoinChannelModal"));
const AccountDeletePanel = lazyWithRetry(() => import("@/components/messenger/AccountDeletePanel"));
const PrivacyPolicyPanel = lazyWithRetry(() => import("@/components/messenger/PrivacyPolicyPanel"));
const TermsPanel = lazyWithRetry(() => import("@/components/messenger/TermsPanel"));
const HelpPanel = lazyWithRetry(() => import("@/components/messenger/HelpPanel"));
const VerificationPanel = lazyWithRetry(() => import("@/components/messenger/VerificationPanel"));
const BannedScreen = lazyWithRetry(() => import("@/components/messenger/BannedScreen"));
import { type Contact } from "@/lib/api";
import { restoreAuthToken, setAuthToken, onAuthExpired } from "@/lib/authToken";
import { NAV_ITEMS } from "@/pages/navItems";
import { applyTheme, applyAccent, applyFontSize, applyBubbleStyle, isThemeId, getStoredFontSize } from "@/lib/theme";

const LAZY_FALLBACK = (
  <div className="fixed inset-0 z-[280] flex items-center justify-center bg-background/60 backdrop-blur-sm">
    <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
  </div>
);

export default function Index() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;
  useDraftsVersion();
  useEffect(() => {
    setTrackUser(currentUser?.id ?? null);
    if (currentUser?.id) track("app_open");
  }, [currentUser?.id]);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [maintenance, setMaintenance] = useState<{ title: string; text: string } | null>(null);
  // PIN-блокировка: если код установлен — требуем ввод при запуске
  const [pinUnlocked, setPinUnlocked] = useState(false);
  // Требование RuStore / 152-ФЗ: явное согласие на обработку ПД при первом запуске
  const [consentGiven, setConsentGiven] = useState<boolean>(() => hasConsent());
  const [onboardingDone, setOnboardingDone] = useState<boolean>(() => hasSeenOnboarding());
  // Внутренние экраны (открываются из настроек)
  const [showAccountDelete, setShowAccountDelete] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showPromo, setShowPromo] = useState(false);

  // Восстановление сессии из localStorage
  useEffect(() => {
    let cancelled = false;
    restoreAuthToken().finally(() => {
      if (cancelled) return;
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
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => onAuthExpired(() => {
    localStorage.removeItem("nova_user");
    setAuthToken(null);
    setCurrentUser(null);
  }), []);

  // Проверяем, не идут ли технические работы (включается в Dev-панели)
  const checkMaintenance = useCallback(() => {
    return api("app_status", {})
      .then((r) => {
        setMaintenance(r?.maintenance ? { title: r.title, text: r.text } : null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    checkMaintenance();
    const timer = setInterval(checkMaintenance, 15000);
    // Вернулись во вкладку — проверяем сразу, не дожидаясь таймера
    const onFocus = () => {
      if (document.visibilityState === "visible") checkMaintenance();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [checkMaintenance]);

  // Применяем настройки оформления с сервера (тема/акцент/шрифт/стиль сообщений)
  useEffect(() => {
    if (!currentUser) return;
    const u = currentUser as User & { theme_id?: string; accent_color?: string; font_size?: number; bubble_style?: string };
    if (u.theme_id && isThemeId(u.theme_id)) applyTheme(u.theme_id, u.font_size || getStoredFontSize());
    if (typeof u.font_size === "number") applyFontSize(u.font_size);
    if (u.accent_color) {
      const hexMap: Record<string, string> = {
        violet: "#8b5cf6", blue: "#3b82f6", cyan: "#06b6d4", emerald: "#10b981",
        amber: "#f59e0b", rose: "#f43f5e", pink: "#ec4899", indigo: "#6366f1",
      };
      applyAccent(hexMap[u.accent_color] || "#8b5cf6");
    }
    if (u.bubble_style) applyBubbleStyle(u.bubble_style);
  }, [currentUser?.id]);

  const overlays = useOverlays();
  const { pendingJoin, setPendingJoin, refToast, pendingCallId, setPendingCallId } = useDeepLinks({ currentUser, setCurrentUser, setFundraiserView: overlays.setFundraiserView });

  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [view, setView] = useState<View>("chats");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [storyView, setStoryView] = useState<{ groups: StoryGroup[]; startUserId: number } | null>(null);
  const [storiesRefresh, setStoriesRefresh] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [realChats, setRealChats] = useState<Chat[]>([]);
  const realChatsRef = useRef<Chat[]>([]);
  realChatsRef.current = realChats;
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCall, setActiveCall] = useState<{ userId: number; name: string; callId: string; incoming: boolean; autoAccept?: boolean } | null>(null);
  const unreadRef = useRef<Map<number, number> | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [chatFolder, setChatFolder] = useChatFolder();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const groupsRef = useRef<Group[]>([]);
  groupsRef.current = groups;
  const { pendingOpenRef, tryOpenFromPush } = usePushOpen({ currentUserRef, realChatsRef, groupsRef, realChats, groups, setActiveCall, setSelectedChat, setSelectedGroup, setView, setShowSidebar });

  const { t: tr } = useT();
  const {
    setShowPro, showComingSoon, setShowComingSoon, showCreateGroup, setShowCreateGroup, showJoinChannel, setShowJoinChannel, setShowWallet, setShowProSettings, setShowStickers, setShowProgress, setShowBots, setShowSupport, setShowPrivacy, setShowNotifications, setShowAppearance, setShowSavedNotes, setShowPayments, setShowPremium, setShowCalls, setShowInvite, setFundraiserView,
  } = overlays;
  const openOverlay = overlays.open;

  usePushSetup({ currentUser, realChats, pendingOpenRef, tryOpenFromPush });

  const { notifs, toasts, setToasts, notifUnread, loadNotifs } = useUserNotifications({ currentUser, setCurrentUser });

  const { banInfo, setBanInfo } = useAccountStatus({ currentUser, setCurrentUser, view });

  useChatsAndGroups({ currentUser, showArchived, selectedChat, unreadRef, setArchivedCount, setRealChats, setGroups });

  useJoinByInvite({ currentUser, pendingJoin, setPendingJoin, setGroups, setSelectedGroup, setSelectedChat, setShowSidebar });

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

  const [savedInfo, setSavedInfo] = useState<{ chat_id: number; last_message?: string | null; last_message_at?: number | null } | null>(null);
  const refreshSaved = useCallback(() => {
    const uid = currentUserRef.current?.id;
    if (!uid) return;
    api("saved_chat", {}, uid).then(r => { if (r?.chat_id) setSavedInfo(r); }).catch(() => null);
  }, []);
  useEffect(() => { if (currentUser?.id) refreshSaved(); }, [currentUser?.id, refreshSaved]);

  const openSavedChat = async () => {
    if (!currentUser) return;
    track("favorites_open");
    let info = savedInfo;
    if (!info) {
      const r = await api("saved_chat", {}, currentUser.id).catch(() => null);
      if (!r?.chat_id) return;
      info = r;
      setSavedInfo(r);
    }
    overlays.closeAll();
    setSelectedGroup(null);
    setSelectedChat({
      id: info!.chat_id, name: "Избранное", avatar: "★", saved: true,
      partner_id: currentUser.id, lastMsg: info!.last_message || "", time: "",
    } as Chat);
    setView("chats");
    setShowSidebar(false);
  };

  const startCallTo = (userId: number, name: string, video: boolean) => {
    if (!currentUser || activeCall) return;
    track(video ? "call_video" : "call_audio");
    const callId = `${video ? "video_" : ""}${currentUser.id}_${userId}_${Date.now()}`;
    setActiveCall({ userId, name, callId, incoming: false });
  };

  useIncomingCalls({ currentUser, activeCall, setActiveCall, pendingCallId, setPendingCallId });

  const login = (user: User, token?: string) => {
    if (token) setAuthToken(token);
    localStorage.setItem("nova_user", JSON.stringify(user));
    setCurrentUser(user);
  };

  const logout = () => {
    const uid = currentUser?.id;
    if (uid) api("logout", {}, uid).catch(() => {}).finally(() => setAuthToken(null));
    else setAuthToken(null);
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

  // До входа показываем отдельным экраном — приложения ещё нет, терять нечего
  if (maintenance && !currentUser) {
    return <MaintenanceScreen info={maintenance} onRecheck={checkMaintenance} />;
  }

  // Гейт согласия на обработку ПД — обязательное требование RuStore.
  // Показываем ДО любых форм авторизации, чтобы не собирать ни байта данных
  // без явного согласия пользователя.
  if (!consentGiven) {
    return <ConsentScreen onAccept={() => setConsentGiven(true)} />;
  }

  // Знакомство с возможностями — показывается один раз до входа,
  // чтобы новый пользователь сразу понимал, что умеет приложение.
  if (!onboardingDone && !currentUser) {
    return <OnboardingScreen onDone={() => setOnboardingDone(true)} />;
  }

  if (!currentUser) return (
    <>
      <AuthScreen onDone={login} />
    </>
  );

  // PIN-блокировка: если код установлен и ещё не разблокировано в этой сессии
  if (!pinUnlocked && localStorage.getItem("nova_sec_pin")) {
    return <PinLockScreen onUnlock={() => setPinUnlocked(true)} />;
  }

  // Экран политики конфиденциальности (доступен из настроек)
  if (showPrivacyPolicy) {
    return <Suspense fallback={LAZY_FALLBACK}><PrivacyPolicyPanel onBack={() => setShowPrivacyPolicy(false)} /></Suspense>;
  }

  // Экран пользовательского соглашения (доступен из настроек)
  if (showTerms) {
    return (
      <Suspense fallback={LAZY_FALLBACK}>
        <TermsPanel
          onBack={() => setShowTerms(false)}
          onOpenPrivacy={() => {
            setShowTerms(false);
            setShowPrivacyPolicy(true);
          }}
        />
      </Suspense>
    );
  }

  // Экран блокировки — перекрывает всё приложение
  if (banInfo && currentUser) {
    return (
      <Suspense fallback={LAZY_FALLBACK}>
        <BannedScreen
          info={banInfo}
          onLogout={() => { setBanInfo(null); logout(); }}
          onSupport={() => { setBanInfo(null); logout(); }}
        />
      </Suspense>
    );
  }

  // Экран верификации (доступен из профиля)
  if (showVerification && currentUser) {
    return (
      <Suspense fallback={LAZY_FALLBACK}>
        <VerificationPanel
          currentUser={currentUser}
          onBack={() => setShowVerification(false)}
        />
      </Suspense>
    );
  }

  // Экран помощи (доступен из настроек)
  if (showHelp) {
    return (
      <Suspense fallback={LAZY_FALLBACK}>
        <HelpPanel onBack={() => setShowHelp(false)} />
      </Suspense>
    );
  }

  // Экран удаления аккаунта (доступен из настроек)
  if (showAccountDelete) {
    return (
      <Suspense fallback={LAZY_FALLBACK}>
        <AccountDeletePanel
          user={currentUser}
          onBack={() => setShowAccountDelete(false)}
          onDeleted={() => {
            setShowAccountDelete(false);
            logout();
          }}
        />
      </Suspense>
    );
  }

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setView("chats");
    setShowSidebar(false);
  };

  const handleBack = () => {
    setShowSidebar(true);
    if (selectedChat?.saved) refreshSaved();
    const closingId = selectedChat?.id;
    setTimeout(() => setSelectedChat(prev => (prev && prev.id === closingId ? null : prev)), 300);
  };

  return (
    <Suspense fallback={LAZY_FALLBACK}>
    <div className="flex overflow-hidden relative" style={{ height: "100dvh", minHeight: "100dvh" }}>
      {/* Mesh background */}
      <div className="mesh-bg" />
      <ConnectionBanner />

      {/* Подсказка о включении push-уведомлений */}
      {currentUser && <EnableNotificationsBanner userId={currentUser.id} />}

      <IndexOverlays
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        overlays={overlays}
        refToast={refToast}
        showPromo={showPromo}
        setShowPromo={setShowPromo}
        startCallTo={startCallTo}
        handleStartChat={handleStartChat}
      />

      {/* Admin Panel */}

      {/* Call screen */}
      {activeCall && (
        <CallScreen
          currentUser={currentUser}
          remoteUserId={activeCall.userId}
          remoteName={activeCall.name}
          callId={activeCall.callId}
          isIncoming={activeCall.incoming}
          autoAccept={activeCall.autoAccept}
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


      <NovaToaster
        items={toasts}
        onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))}
      />


      {/* Coming soon */}
      <ComingSoon open={showComingSoon} onClose={() => setShowComingSoon(false)} />

      {/* ── Sidebar ── */}
      <aside
        className={`
          flex flex-col flex-shrink-0
          glass-strong !bg-[#0f0c1d] md:!bg-white/[0.07] border-r border-white/5
          transition-transform duration-300 ease-in-out
          md:w-80 lg:w-96
          absolute inset-y-0 left-0 z-20 w-full
          md:relative md:translate-x-0 md:z-auto
          ${showSidebar ? "translate-x-0" : "-translate-x-full invisible pointer-events-none md:visible md:pointer-events-auto"}
        `}
        aria-hidden={!showSidebar ? true : undefined}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 pb-3" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}>
          {/* Служебная панель открывается пятикратным нажатием на логотип —
              она не предназначена для обычных пользователей */}
          <div className="flex items-center gap-2 select-none">
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
            {/* Уведомления */}
            {currentUser && (
              <NotificationsBell
                currentUser={currentUser}
                items={notifs}
                unread={notifUnread}
                onRefresh={() => loadNotifs(false)}
              />
            )}
            {/* Язык */}
            <LanguageSwitcher variant="compact" />
            {/* Все возможности */}
            <button
              onClick={() => openOverlay(setShowComingSoon)}
              className="p-2 rounded-xl hover:bg-white/8 transition-colors text-muted-foreground hover:text-violet-400"
              title="Все возможности Nova"
            >
              <Icon name="Sparkles" size={18} />
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
              {!showArchived && !searchQuery.trim() && (chatFolder === "all" || chatFolder === "favorite") && (
                <button
                  onClick={openSavedChat}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${selectedChat?.saved ? "bg-white/8 glass" : "hover:bg-white/4"}`}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                    <Icon name="Bookmark" size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">Избранное</span>
                      {savedInfo?.last_message_at ? (
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(savedInfo.last_message_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {getDraft(`c${savedInfo?.chat_id}`) && !selectedChat?.saved
                        ? <><span className="text-red-400">Черновик: </span>{getDraft(`c${savedInfo?.chat_id}`)}</>
                        : (savedInfo?.last_message || "Сохраняйте заметки, фото, видео и файлы")}
                    </div>
                  </div>
                </button>
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
                onStartChat={() => setActiveTab("contacts")}
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
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {getDraft(`g${g.id}`) && selectedGroup?.id !== g.id
                                ? <><span className="text-red-400">Черновик: </span>{getDraft(`g${g.id}`)}</>
                                : (g.last_message || `${g.members_count ?? 0} участников`)}
                            </div>
                            {g.unread_count ? (
                              <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center grad-primary">
                                {g.unread_count > 99 ? "99+" : g.unread_count}
                              </span>
                            ) : null}
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
          {NAV_ITEMS.map(item => {
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
                <span className="text-[9px] font-medium">{tr(item.labelKey)}</span>
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
        ${showSidebar && !selectedChat && !selectedGroup ? "translate-x-full invisible pointer-events-none md:translate-x-0 md:visible md:pointer-events-auto" : "translate-x-0"}
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
              track("call_audio");
              const callId = `${currentUser.id}_${partnerId}_${Date.now()}`;
              setActiveCall({ userId: partnerId, name, callId, incoming: false });
            }}
            onVideoCall={(partnerId, name) => {
              track("call_video");
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
            onOpenVerification={() => setShowVerification(true)}
            onOpenPromo={() => setShowPromo(true)}
            onOpenSavedNotes={() => openOverlay(setShowSavedNotes)}
            onOpenCalls={() => openOverlay(setShowCalls)}
            onOpenFavorites={openSavedChat}
            onOpenInvite={() => openOverlay(setShowInvite)}
            onOpenPayments={() => openOverlay(setShowPayments)}
          />
        ) : view === "settings" ? (
          <SettingsPanel
            onLogout={logout}
            onBack={() => setView("profile")}
            onDeleteAccount={() => setShowAccountDelete(true)}
            onOpenPrivacyPolicy={() => setShowPrivacyPolicy(true)}
            onOpenTerms={() => setShowTerms(true)}
            onOpenHelp={() => setShowHelp(true)}
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
      {maintenance && (
        <MaintenanceScreen info={maintenance} onRecheck={checkMaintenance} overlay />
      )}
    </div>
    </Suspense>
  );
}

function MaintenanceScreen({
  info, onRecheck, overlay,
}: {
  info: { title: string; text: string };
  onRecheck: () => Promise<void> | void;
  overlay?: boolean;
}) {
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    await onRecheck();
    setTimeout(() => setChecking(false), 500);
  };

  return (
    <div
      className={`flex items-center justify-center p-6 overflow-hidden ${
        overlay
          ? "fixed inset-0 z-[100] bg-background/95 backdrop-blur-md"
          : "h-screen relative"
      }`}
    >
      {!overlay && <div className="mesh-bg" />}
      <div className="relative text-center max-w-sm">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/15 flex items-center justify-center mx-auto mb-5">
          <Icon name="Wrench" size={36} className="text-amber-400" />
        </div>
        <h1 className="text-2xl font-black mb-2">{info.title}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6 whitespace-pre-wrap">
          {info.text}
        </p>
        <button
          onClick={recheck}
          disabled={checking}
          className="px-6 py-3 glass rounded-2xl text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2"
        >
          {checking ? (
            <>
              <Icon name="Loader2" size={16} className="animate-spin" />
              Проверяем...
            </>
          ) : (
            "Проверить снова"
          )}
        </button>
        <p className="text-xs text-muted-foreground/70 mt-4">
          Мы проверяем автоматически — окно закроется само
        </p>
      </div>
    </div>
  );
}