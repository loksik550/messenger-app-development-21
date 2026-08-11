import { useState } from "react";

/**
 * Хук для управления оверлей-панелями: только одна открыта одновременно.
 * Используется в Index.tsx для всех полноэкранных модалок.
 */
export function useOverlays() {
  const [showPro, setShowPro] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinChannel, setShowJoinChannel] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showProSettings, setShowProSettings] = useState(false);
  const [showLightning, setShowLightning] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showAdminStickers, setShowAdminStickers] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showBots, setShowBots] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showSavedNotes, setShowSavedNotes] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [fundraiserView, setFundraiserView] = useState<{ mode: "create" } | { mode: "view"; id: number } | null>(null);

  const closeAll = () => {
    setShowAdmin(false);
    setShowPro(false);
    setShowComingSoon(false);
    setShowCreateGroup(false);
    setShowJoinChannel(false);
    setShowWallet(false);
    setShowProSettings(false);
    setShowLightning(false);
    setShowStickers(false);
    setShowAdminStickers(false);
    setShowProgress(false);
    setShowBots(false);
    setShowSupport(false);
    setShowPrivacy(false);
    setShowNotifications(false);
    setShowAppearance(false);
    setShowSavedNotes(false);
    setShowPayments(false);
    setShowPremium(false);
    setFundraiserView(null);
  };

  const open = (setter: (v: boolean) => void) => {
    closeAll();
    setter(true);
  };

  return {
    // флаги
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
    // экшены
    closeAll,
    open,
  };
}