import type { RefObject } from "react";
import Icon from "@/components/ui/icon";
import { Avatar } from "@/components/messenger/ChatAtoms";
import EmojiStickerPicker from "@/components/messenger/EmojiStickerPicker";
import type { Group, GroupMessage, GroupMember } from "@/lib/api";

interface Props {
  group: Group;
  canWrite: boolean;
  input: string;
  replyTo: GroupMessage | null;
  editing: GroupMessage | null;
  showAttach: boolean;
  showEmoji: boolean;
  recording: boolean;
  recordSec: number;
  mentionCandidates: GroupMember[];
  fileInputRef: RefObject<HTMLInputElement>;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onSendFile: (file: File) => void;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onToggleAttach: () => void;
  onCloseAttach: () => void;
  onOpenVideoCircle: () => void;
  onToggleEmoji: () => void;
  onCloseEmoji: () => void;
  onPickEmoji: (e: string) => void;
  onApplyMention: (name: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
}

export default function GroupChatInput({
  group,
  canWrite,
  input,
  replyTo,
  editing,
  showAttach,
  showEmoji,
  recording,
  recordSec,
  mentionCandidates,
  fileInputRef,
  onInputChange,
  onSend,
  onSendFile,
  onCancelReply,
  onCancelEdit,
  onToggleAttach,
  onCloseAttach,
  onOpenVideoCircle,
  onToggleEmoji,
  onCloseEmoji,
  onPickEmoji,
  onApplyMention,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
}: Props) {
  if (!canWrite) {
    return (
      <div className="px-4 py-4 border-t border-white/5 text-center text-sm text-muted-foreground"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
        <Icon name="Radio" size={16} className="inline mr-2 text-sky-400" />
        Канал: только администраторы могут писать
      </div>
    );
  }

  return (
    <div className="px-4 py-3 glass-strong border-t border-white/5 flex-shrink-0 relative"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
      <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
        className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onSendFile(f); e.target.value = ""; }} />

      {replyTo && !editing && (
        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 glass rounded-xl border-l-2 border-violet-400 animate-fade-in">
          <Icon name="Reply" size={14} className="text-violet-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-violet-400">{replyTo.sender_name}</div>
            <div className="text-xs text-muted-foreground truncate">{replyTo.text || "[медиа]"}</div>
          </div>
          <button onClick={onCancelReply} className="p-1"><Icon name="X" size={14} /></button>
        </div>
      )}

      {editing && (
        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 glass rounded-xl border-l-2 border-amber-400 animate-fade-in">
          <Icon name="Pencil" size={14} className="text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-amber-400">Редактирование</div>
            <div className="text-xs text-muted-foreground truncate">{editing.text || "[медиа]"}</div>
          </div>
          <button onClick={onCancelEdit} className="p-1"><Icon name="X" size={14} /></button>
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
            <button key={item.icon} onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = item.mime; fileInputRef.current.click(); } }}
              className="flex flex-col items-center gap-1 p-3 glass rounded-2xl hover:bg-white/8">
              <Icon name={item.icon as string} size={20} className={item.color} />
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </button>
          ))}
          <button onClick={() => { onCloseAttach(); onOpenVideoCircle(); }}
            className="flex flex-col items-center gap-1 p-3 glass rounded-2xl hover:bg-white/8">
            <Icon name="Video" size={20} className="text-rose-400" />
            <span className="text-[10px] text-muted-foreground">Кружок</span>
          </button>
        </div>
      )}

      {recording && (
        <div className="flex items-center gap-3 mb-2 animate-fade-in">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-red-400 font-medium">
            {String(Math.floor(recordSec / 60)).padStart(2, "0")}:{String(recordSec % 60).padStart(2, "0")}
          </span>
          <button onClick={onCancelRecording} className="ml-auto text-xs text-muted-foreground">Отмена</button>
        </div>
      )}

      {mentionCandidates.length > 0 && (
        <div className="mb-2 glass rounded-xl overflow-hidden max-h-44 overflow-y-auto animate-fade-in">
          {mentionCandidates.map(m => (
            <button
              key={m.id}
              onClick={() => onApplyMention(m.name)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/8 text-left"
            >
              <Avatar label={m.name[0]?.toUpperCase() || "?"} id={m.id} src={m.avatar_url || undefined} size="sm" />
              <span className="text-sm truncate">{m.name}</span>
              {(m.role === "owner" || m.role === "admin") && (
                <span className="text-[10px] text-violet-400 ml-auto">{m.role === "owner" ? "владелец" : "админ"}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <button onClick={onToggleAttach}
          className={`p-2.5 rounded-xl transition ${showAttach ? "bg-violet-500/20 text-violet-400" : "hover:bg-white/8 text-muted-foreground"}`}>
          <Icon name={showAttach ? "X" : "Paperclip"} size={20} />
        </button>
        <div className="flex-1 flex items-end glass rounded-2xl px-4 py-2.5 gap-2">
          <textarea
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder={group.is_channel ? "Написать в канал..." : "Сообщение..."}
            rows={1}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground resize-none max-h-32"
          />
          <div className="relative">
            <button onClick={onToggleEmoji}
              className={`transition ${showEmoji ? "text-violet-400" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon name="Smile" size={20} />
            </button>
            <EmojiStickerPicker open={showEmoji} onClose={onCloseEmoji}
              onPick={onPickEmoji} />
          </div>
        </div>
        {input.trim() ? (
          <button onClick={onSend} className="p-2.5 rounded-xl grad-primary text-white glow-primary">
            <Icon name="Send" size={20} />
          </button>
        ) : (
          <button
            onPointerDown={(e) => { e.preventDefault(); onStartRecording(); }}
            onPointerUp={(e) => { e.preventDefault(); onStopRecording(); }}
            onPointerLeave={() => { if (recording) onStopRecording(); }}
            onContextMenu={(e) => e.preventDefault()}
            className={`p-2.5 rounded-xl select-none touch-none ${recording ? "bg-red-500 text-white" : "glass text-muted-foreground hover:text-violet-400"}`}>
            <Icon name="Mic" size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
