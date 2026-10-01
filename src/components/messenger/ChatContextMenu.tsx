import { useState } from "react";
import Icon from "@/components/ui/icon";
import { type Message } from "@/lib/api";
import { QUICK_REACTIONS } from "@/components/messenger/ChatMediaMessage";

const FULL_EMOJI = ["😀","😂","🥰","😍","😎","🤔","😢","😭","😡","🤯","🥳","😴","🤝","🙏","👍","👎","👏","🔥","💯","✨","⭐","💪","💔","❤️","💜","💙","💚","💛","🧡","🤍","🖤","🎉","🎊","🎁","🚀","💩","🤡","👻","🌚","🌝","☀️","🌈","💎","🏆","🥇","🍕","☕","🍷"];

export function ContextMenu({
  ctxMenu,
  messages,
  onClose,
  onReact,
  onDelete,
  onReply,
  onForward,
  onEdit,
  onPin,
  isPinned,
  onFavorite,
}: {
  ctxMenu: { msgId: number; out: boolean };
  messages: Message[];
  onClose: () => void;
  onReact: (msgId: number, emoji: string) => void;
  onDelete: (msgId: number) => void;
  onReply: (msgId: number) => void;
  onForward: (msgId: number) => void;
  onEdit: (msgId: number) => void;
  onPin: (msgId: number) => void;
  isPinned: boolean;
  onFavorite?: (msgId: number) => void;
}) {
  const msg = messages.find(m => m.id === ctxMenu.msgId);
  const canEdit = ctxMenu.out && msg && (!msg.media_type || msg.media_type === "image") && msg.text && !msg.text.startsWith("📷") && !msg.text.startsWith("🎥") && !msg.text.startsWith("🎵") && !msg.text.startsWith("📎");
  const [showFullPicker, setShowFullPicker] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="glass-strong rounded-2xl overflow-hidden shadow-2xl min-w-[240px] max-w-[340px] max-h-[85vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
        {showFullPicker ? (
          <div className="p-3 border-b border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">Выбери эмодзи</span>
              <button onClick={() => setShowFullPicker(false)} className="p-1 rounded-lg hover:bg-white/10">
                <Icon name="X" size={14} className="text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
              {FULL_EMOJI.map((e) => (
                <button
                  key={e}
                  onClick={() => onReact(ctxMenu.msgId, e)}
                  className="text-xl p-1 rounded-lg hover:bg-white/10 hover:scale-110 transition-all"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-3 py-3 border-b border-white/5">
            {QUICK_REACTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => onReact(ctxMenu.msgId, emoji)}
                className="text-xl p-1 hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => setShowFullPicker(true)}
              className="ml-1 w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
            >
              <Icon name="Plus" size={16} className="text-muted-foreground" />
            </button>
          </div>
        )}
        <button onClick={() => onReply(ctxMenu.msgId)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/8 transition-colors text-sm">
          <Icon name="Reply" size={16} className="text-muted-foreground" />
          Ответить
        </button>
        <button onClick={() => onForward(ctxMenu.msgId)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/8 transition-colors text-sm">
          <Icon name="Forward" size={16} className="text-muted-foreground" />
          Переслать
        </button>
        {canEdit && (
          <button onClick={() => onEdit(ctxMenu.msgId)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/8 transition-colors text-sm">
            <Icon name="Pencil" size={16} className="text-muted-foreground" />
            Изменить
          </button>
        )}
        <button onClick={() => onPin(ctxMenu.msgId)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/8 transition-colors text-sm">
          <Icon name={isPinned ? "PinOff" : "Pin"} size={16} className="text-muted-foreground" />
          {isPinned ? "Открепить" : "Закрепить"}
        </button>
        {onFavorite && ctxMenu.msgId > 0 && (
          <button onClick={() => onFavorite(ctxMenu.msgId)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/8 transition-colors text-sm">
            <Icon name="Star" size={16} className="text-amber-400" />
            В избранное
          </button>
        )}
        <button
          onClick={() => { if (msg?.text) navigator.clipboard.writeText(msg.text); onClose(); }}
          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/8 transition-colors text-sm"
        >
          <Icon name="Copy" size={16} className="text-muted-foreground" />
          Копировать
        </button>
        {ctxMenu.out && (
          <button
            onClick={() => onDelete(ctxMenu.msgId)}
            className="w-full flex items-center gap-3 px-5 py-3 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium border-t border-white/5"
          >
            <Icon name="Trash2" size={16} />
            Удалить сообщение
          </button>
        )}
      </div>
    </div>
  );
}

export default ContextMenu;
