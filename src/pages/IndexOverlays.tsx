import { Suspense } from "react";
import Icon from "@/components/ui/icon";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import type { User } from "@/lib/api";
import type { useOverlays } from "@/hooks/useOverlays";

const WalletPanel = lazyWithRetry(() => import("@/components/messenger/WalletPanel"));
const ProPanel = lazyWithRetry(() => import("@/components/messenger/ProPanel"));
const ProSettingsPanel = lazyWithRetry(() => import("@/components/messenger/ProSettingsPanel"));
const LightningPanel = lazyWithRetry(() => import("@/components/messenger/LightningPanel"));
const StickersStorePanel = lazyWithRetry(() => import("@/components/messenger/StickersStorePanel"));
const FundraiserPanel = lazyWithRetry(() => import("@/components/messenger/FundraiserPanel"));
const AdminStickersPanel = lazyWithRetry(() => import("@/components/messenger/AdminStickersPanel").then(m => ({ default: m.AdminStickersPanel })));
const BotsPanel = lazyWithRetry(() => import("@/components/messenger/BotsPanel"));
const ProgressPanel = lazyWithRetry(() => import("@/components/messenger/ProgressPanel"));
const SupportPanel = lazyWithRetry(() => import("@/components/messenger/SupportPanel"));
const PremiumPanel = lazyWithRetry(() => import("@/components/messenger/PremiumPanel"));
const PrivacyPanel = lazyWithRetry(() => import("@/components/messenger/PrivacyPanel"));
const NotificationsPanel = lazyWithRetry(() => import("@/components/messenger/NotificationsPanel"));
const AppearancePanel = lazyWithRetry(() => import("@/components/messenger/AppearancePanel"));
const SavedNotesPanel = lazyWithRetry(() => import("@/components/messenger/SavedNotesPanel"));
const CallHistoryPanel = lazyWithRetry(() => import("@/components/messenger/CallHistoryPanel"));
const InvitePanel = lazyWithRetry(() => import("@/components/messenger/InvitePanel"));
const PaymentRequestsPanel = lazyWithRetry(() => import("@/components/messenger/PaymentRequestsPanel"));
const PromoPanel = lazyWithRetry(() => import("@/components/messenger/PromoPanel"));

interface Props {
  currentUser: User | null;
  setCurrentUser: (u: User) => void;
  overlays: ReturnType<typeof useOverlays>;
  refToast: string;
  showPromo: boolean;
  setShowPromo: (v: boolean) => void;
  startCallTo: (userId: number, name: string, video: boolean) => void;
  handleStartChat: (partnerId: number) => void;
}

export default function IndexOverlays({
  currentUser, setCurrentUser, overlays, refToast, showPromo, setShowPromo, startCallTo, handleStartChat,
}: Props) {
  const {
    showPro, setShowPro, showWallet, setShowWallet, showProSettings, setShowProSettings,
    showLightning, setShowLightning, showStickers, setShowStickers,
    showAdminStickers, setShowAdminStickers, showProgress, setShowProgress,
    showBots, setShowBots, showSupport, setShowSupport, showPrivacy, setShowPrivacy,
    showNotifications, setShowNotifications, showAppearance, setShowAppearance,
    showSavedNotes, setShowSavedNotes, showPayments, setShowPayments,
    showPremium, setShowPremium, showCalls, setShowCalls, showInvite, setShowInvite,
    fundraiserView, setFundraiserView,
  } = overlays;
  const openOverlay = overlays.open;

  return (
    <>
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

    {showCalls && currentUser && (
      <CallHistoryPanel
        currentUser={currentUser}
        onClose={() => setShowCalls(false)}
        onCall={(uid, name) => { setShowCalls(false); startCallTo(uid, name, false); }}
        onVideoCall={(uid, name) => { setShowCalls(false); startCallTo(uid, name, true); }}
        onOpenChat={(uid) => { setShowCalls(false); handleStartChat(uid); }}
      />
    )}


    {showInvite && currentUser && (
      <InvitePanel currentUser={currentUser} onClose={() => setShowInvite(false)} />
    )}

    {refToast && (
      <div className="fixed left-1/2 -translate-x-1/2 top-16 z-[300] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-pink-500 text-white text-sm font-semibold shadow-lg animate-fade-in flex items-center gap-2">
        <Icon name="Gift" size={16} /> {refToast}
      </div>
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
    {/* PWA install prompt */}
    {showPromo && currentUser && (
      <Suspense fallback={null}>
        <PromoPanel
          currentUser={currentUser}
          onClose={() => setShowPromo(false)}
          onUserUpdate={(u) => setCurrentUser(u)}
        />
      </Suspense>
    )}
    </>
  );
}
