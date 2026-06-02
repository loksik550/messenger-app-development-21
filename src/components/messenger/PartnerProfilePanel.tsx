import Icon from "@/components/ui/icon";
import { type Chat, type IconName } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatAtoms";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";

interface Props {
  chat: Chat;
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
}

function disappearingLabel(sec?: number | null): string {
  if (!sec) return "Выкл";
  if (sec === 10) return "10 с";
  if (sec === 60) return "1 мин";
  if (sec === 300) return "5 мин";
  if (sec === 3600) return "1 ч";
  if (sec === 86400) return "24 ч";
  return "7 дн";
}

export default function PartnerProfilePanel({
  chat, disappearingSeconds, onClose, onCall, onVideoCall,
  onToggleMute, onTogglePin, onToggleFavorite, onToggleArchive,
  onChooseWallpaper, onSetDisappearing, onSearch, onClearHistory, onBlock,
}: Props) {
  useEdgeSwipeBack(onClose);

  const Row = ({ icon, label, value, onClick, red, active, danger }: {
    icon: IconName; label: string; value?: string; onClick: () => void;
    red?: boolean; active?: boolean; danger?: boolean;
  }) => (
    <button
      onClick={() => { onClose(); onClick(); }}
      className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-sm ${
        red || danger ? "text-red-400 hover:bg-red-500/10" : "hover:bg-white/5"
      }`}
    >
      <Icon name={icon} size={18} className={red || danger ? "text-red-400" : active ? "text-violet-400" : "text-muted-foreground"} />
      <span className="flex-1 text-left">{label}</span>
      {value && <span className="text-xs text-muted-foreground">{value}</span>}
      {active && <Icon name="Check" size={16} className="text-violet-400" />}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[260] bg-background flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-white/5" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition" aria-label="Назад">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="text-sm font-semibold flex-1">Профиль</h2>
      </div>

      <div className="flex-1 overflow-y-auto max-w-md mx-auto w-full">
        {/* Аватар и имя */}
        <div className="flex flex-col items-center py-8 px-4">
          <Avatar label={chat.avatar} id={chat.id} size="xl" online={chat.online} src={chat.avatar_url || undefined} zoomable />
          <h1 className="mt-4 text-xl font-bold text-foreground">{chat.name}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {chat.online ? <span className="text-emerald-400">в сети</span> : "был(а) недавно"}
          </p>

          {/* Быстрые действия */}
          <div className="flex items-center gap-3 mt-6">
            <ActionCircle icon="Phone" label="Звонок" color="text-emerald-400" onClick={() => { onClose(); onCall?.(); }} />
            <ActionCircle icon="Video" label="Видео" color="text-sky-400" onClick={() => { onClose(); onVideoCall?.(); }} />
            <ActionCircle icon={chat.muted ? "BellOff" : "Bell"} label={chat.muted ? "Вкл. звук" : "Без звука"} color="text-violet-400" onClick={() => { onClose(); onToggleMute(); }} />
            <ActionCircle icon="Search" label="Поиск" color="text-amber-400" onClick={() => { onClose(); onSearch(); }} />
          </div>
        </div>

        {/* Группа настроек */}
        <div className="mx-3 mb-3 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/5">
          <Row icon={chat.pinned ? "PinOff" : "Pin"} label={chat.pinned ? "Открепить чат" : "Закрепить чат"} active={chat.pinned} onClick={onTogglePin} />
          <div className="h-px bg-white/5 ml-12" />
          <Row icon="Star" label={chat.favorite ? "Убрать из избранного" : "В избранное"} active={chat.favorite} onClick={onToggleFavorite} />
          <div className="h-px bg-white/5 ml-12" />
          <Row icon="Archive" label={chat.archived ? "Из архива" : "В архив"} active={chat.archived} onClick={onToggleArchive} />
        </div>

        <div className="mx-3 mb-3 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/5">
          <Row icon="Image" label="Обои чата" onClick={onChooseWallpaper} />
          <div className="h-px bg-white/5 ml-12" />
          <Row icon="Timer" label="Исчезающие сообщения" value={disappearingLabel(disappearingSeconds)} active={!!disappearingSeconds} onClick={onSetDisappearing} />
        </div>

        {/* Опасные действия */}
        <div className="mx-3 mb-6 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/5">
          <Row icon="Trash2" label="Очистить историю" red onClick={onClearHistory} />
          <div className="h-px bg-white/5 ml-12" />
          <Row icon="Ban" label="Заблокировать" red onClick={onBlock} />
        </div>
      </div>
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