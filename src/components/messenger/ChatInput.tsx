import { useState } from "react";
import Icon from "@/components/ui/icon";
import { type Message, type IconName } from "@/lib/api";
import EmojiStickerPicker from "@/components/messenger/EmojiStickerPicker";

export function ChatInput({
  input,
  setInput,
  showAttach,
  setShowAttach,
  uploading,
  uploadLabel,
  recording,
  recordSec,
  fileInputRef,
  onSend,
  onNotifyTyping,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onFileChange,
  onVideoCircle,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
  onSendGift,
  onAttachFundraiser,
  onOpenStickerPicker,
  stickerPickerSlot,
  onSchedule,
  onShowScheduledList,
  scheduledCount,
}: {
  input: string;
  setInput: (v: string) => void;
  showAttach: boolean;
  setShowAttach: (v: boolean | ((prev: boolean) => boolean)) => void;
  uploading: boolean;
  uploadLabel: string;
  recording: boolean;
  recordSec: number;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onSend: () => void;
  onNotifyTyping: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording?: () => void;
  onFileChange: (file: File) => void;
  onVideoCircle?: () => void;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  editing?: Message | null;
  onCancelEdit?: () => void;
  onSendGift?: () => void;
  onAttachFundraiser?: () => void;
  onOpenStickerPicker?: () => void;
  stickerPickerSlot?: React.ReactNode;
  onSchedule?: () => void;
  onShowScheduledList?: () => void;
  scheduledCount?: number;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  return (
    <div className="px-3 pt-1.5 pb-1 glass-strong border-t border-white/5 relative" style={{ paddingBottom: "calc(0.25rem + env(safe-area-inset-bottom))" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFileChange(f); e.target.value = ""; }}
      />
      {(replyTo || editing) && (
        <div className="flex items-center gap-3 mb-2 px-3 py-2 glass rounded-xl animate-fade-in border-l-2 border-violet-400">
          <Icon name={editing ? "Pencil" : "Reply"} size={16} className="text-violet-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-violet-400 font-medium">
              {editing ? "Редактирование" : `Ответ ${replyTo?.sender_name || ""}`}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {(editing?.text || replyTo?.text || "[медиа]").slice(0, 80)}
            </div>
          </div>
          <button
            onClick={() => { onCancelReply?.(); onCancelEdit?.(); }}
            className="p-1 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-foreground"
          >
            <Icon name="X" size={16} />
          </button>
        </div>
      )}
      {showAttach && (
        <div className="grid grid-cols-5 gap-2 mb-3 animate-fade-in">
          {[
            { icon: "Image", label: "Фото", color: "text-violet-400", mime: "image/*" },
            { icon: "Video", label: "Видео", color: "text-sky-400", mime: "video/*" },
            { icon: "Music", label: "Аудио", color: "text-pink-400", mime: "audio/*" },
            { icon: "FileText", label: "Файл", color: "text-emerald-400", mime: "*" },
          ].map(item => (
            <button
              key={item.icon}
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = item.mime;
                  fileInputRef.current.click();
                }
              }}
              className="flex flex-col items-center gap-1 p-3 glass rounded-2xl hover:bg-white/8 transition-colors"
            >
              <Icon name={item.icon as IconName} size={20} className={item.color} />
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </button>
          ))}
          {onVideoCircle && (
            <button onClick={onVideoCircle} className="flex flex-col items-center gap-1 p-3 glass rounded-2xl hover:bg-white/8 transition-colors">
              <Icon name="Video" size={20} className="text-rose-400" />
              <span className="text-[10px] text-muted-foreground">Кружок</span>
            </button>
          )}
          {onSendGift && (
            <button onClick={onSendGift} className="flex flex-col items-center gap-1 p-3 glass rounded-2xl hover:bg-white/8 transition-colors">
              <Icon name="Zap" size={20} className="text-amber-400" />
              <span className="text-[10px] text-muted-foreground">Подарок</span>
            </button>
          )}
          {onAttachFundraiser && (
            <button onClick={onAttachFundraiser} className="flex flex-col items-center gap-1 p-3 glass rounded-2xl hover:bg-white/8 transition-colors">
              <Icon name="HandHeart" size={20} className="text-pink-400" />
              <span className="text-[10px] text-muted-foreground">Сбор</span>
            </button>
          )}
          {onOpenStickerPicker && (
            <button onClick={onOpenStickerPicker} className="flex flex-col items-center gap-1 p-3 glass rounded-2xl hover:bg-white/8 transition-colors">
              <Icon name="Palette" size={20} className="text-pink-400" />
              <span className="text-[10px] text-muted-foreground">Стикеры</span>
            </button>
          )}
          {onSchedule && (
            <button onClick={onSchedule} className="flex flex-col items-center gap-1 p-3 glass rounded-2xl hover:bg-white/8 transition-colors">
              <Icon name="Clock" size={20} className="text-cyan-400" />
              <span className="text-[10px] text-muted-foreground">Отложить</span>
            </button>
          )}
        </div>
      )}
      {!showAttach && (scheduledCount ?? 0) > 0 && onShowScheduledList && (
        <button
          onClick={onShowScheduledList}
          className="mb-2 w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/15 transition-colors"
        >
          <Icon name="Clock" size={14} />
          Запланировано: {scheduledCount}
          <Icon name="ChevronRight" size={14} className="ml-auto" />
        </button>
      )}
      {stickerPickerSlot}
      {uploading && (
        <div className="flex items-center gap-2 mb-2 px-1 animate-fade-in">
          <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">{uploadLabel}</span>
        </div>
      )}
      {recording && (
        <div className="flex items-center gap-3 mb-2 px-2 animate-fade-in">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-red-400 font-medium">
            Запись {Math.floor(recordSec / 60).toString().padStart(2, "0")}:{(recordSec % 60).toString().padStart(2, "0")}
          </span>
          <button onClick={() => (onCancelRecording ? onCancelRecording() : onStopRecording())} className="ml-auto text-xs text-muted-foreground hover:text-red-400">
            Отмена
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => setShowAttach(v => !v)}
          className={`p-2.5 rounded-xl transition-all ${showAttach ? "bg-violet-500/20 text-violet-400" : "hover:bg-white/8 text-muted-foreground hover:text-foreground"}`}
        >
          <Icon name={showAttach ? "X" : "Paperclip"} size={20} />
        </button>
        <div className="flex-1 flex items-end glass rounded-2xl px-4 py-2 gap-2">
          <textarea
            value={input}
            onChange={e => { setInput(e.target.value); onNotifyTyping(); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="Сообщение..."
            rows={1}
            className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder-muted-foreground resize-none max-h-32"
          />
          <div className="relative">
            <button
              onClick={() => setShowEmoji(v => !v)}
              className={`transition-colors ${showEmoji ? "text-violet-400" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon name="Smile" size={20} />
            </button>
            <EmojiStickerPicker
              open={showEmoji}
              onClose={() => setShowEmoji(false)}
              onPick={(e) => setInput(input + e)}
            />
          </div>
        </div>
        {input.trim() ? (
          <button
            onClick={onSend}
            className="p-2.5 rounded-xl transition-all grad-primary text-white glow-primary animate-scale-in"
          >
            <Icon name="Send" size={20} />
          </button>
        ) : (
          <button
            onClick={() => { if (recording) onStopRecording(); else onStartRecording(); }}
            className={`p-2.5 rounded-xl transition-all ${recording ? "bg-red-500 text-white animate-pulse" : "glass text-muted-foreground hover:text-violet-400"}`}
          >
            <Icon name={recording ? "Send" : "Mic"} size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatInput;