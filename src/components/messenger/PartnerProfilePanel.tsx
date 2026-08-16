import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { type Chat, type IconName, api, getCallAvatar, setCallAvatar, clearCallAvatar, fileToCallAvatar, formatLastSeen } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatAtoms";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { useT } from "@/hooks/useT";

interface Props {
  chat: Chat;
  currentUserId: number;
  disappearingSeconds?: number | null;
  onClose: () => void;
  onCall?: () => void;
  onVideoCall?: () => void;
  onToggleMute: () => void;
  onTogglePin: () => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onChooseWallpaper: () => void;
  onSetDisappearing: () => void;
  onSearch: () => void;
  onClearHistory: () => void;
  onBlock: () => void;
  onDeleteContact?: () => void;
  isContact?: boolean;
}

const REPORT_REASONS = ["spam", "abuse", "scam", "violence", "porn", "other"] as const;

export default function PartnerProfilePanel({
  chat, currentUserId, disappearingSeconds, onClose, onCall, onVideoCall,
  onToggleMute, onTogglePin, onToggleFavorite, onToggleArchive,
  onChooseWallpaper, onSetDisappearing, onSearch, onClearHistory, onBlock,
  onDeleteContact, isContact,
}: Props) {
  useEdgeSwipeBack(onClose);
  const { t } = useT();
  const [showReport, setShowReport] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const callAvatarFileRef = useRef<HTMLInputElement | null>(null);
  const [callAvatar, setCallAvatarState] = useState<string | null>(() => chat.partner_id ? getCallAvatar(chat.partner_id) : null);

  const onPickCallAvatar = () => callAvatarFileRef.current?.click();
  const onCallAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !chat.partner_id) return;
    if (!f.type.startsWith("image/")) { setToast("Нужен файл-картинка"); window.setTimeout(() => setToast(""), 2200); return; }
    try {
      const dataUrl = await fileToCallAvatar(f);
      setCallAvatar(chat.partner_id, dataUrl);
      setCallAvatarState(dataUrl);
      setToast("Фото на звонок установлено");
    } catch {
      setToast("Не удалось загрузить фото");
    }
    window.setTimeout(() => setToast(""), 2200);
  };
  const removeCallAvatar = () => {
    if (!chat.partner_id) return;
    clearCallAvatar(chat.partner_id);
    setCallAvatarState(null);
    setToast("Фото на звонок убрано");
    window.setTimeout(() => setToast(""), 2200);
  };

  const disappearingLabel = (sec?: number | null): string => {
    if (!sec) return t("report.off");
    if (sec === 10) return "10s";
    if (sec === 60) return "1m";
    if (sec === 300) return "5m";
    if (sec === 3600) return "1h";
    if (sec === 86400) return "24h";
    return "7d";
  };

  const submitReport = async (reason: string) => {
    if (!chat.partner_id || reporting) return;
    setReporting(true);
    await api("report", {
      reported_user_id: chat.partner_id,
      chat_id: chat.id,
      reason,
      comment: comment.trim() || undefined,
    }, currentUserId);
    setReporting(false);
    setShowReport(false);
    setComment("");
    setToast(t("report.sent"));
    window.setTimeout(() => setToast(""), 2200);
  };

  const Row = ({ icon, label, value, onClick, red, active, disabled, hint }: {
    icon: IconName; label: string; value?: string; onClick: () => void;
    red?: boolean; active?: boolean; disabled?: boolean; hint?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-sm ${
        disabled
          ? "opacity-40 cursor-default"
          : red ? "text-red-400 hover:bg-red-500/10" : "hover:bg-white/5"
      }`}
    >
      <Icon
        name={icon}
        size={18}
        className={disabled ? "text-muted-foreground" : red ? "text-red-400" : active ? "text-violet-400" : "text-muted-foreground"}
      />
      <span className={`flex-1 text-left ${disabled ? "text-muted-foreground" : ""}`}>{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {value && <span className="text-xs text-muted-foreground">{value}</span>}
      {active && <Icon name="Check" size={16} className="text-violet-400" />}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[260] bg-background flex flex-col animate-fade-in">
      <div className="flex items-center gap-2 px-2 py-2 border-b border-white/5" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition" aria-label={t("common.back")}>
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="text-sm font-semibold flex-1">{t("partner.title")}</h2>
      </div>

      <div className="flex-1 overflow-y-auto max-w-md mx-auto w-full">
        <div className="flex flex-col items-center py-8 px-4">
          <Avatar label={chat.avatar} id={chat.id} size="xl" online={chat.online} src={(chat.partner_id ? getCallAvatar(chat.partner_id) : null) || chat.avatar_url || undefined} zoomable />
          <h1 className="mt-4 text-xl font-bold text-foreground">{chat.name}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {chat.online ? <span className="text-emerald-400">{t("partner.online")}</span> : formatLastSeen(chat.lastSeen)}
          </p>

          <div className="flex items-center gap-3 mt-6">
            <ActionCircle icon="Phone" label={t("partner.call")} color="text-emerald-400" onClick={() => { onClose(); onCall?.(); }} />
            <ActionCircle icon="Video" label={t("partner.video")} color="text-sky-400" onClick={() => { onClose(); onVideoCall?.(); }} />
            <ActionCircle icon={chat.muted ? "BellOff" : "Bell"} label={chat.muted ? t("partner.unmute") : t("partner.mute")} color="text-violet-400" onClick={() => { onClose(); onToggleMute(); }} />
            <ActionCircle icon="Search" label={t("partner.search")} color="text-amber-400" onClick={() => { onClose(); onSearch(); }} />
          </div>
        </div>

        <div className="mx-3 mb-3 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/5">
          <Row icon={chat.pinned ? "PinOff" : "Pin"} label={chat.pinned ? t("partner.unpin") : t("partner.pin")} active={chat.pinned} onClick={() => { onClose(); onTogglePin(); }} />
          <div className="h-px bg-white/5 ml-12" />
          <Row icon="Star" label={chat.favorite ? t("partner.favoriteOff") : t("partner.favoriteOn")} active={chat.favorite} onClick={() => { onClose(); onToggleFavorite(); }} />
          <div className="h-px bg-white/5 ml-12" />
          <Row icon="Archive" label={chat.archived ? t("partner.archiveOff") : t("partner.archiveOn")} active={chat.archived} onClick={() => { onClose(); onToggleArchive(); }} />
        </div>

        <div className="mx-3 mb-3 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/5">
          <Row icon="Image" label={t("partner.wallpaper")} onClick={() => { onClose(); onChooseWallpaper(); }} />
          <div className="h-px bg-white/5 ml-12" />
          <Row icon="Timer" label={t("partner.disappearing")} value={disappearingLabel(disappearingSeconds)} active={!!disappearingSeconds} onClick={() => { onClose(); onSetDisappearing(); }} />
          {chat.partner_id && (
            <>
              <div className="h-px bg-white/5 ml-12" />
              <div className="w-full flex items-center gap-3 px-4 py-3.5 text-sm">
                <Icon name="ImagePlus" size={18} className={callAvatar ? "text-violet-400" : "text-muted-foreground"} />
                <span className="flex-1 text-left">Фото на звонок</span>
                {callAvatar && <img src={callAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />}
                <button onClick={onPickCallAvatar} className="p-1.5 rounded-lg hover:bg-white/8" title="Загрузить">
                  <Icon name="Upload" size={15} className="text-violet-400" />
                </button>
                {callAvatar && (
                  <button onClick={removeCallAvatar} className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-400" title="Убрать">
                    <Icon name="Trash2" size={15} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <input ref={callAvatarFileRef} type="file" accept="image/*" className="hidden" onChange={onCallAvatarFile} />

        <div className="mx-3 mb-6 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/5">
          <Row icon="Flag" label={t("partner.report")} red onClick={() => setShowReport(true)} />
          <div className="h-px bg-white/5 ml-12" />
          <Row icon="Trash2" label={t("partner.clearHistory")} red onClick={() => { onClose(); onClearHistory(); }} />
          {onDeleteContact && (
            <>
              <div className="h-px bg-white/5 ml-12" />
              <Row
                icon="UserMinus"
                label="Удалить из контактов"
                red
                disabled={!isContact}
                hint={isContact ? undefined : "Не в ваших контактах"}
                onClick={() => setConfirmDelete(true)}
              />
            </>
          )}
          <div className="h-px bg-white/5 ml-12" />
          <Row icon="Ban" label={t("partner.block")} red onClick={() => { onClose(); onBlock(); }} />
        </div>
      </div>

      {/* Подтверждение удаления контакта */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-6" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-xs glass-strong rounded-3xl p-5 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center gap-2 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
                <Icon name="UserMinus" size={22} className="text-red-400" />
              </div>
              <h3 className="font-bold text-base">Удалить контакт?</h3>
              <p className="text-xs text-muted-foreground">{chat.name} будет удалён из ваших контактов. Переписка останется.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 text-sm font-medium transition">Отмена</button>
              <button
                onClick={() => { setConfirmDelete(false); onClose(); onDeleteContact?.(); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report sheet */}
      {showReport && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowReport(false)}>
          <div className="w-full max-w-md glass-strong rounded-t-3xl p-5 animate-fade-in" onClick={e => e.stopPropagation()} style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon name="Flag" size={18} className="text-red-400" />
              <h3 className="font-bold text-lg">{t("report.title")}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{t("report.subtitle")}</p>
            <div className="space-y-1.5 mb-3">
              {REPORT_REASONS.map(r => (
                <button
                  key={r}
                  disabled={reporting}
                  onClick={() => submitReport(r)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/8 text-sm transition disabled:opacity-50"
                >
                  {t(`report.reason.${r}`)}
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 1000))}
              placeholder={t("report.commentPlaceholder")}
              rows={2}
              className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm outline-none resize-none focus:bg-white/8 mb-3"
            />
            <button
              onClick={() => setShowReport(false)}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/8 text-sm font-medium transition"
            >
              {t("report.cancel")}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-8 z-[320] px-4 py-2.5 rounded-2xl bg-black/80 backdrop-blur text-white text-sm font-medium shadow-2xl animate-fade-in" style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function ActionCircle({ icon, label, color, onClick }: { icon: IconName; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 group">
      <span className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-active:scale-95 transition">
        <Icon name={icon} size={20} className={color} />
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </button>
  );
}