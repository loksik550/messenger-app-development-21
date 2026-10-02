import Icon from "@/components/ui/icon";
import { native } from "@/lib/native";
import { type User, type IconName } from "@/lib/api";
import { useT } from "@/hooks/useT";

export interface ProfileMenuActions {
  onSettings: () => void;
  onOpenWallet?: () => void;
  onOpenPro?: () => void;
  onOpenProSettings?: () => void;
  onOpenProgress?: () => void;
  onOpenBots?: () => void;
  onOpenSupport?: () => void;
  onOpenPrivacy?: () => void;
  onOpenNotifications?: () => void;
  onOpenAppearance?: () => void;
  onOpenSavedNotes?: () => void;
  onOpenPayments?: () => void;
  onOpenVerification?: () => void;
  onOpenPromo?: () => void;
  onOpenCalls?: () => void;
  onOpenFavorites?: () => void;
  onOpenInvite?: () => void;
}

interface Props extends ProfileMenuActions {
  currentUser: User;
  chatsCount: number;
  contactsCount: number;
  onEditProfile: () => void;
}

export function ProfileMenu({
  currentUser, chatsCount, contactsCount, onEditProfile, onSettings,
  onOpenWallet, onOpenPro, onOpenProSettings, onOpenProgress, onOpenBots, onOpenSupport,
  onOpenPrivacy, onOpenNotifications, onOpenAppearance, onOpenSavedNotes, onOpenPayments,
  onOpenVerification, onOpenPromo, onOpenCalls, onOpenFavorites, onOpenInvite,
}: Props) {
  const { t: tr } = useT();

  return (
    <>
    <div className="grid grid-cols-3 gap-2 px-4 mb-4">
      {[
        { label: tr("profile.contacts"), value: String(contactsCount), icon: "Users" },
        { label: "Чаты", value: String(chatsCount), icon: "MessageCircle" },
        { label: "Уровень", value: String(currentUser.level || 1), icon: "Trophy", action: onOpenProgress },
      ].map((s, i) => (
        <button key={s.label} onClick={s.action || undefined} disabled={!s.action}
          className={`glass rounded-2xl p-3 text-center animate-fade-in stagger-${i + 1} ${s.action ? "hover:bg-white/8 active:scale-95 transition" : ""}`}>
          <Icon name={s.icon as IconName} size={18} className="text-violet-400 mx-auto mb-1" />
          <div className="text-lg font-bold grad-text">{s.value}</div>
          <div className="text-[11px] text-muted-foreground">{s.label}</div>
        </button>
      ))}
    </div>

    {onOpenWallet && (
      <div className="px-4 mb-3">
        <button onClick={onOpenWallet}
          className="w-full rounded-2xl p-4 text-white relative overflow-hidden text-left"
          style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)" }}>
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
              <Icon name="Wallet" size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white/80 mb-0.5">Nova Кошелёк</div>
              <div className="text-xl font-black truncate">
                {(currentUser.wallet_balance || 0).toLocaleString("ru", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
              </div>
            </div>
            <Icon name="ChevronRight" size={20} className="text-white/60 flex-shrink-0" />
          </div>
        </button>
      </div>
    )}

    {onOpenBots && (
      <div className="px-4 mb-3">
        <button onClick={onOpenBots} className="w-full glass rounded-2xl p-3 flex items-center gap-3 hover:bg-white/8 transition">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}>
            <Icon name="Bot" size={18} className="text-white" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-bold truncate">Мои боты</div>
            <div className="text-[11px] text-muted-foreground truncate">Создавай ботов для автоматизации</div>
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground flex-shrink-0" />
        </button>
      </div>
    )}

    {onOpenSupport && (
      <div className="px-4 mb-3">
        <button onClick={onOpenSupport} className="w-full glass rounded-2xl p-3 flex items-center gap-3 hover:bg-white/8 transition">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}>
            <Icon name="LifeBuoy" size={18} className="text-white" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-bold truncate">Поддержка Nova</div>
            <div className="text-[11px] text-muted-foreground truncate">Помощь, баги, идеи</div>
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground flex-shrink-0" />
        </button>
      </div>
    )}

    {onOpenPro && (
      <div className="px-4 mb-4">
        <button onClick={onOpenPro}
          className="w-full rounded-2xl p-3 flex items-center gap-3 transition"
          style={{
            background: currentUser.is_pro
              ? "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.15))"
              : "rgba(255,255,255,0.05)",
            border: currentUser.is_pro ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.08)",
          }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
            👑
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-bold truncate">
              {currentUser.is_pro ? "Nova Pro активен" : "Оформить Nova Pro"}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {currentUser.is_pro && currentUser.pro_until
                ? `до ${new Date(currentUser.pro_until * 1000).toLocaleDateString("ru")}`
                : "Эмодзи-статус, цвет ника, инкогнито и больше"}
            </div>
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground flex-shrink-0" />
        </button>
      </div>
    )}

    <div className="glass rounded-2xl p-4 border border-violet-500/20 mx-4 mb-4">
      <p className="text-sm font-semibold mb-1">{tr("profile.invite")}</p>
      <p className="text-xs text-muted-foreground mb-3">Отправьте другу личную ссылку — и вы оба получите Premium в подарок</p>
      <button
        onClick={async () => {
          if (onOpenInvite) { onOpenInvite(); return; }
          const url = "https://novaa.pro/";
          const ok = await native.share({ title: "Nova — мессенджер", text: "Привет! Давай общаться в Nova", url });
          if (!ok) alert("Ссылка скопирована!");
        }}
        className="w-full py-3 grad-primary rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 glow-primary"
      >
        <Icon name="Share2" size={16} /> {tr("profile.shareLink")}
      </button>
    </div>

    <div className="px-4 space-y-2 mb-6" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom) + 80px)" }}>
      {[
        { icon: "Edit3", label: tr("profile.editProfile"), sub: "Имя, фото, статус", action: onEditProfile },
        ...(onOpenProSettings ? [{ icon: "Sparkles", label: "Персонализация", sub: "Эмодзи-статус, цвет, инкогнито", action: onOpenProSettings }] : []),
        ...(onOpenProgress ? [{ icon: "Trophy", label: tr("nav.progress"), sub: `${currentUser.level ? `Уровень ${currentUser.level} · ${currentUser.xp || 0} XP` : "Уровни, бейджи, топ"}`, action: onOpenProgress }] : []),
        ...(onOpenCalls ? [{ icon: "Phone", label: "Звонки", sub: "Входящие, исходящие, пропущенные", action: onOpenCalls }] : []),
        ...(onOpenFavorites ? [{ icon: "Bookmark", label: "Избранное", sub: "Заметки, фото, видео и файлы для себя", action: onOpenFavorites }] : []),
        ...(onOpenSavedNotes ? [{ icon: "Bookmark", label: tr("nav.saved"), sub: "Заметки, сохранёнки, идеи", action: onOpenSavedNotes }] : []),
        ...(onOpenPayments ? [{ icon: "ReceiptText", label: "Счета и платежи", sub: "Выставляй и оплачивай", action: onOpenPayments }] : []),
        ...(onOpenPromo ? [{ icon: "Gift", label: "Промокоды и бонусы", sub: "Premium бесплатно и приглашения", action: onOpenPromo }] : []),
        ...(onOpenNotifications ? [{ icon: "Bell", label: tr("nav.notifications"), sub: "Звуки, вибрация, тихие часы", action: onOpenNotifications }] : []),
        ...(onOpenVerification ? [{ icon: "BadgeCheck", label: "Верификация", sub: currentUser.verified ? "Аккаунт подтверждён" : "Получить синюю галочку", action: onOpenVerification }] : []),
        ...(onOpenPrivacy ? [{ icon: "Shield", label: "Безопасность и приватность", sub: "PIN, кто видит, сессии", action: onOpenPrivacy }] : []),
        { icon: "Lock", label: "Шифрование", sub: "Исчезающие сообщения, E2E", action: onSettings },
        ...(onOpenAppearance ? [{ icon: "Palette", label: tr("nav.appearance"), sub: "Темы, обои, шрифт", action: onOpenAppearance }] : []),
      ].map((item, i) => (
        <button
          key={`${item.icon}-${item.label}`}
          onClick={item.action}
          className={`w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl hover:bg-white/8 transition-all animate-fade-in stagger-${Math.min(i + 1, 5)}`}
        >
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <Icon name={item.icon as IconName} size={18} className="text-violet-400" />
          </div>
          <div className="text-left flex-1">
            <div className="text-sm font-medium">{item.label}</div>
            <div className="text-xs text-muted-foreground">{item.sub}</div>
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
        </button>
      ))}
    </div>
    </>
  );
}

export default ProfileMenu;
