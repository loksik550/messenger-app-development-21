import { lazy, Suspense, useState } from "react";
import Icon from "@/components/ui/icon";
import { native } from "@/lib/native";
import { type User, type IconName } from "@/lib/api";
import { useT } from "@/hooks/useT";
import { useSupportUnread } from "@/hooks/useSupportUnread";

const MyStickersPanel = lazy(() => import("@/components/messenger/MyStickersPanel"));

export interface ProfileMenuActions {
  onSettings: () => void;
  onOpenWallet?: () => void;
  onOpenPro?: () => void;
  onOpenProSettings?: () => void;
  onOpenProgress?: () => void;
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

type Row = { icon: string; label: string; sub?: string; action?: () => void; color: string; badge?: number; alert?: boolean };

export function ProfileMenu({
  currentUser, chatsCount, contactsCount, onEditProfile, onSettings,
  onOpenWallet, onOpenProSettings, onOpenSupport,
  onOpenPrivacy, onOpenNotifications, onOpenAppearance,
  onOpenVerification, onOpenPromo, onOpenCalls, onOpenFavorites, onOpenInvite,
}: Props) {
  const { t: tr } = useT();
  const [showMyStickers, setShowMyStickers] = useState(false);
  const supportUnread = useSupportUnread(currentUser?.id);

  const invite = async () => {
    if (onOpenInvite) { onOpenInvite(); return; }
    const ok = await native.share({ title: "Nova — мессенджер", text: "Привет! Давай общаться в Nova", url: "https://novaa.pro/" });
    if (!ok) alert("Ссылка скопирована!");
  };

  const balance = (currentUser.wallet_balance || 0).toLocaleString("ru", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const groups: { title: string; rows: (Row | false | undefined)[] }[] = [
    {
      title: "Аккаунт",
      rows: [
        { icon: "UserPen", label: tr("profile.editProfile"), sub: "Имя, фото, статус", action: onEditProfile, color: "#8b5cf6" },
        !!onOpenProSettings && { icon: "Sparkles", label: "Персонализация", sub: "Эмодзи-статус, цвет ника, инкогнито", action: onOpenProSettings, color: "#d946ef" },
        !!onOpenVerification && { icon: "BadgeCheck", label: "Верификация", sub: currentUser.verified ? "Аккаунт подтверждён" : "Получить синюю галочку", action: onOpenVerification, color: "#3b82f6" },
      ],
    },
    {
      title: "Общение",
      rows: [
        !!onOpenFavorites && { icon: "Bookmark", label: "Избранное", sub: "Заметки, фото и файлы для себя", action: onOpenFavorites, color: "#0ea5e9" },
        !!onOpenCalls && { icon: "Phone", label: "Звонки", sub: "История звонков", action: onOpenCalls, color: "#10b981" },
        { icon: "Sticker", label: "Мои стикеры", sub: "Стикеры из ваших фото", action: () => setShowMyStickers(true), color: "#f59e0b" },
      ],
    },
    {
      title: "Настройки",
      rows: [
        !!onOpenNotifications && { icon: "Bell", label: tr("nav.notifications"), sub: "Звуки, вибрация, тихие часы", action: onOpenNotifications, color: "#ef4444" },
        !!onOpenPrivacy && { icon: "Shield", label: "Безопасность и приватность", sub: "PIN-код, кто видит, устройства", action: onOpenPrivacy, color: "#22c55e" },
        { icon: "Lock", label: "Шифрование", sub: "Исчезающие сообщения", action: onSettings, color: "#64748b" },
        !!onOpenAppearance && { icon: "Palette", label: tr("nav.appearance"), sub: "Темы, обои, шрифт", action: onOpenAppearance, color: "#ec4899" },
      ],
    },
    {
      title: "Кошелёк и бонусы",
      rows: [
        !!onOpenWallet && { icon: "Wallet", label: "Nova Кошелёк", sub: `Баланс ${balance} ₽`, action: onOpenWallet, color: "#7c3aed" },
        { icon: "UserPlus", label: "Пригласить друга", sub: "Вы оба получите Nova Pro в подарок", action: invite, color: "#06b6d4" },
        !!onOpenPromo && { icon: "Gift", label: "Промокоды", sub: "Активировать промокод", action: onOpenPromo, color: "#f97316" },
      ],
    },
    {
      title: "Помощь",
      rows: [
        !!onOpenSupport && {
          icon: "LifeBuoy", label: "Поддержка Nova", color: "#a855f7", action: onOpenSupport, badge: supportUnread, alert: supportUnread > 0,
          sub: supportUnread > 0 ? (supportUnread === 1 ? "Новый ответ от поддержки" : "Новые ответы от поддержки") : "Вопросы, ошибки, идеи",
        },
      ],
    },
  ];

  return (
    <>
    {showMyStickers && (
      <Suspense fallback={null}>
        <MyStickersPanel currentUser={currentUser} onClose={() => setShowMyStickers(false)} />
      </Suspense>
    )}
    <div className="grid grid-cols-2 gap-2 px-4 mb-5">
      {[
        { label: tr("profile.contacts"), value: String(contactsCount), icon: "Users" },
        { label: "Чаты", value: String(chatsCount), icon: "MessageCircle" },
      ].map((s, i) => (
        <div key={s.label} className={`glass rounded-2xl p-3 text-center animate-fade-in stagger-${i + 1}`}>
          <Icon name={s.icon as IconName} size={18} className="text-violet-400 mx-auto mb-1" />
          <div className="text-lg font-bold grad-text">{s.value}</div>
          <div className="text-[11px] text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>

    <div className="px-4 space-y-5" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom) + 80px)" }}>
      {groups.map(g => {
        const rows = g.rows.filter(Boolean) as Row[];
        if (!rows.length) return null;
        return (
          <div key={g.title}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5">{g.title}</div>
            <div className="glass rounded-2xl overflow-hidden">
              {rows.map((r, i) => (
                <button
                  key={r.label}
                  onClick={r.action}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 hover:bg-white/5 active:bg-white/8 transition text-left ${i ? "border-t border-white/[0.06]" : ""}`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: r.color }}>
                    <Icon name={r.icon as IconName} fallback="Circle" size={17} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.label}</div>
                    {r.sub && <div className={`text-xs truncate ${r.alert ? "text-red-400 font-medium" : "text-muted-foreground"}`}>{r.sub}</div>}
                  </div>
                  {r.badge ? (
                    <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                      {r.badge > 99 ? "99+" : r.badge}
                    </span>
                  ) : null}
                  <Icon name="ChevronRight" size={16} className="text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

export default ProfileMenu;
