import Icon from "@/components/ui/icon";

// Диалог подтверждения, бейдж шифрования, подсказка о незнакомце,
// панель закреплённого сообщения и кнопка прокрутки вниз.
// Разметка перенесена из ChatComponents.tsx без изменений.

export function ConfirmDialog({
  confirm, onClose,
}: {
  confirm: { title: string; text: string; danger?: boolean; action: () => void | Promise<void> };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-6 animate-fade-in" onClick={onClose}>
      <div className="glass-strong rounded-2xl p-5 max-w-sm w-full animate-scale-in" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-2">{confirm.title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{confirm.text}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl hover:bg-white/8 text-sm">
            Отмена
          </button>
          <button
            onClick={async () => { const a = confirm.action; onClose(); await a(); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${confirm.danger ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"}`}
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
}

export function EncryptionBadge() {
  return (
    <div className="flex justify-center py-2">
      <div className="flex items-center gap-1.5 px-3 py-1 glass rounded-full">
        <Icon name="Lock" size={11} className="text-violet-400" />
        <span className="text-[11px] text-muted-foreground">Сквозное шифрование</span>
      </div>
    </div>
  );
}

export function UnknownContactHint({
  onAddToContacts, onBlock, onDismiss,
}: {
  onAddToContacts: () => void;
  onBlock: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mx-3 mb-2 glass-strong border border-amber-400/30 rounded-2xl p-3 flex items-start gap-3 animate-fade-in">
      <Icon name="ShieldAlert" size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold mb-0.5">Незнакомый контакт</div>
        <p className="text-[11px] text-muted-foreground mb-2">
          Этот пользователь не сохранён у вас в контактах. Будьте внимательны к ссылкам и просьбам о деньгах.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onAddToContacts}
            className="px-3 py-1.5 rounded-xl grad-primary text-white text-xs font-bold"
          >
            Добавить в контакты
          </button>
          <button
            onClick={onBlock}
            className="px-3 py-1.5 rounded-xl bg-red-500/15 text-red-400 text-xs font-bold"
          >
            Заблокировать
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-xl glass text-xs font-bold text-muted-foreground"
          >
            Скрыть
          </button>
        </div>
      </div>
    </div>
  );
}

export function PinnedBar({
  pinnedMsg, onScrollToMessage, onUnpin,
}: {
  pinnedMsg: { id: number; sender_name: string; text: string; media_type?: string };
  onScrollToMessage: (id: number) => void;
  onUnpin: (id: number) => void;
}) {
  return (
    <button
      onClick={() => onScrollToMessage(pinnedMsg.id)}
      className="flex items-center gap-3 px-4 py-2 glass border-b border-white/5 w-full text-left hover:bg-white/5 transition-colors"
    >
      <Icon name="Pin" size={14} className="text-violet-400 flex-shrink-0" />
      <div className="flex-1 min-w-0 border-l-2 border-violet-400 pl-3">
        <div className="text-[11px] text-violet-400 font-medium">Закреплённое сообщение</div>
        <div className="text-xs text-muted-foreground truncate">
          {pinnedMsg.text || (pinnedMsg.media_type === "image" ? "📷 Фото" : pinnedMsg.media_type === "video" ? "🎥 Видео" : "[медиа]")}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onUnpin(pinnedMsg.id); }}
        className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground"
      >
        <Icon name="X" size={14} />
      </button>
    </button>
  );
}

export function ScrollDownButton({
  newCount, onClick,
}: {
  newCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="absolute right-4 bottom-24 z-20 w-11 h-11 rounded-full glass-strong flex items-center justify-center shadow-lg hover:bg-white/10 transition-all animate-fade-in"
    >
      <Icon name="ChevronDown" size={20} className="text-foreground" />
      {newCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 grad-primary rounded-full text-[10px] font-bold text-white flex items-center justify-center">
          {newCount > 99 ? "99+" : newCount}
        </span>
      )}
    </button>
  );
}
