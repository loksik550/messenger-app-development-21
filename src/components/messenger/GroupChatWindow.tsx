import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, uploadMedia, type User, type Group, type GroupMessage, type GroupMember } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatAtoms";
import { MediaMessage } from "@/components/messenger/ChatMediaMessage";
import EmojiStickerPicker from "@/components/messenger/EmojiStickerPicker";
import { LinkifiedText } from "@/components/messenger/LinkifiedText";
import VideoCircleRecorder from "@/components/messenger/VideoCircleRecorder";
import GroupProfilePanel from "@/components/messenger/GroupProfilePanel";
import { MediaViewer } from "@/components/messenger/MediaViewer";
import { useAdaptivePoll } from "@/hooks/useAdaptivePoll";

const POLL_MS = 3500;

interface Props {
  group: Group;
  currentUser: User;
  onBack: () => void;
  onGroupUpdated?: (g: Group) => void;
  onGroupDeleted?: () => void;
}

export function GroupChatWindow({ group, currentUser, onBack, onGroupUpdated, onGroupDeleted }: Props) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [input, setInput] = useState("");
  const [lastSince, setLastSince] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showVideoCircle, setShowVideoCircle] = useState(false);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ msgId: number; out: boolean } | null>(null);
  const [pinned, setPinned] = useState<{ id: number; text: string; sender_name: string; media_type?: string } | null>(null);
  const [onlyAdminsPost, setOnlyAdminsPost] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toTime = (ts: number) => new Date(ts * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });

  const loadMessages = useCallback(async (since = 0): Promise<boolean> => {
    const d = await api("get_group_messages", { group_id: group.id, since }, currentUser.id);
    if (!d.messages) return false;
    const msgs: GroupMessage[] = d.messages.map((m: GroupMessage) => ({ ...m, time: toTime(m.created_at) }));
    let changed = false;
    if (since === 0) {
      setMessages(msgs);
    } else if (msgs.length) {
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        return [...prev, ...msgs.filter((m: GroupMessage) => !ids.has(m.id))];
      });
      setLastSince(msgs[msgs.length - 1].created_at);
      changed = true;
    }
    if (since === 0 && msgs.length) setLastSince(msgs[msgs.length - 1].created_at);
    return changed;
  }, [group.id, currentUser.id]);

  useEffect(() => {
    loadMessages(0);
    api("get_group_members", { group_id: group.id }, currentUser.id).then(d => {
      if (d.members) setMembers(d.members.filter((m: GroupMember) => m.role !== "removed"));
    });
    api("get_pinned_group_message", { group_id: group.id }, currentUser.id).then(d => {
      setPinned(d?.pinned || null);
    });
    api("get_group_info", { group_id: group.id }, currentUser.id).then(d => {
      if (d?.group) setOnlyAdminsPost(!!d.group.only_admins_post);
    });
    api("get_mute_settings", {}, currentUser.id).then(d => {
      const now = Math.floor(Date.now() / 1000);
      const entry = (d?.muted_groups || []).find((g: { group_id: number; muted_until: number }) => g.group_id === group.id);
      setIsMuted(!!entry && (entry.muted_until === 0 || entry.muted_until > now));
    });
  }, [group.id, currentUser.id, loadMessages]);

  const myRole = members.find(m => m.id === currentUser.id)?.role;
  const isAdminHere = myRole === "owner" || myRole === "admin";
  const canWrite = (!group.is_channel && !onlyAdminsPost) || isAdminHere;

  const pinMessage = async (msgId: number) => {
    setCtxMenu(null);
    const r = await api("pin_group_message", { group_id: group.id, message_id: msgId }, currentUser.id);
    if (r?.error) { alert(r.error); return; }
    const m = messages.find(x => x.id === msgId);
    if (m) setPinned({ id: m.id, text: m.text || "", sender_name: m.sender_name || "", media_type: m.media_type ?? undefined });
  };

  const unpinMessage = async () => {
    const r = await api("unpin_group_message", { group_id: group.id }, currentUser.id);
    if (r?.error) { alert(r.error); return; }
    setPinned(null);
  };

  const lastSinceRef = useRef(0);
  lastSinceRef.current = lastSince;

  useAdaptivePoll(() => loadMessages(lastSinceRef.current), [group.id, loadMessages], POLL_MS, 10000);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const replyId = replyTo?.id;
    setReplyTo(null);
    const d = await api("send_group_message", { group_id: group.id, text, reply_to_id: replyId }, currentUser.id);
    if (d.id) {
      setMessages(prev => [...prev, {
        id: d.id, sender_id: currentUser.id, sender_name: currentUser.name,
        sender_avatar: currentUser.avatar_url, text, created_at: d.created_at,
        time: toTime(d.created_at), out: true, kind: "text",
      }]);
      setLastSince(d.created_at);
    }
  };

  const sendFile = async (file: File) => {
    setUploading(true); setShowAttach(false);
    try {
      const result = await uploadMedia(file, currentUser.id);
      const d = await api("send_group_message", {
        group_id: group.id, media_type: result.media_type, media_url: result.url,
        file_name: result.file_name, file_size: result.file_size,
      }, currentUser.id);
      if (d.id) {
        setMessages(prev => [...prev, {
          id: d.id, sender_id: currentUser.id, sender_name: currentUser.name,
          sender_avatar: currentUser.avatar_url, text: "", created_at: d.created_at,
          time: toTime(d.created_at), out: true, kind: "text",
          media_type: result.media_type, media_url: result.url,
          file_name: result.file_name, file_size: result.file_size,
        }]);
        setLastSince(d.created_at);
      }
    } catch { /* ignore */ } finally { setUploading(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorder.current = mr; audioChunks.current = [];
      mr.ondataavailable = e => { if (e.data.size) audioChunks.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        await sendFile(new File([blob], `voice_${Date.now()}.webm`, { type: "audio/webm" }));
      };
      mr.start(); setRecording(true); setRecordSec(0);
      recordTimer.current = setInterval(() => setRecordSec(s => s + 1), 1000);
    } catch { alert("Нет доступа к микрофону"); }
  };

  const stopRecording = () => {
    if (mediaRecorder.current?.state !== "inactive") mediaRecorder.current?.stop();
    if (recordTimer.current) clearInterval(recordTimer.current);
    setRecording(false);
  };

  // Группировка по датам
  const groupedMessages = messages.reduce<{ date: string; msgs: GroupMessage[] }[]>((acc, msg) => {
    const d = new Date(msg.created_at * 1000).toLocaleDateString("ru", { day: "numeric", month: "long" });
    const last = acc[acc.length - 1];
    if (!last || last.date !== d) acc.push({ date: d, msgs: [msg] });
    else last.msgs.push(msg);
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 glass-strong border-b border-white/5 flex-shrink-0"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-white/8 md:hidden">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <button onClick={() => setShowInfo(true)} className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition">
          {group.avatar_url ? (
            <img
              src={group.avatar_url}
              className="w-10 h-10 rounded-2xl object-cover flex-shrink-0 active:scale-95 transition-transform"
              onClick={(e) => { e.stopPropagation(); setAvatarOpen(true); }}
            />
          ) : (
            <div className="w-10 h-10 rounded-2xl grad-primary flex items-center justify-center flex-shrink-0">
              <Icon name={group.is_channel ? "Radio" : "Users"} size={18} className="text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate flex items-center gap-1.5">
              {group.is_channel && <Icon name="Radio" size={12} className="text-sky-400 flex-shrink-0" />}
              <span className="truncate">{group.name}</span>
              {isMuted && <Icon name="BellOff" size={12} className="text-muted-foreground flex-shrink-0" />}
            </div>
            <div className="text-xs text-muted-foreground">
              {group.members_count ?? members.length} {(group.members_count ?? members.length) === 1 ? "участник" : "участников"}
            </div>
          </div>
        </button>
        <button onClick={() => setShowInfo(true)} className="p-2 rounded-xl hover:bg-white/8 text-muted-foreground">
          <Icon name="Info" size={18} />
        </button>
      </div>

      {/* Pinned message */}
      {pinned && (
        <div className="px-3 py-2 glass-strong border-b border-white/5 flex items-center gap-2 flex-shrink-0">
          <Icon name="Pin" size={14} className="text-violet-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-violet-400 font-bold">Закреплено</div>
            <div className="text-xs truncate">
              {pinned.sender_name && <span className="font-semibold mr-1">{pinned.sender_name}:</span>}
              {pinned.text || (pinned.media_type ? `[${pinned.media_type}]` : "Сообщение")}
            </div>
          </div>
          {isAdminHere && (
            <button onClick={unpinMessage} className="p-1.5 rounded-lg hover:bg-white/8 flex-shrink-0">
              <Icon name="X" size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {groupedMessages.map(({ date, msgs }) => (
          <div key={date}>
            <div className="flex justify-center my-3">
              <span className="text-[11px] text-muted-foreground bg-white/5 px-3 py-1 rounded-full">{date}</span>
            </div>
            {msgs.map((msg, i) => {
              const showAvatar = !msg.out && (i === 0 || msgs[i - 1]?.sender_id !== msg.sender_id);
              const showName = !msg.out && showAvatar;
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 mb-0.5 ${msg.out ? "flex-row-reverse" : "flex-row"}`}
                  onContextMenu={e => { e.preventDefault(); setCtxMenu({ msgId: msg.id, out: msg.out }); }}
                  onMouseDown={() => { holdTimer.current = setTimeout(() => setCtxMenu({ msgId: msg.id, out: msg.out }), 500); }}
                  onMouseUp={() => { if (holdTimer.current) clearTimeout(holdTimer.current); }}
                >
                  {/* Avatar (incoming) */}
                  {!msg.out && (
                    <div className="w-7 flex-shrink-0 self-end mb-1">
                      {showAvatar
                        ? <Avatar label={msg.sender_name?.[0]?.toUpperCase() || "?"} id={msg.sender_id} src={msg.sender_avatar} size="sm" />
                        : <div className="w-7" />}
                    </div>
                  )}

                  <div className={`max-w-[78%] flex flex-col ${msg.out ? "items-end" : "items-start"}`}>
                    {showName && (
                      <span className="text-[11px] font-semibold text-violet-400 px-1 mb-0.5">{msg.sender_name}</span>
                    )}

                    {msg.media_type ? (
                      <MediaMessage
                        message={{ id: msg.id, text: msg.text, time: msg.time || "", out: msg.out,
                          media_type: msg.media_type as "image"|"video"|"audio"|"file",
                          media_url: msg.media_url || undefined, file_name: msg.file_name || undefined,
                          file_size: msg.file_size || undefined, duration: msg.duration || undefined }}
                        out={msg.out}
                      />
                    ) : (
                      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        msg.out ? "msg-bubble-out text-white rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                      }`}>
                        {msg.reply_to_id && (
                          <div className={`text-[11px] mb-1 pb-1 border-b ${msg.out ? "border-white/20 text-white/70" : "border-white/10 text-muted-foreground"}`}>
                            <Icon name="Reply" size={11} className="inline mr-1" />
                            Ответ
                          </div>
                        )}
                        <LinkifiedText text={msg.text} />
                        <div className={`text-[10px] mt-1 text-right ${msg.out ? "text-white/60" : "text-muted-foreground"}`}>
                          {msg.time}
                          {msg.edited_at && <span className="ml-1 opacity-70">ред.</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="w-16 h-16 grad-primary rounded-3xl flex items-center justify-center mb-4">
              <Icon name={group.is_channel ? "Radio" : "Users"} size={28} className="text-white" />
            </div>
            <p className="font-semibold mb-1">
              {group.is_channel ? "Канал создан" : "Группа создана"}
            </p>
            <p className="text-sm text-muted-foreground">Напиши первое сообщение</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setCtxMenu(null)}>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 glass-strong rounded-2xl overflow-hidden shadow-xl w-56" onClick={e => e.stopPropagation()}>
            <button onClick={() => { const m = messages.find(m => m.id === ctxMenu.msgId); if (m) setReplyTo(m); setCtxMenu(null); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 text-sm">
              <Icon name="Reply" size={16} className="text-muted-foreground" />Ответить
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      {canWrite ? (
        <div className="px-4 py-3 glass-strong border-t border-white/5 flex-shrink-0 relative"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
            className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = ""; }} />

          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 glass rounded-xl border-l-2 border-violet-400 animate-fade-in">
              <Icon name="Reply" size={14} className="text-violet-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-violet-400">{replyTo.sender_name}</div>
                <div className="text-xs text-muted-foreground truncate">{replyTo.text || "[медиа]"}</div>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1"><Icon name="X" size={14} /></button>
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
              <button onClick={() => { setShowAttach(false); setShowVideoCircle(true); }}
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
              <button onClick={stopRecording} className="ml-auto text-xs text-muted-foreground">Отмена</button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button onClick={() => setShowAttach(v => !v)}
              className={`p-2.5 rounded-xl transition ${showAttach ? "bg-violet-500/20 text-violet-400" : "hover:bg-white/8 text-muted-foreground"}`}>
              <Icon name={showAttach ? "X" : "Paperclip"} size={20} />
            </button>
            <div className="flex-1 flex items-end glass rounded-2xl px-4 py-2.5 gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={group.is_channel ? "Написать в канал..." : "Сообщение..."}
                rows={1}
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground resize-none max-h-32"
              />
              <div className="relative">
                <button onClick={() => setShowEmoji(v => !v)}
                  className={`transition ${showEmoji ? "text-violet-400" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon name="Smile" size={20} />
                </button>
                <EmojiStickerPicker open={showEmoji} onClose={() => setShowEmoji(false)}
                  onPick={e => setInput(v => v + e)} />
              </div>
            </div>
            {input.trim() ? (
              <button onClick={send} className="p-2.5 rounded-xl grad-primary text-white glow-primary">
                <Icon name="Send" size={20} />
              </button>
            ) : (
              <button
                onMouseDown={startRecording} onMouseUp={stopRecording}
                onTouchStart={startRecording} onTouchEnd={stopRecording}
                className={`p-2.5 rounded-xl ${recording ? "bg-red-500 text-white" : "glass text-muted-foreground hover:text-violet-400"}`}>
                <Icon name="Mic" size={20} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 border-t border-white/5 text-center text-sm text-muted-foreground"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          <Icon name="Radio" size={16} className="inline mr-2 text-sky-400" />
          Канал: только администраторы могут писать
        </div>
      )}

      {/* Video circle */}
      <VideoCircleRecorder open={showVideoCircle} onClose={() => setShowVideoCircle(false)}
        onRecorded={file => sendFile(file)} />

      {/* Avatar fullscreen viewer */}
      {avatarOpen && group.avatar_url && (
        <MediaViewer items={[{ url: group.avatar_url, type: "image" }]} onClose={() => setAvatarOpen(false)} />
      )}

      {/* Group Profile Panel */}
      {showInfo && (
        <GroupProfilePanel
          group={group}
          members={members}
          currentUser={currentUser}
          myRole={myRole}
          onClose={() => setShowInfo(false)}
          onGroupUpdated={g => { onGroupUpdated?.(g); }}
          onGroupDeleted={() => { onGroupDeleted?.(); }}
          onMembersChanged={() => {
            api("get_group_members", { group_id: group.id }, currentUser.id).then(d => {
              if (d.members) setMembers(d.members.filter((m: GroupMember) => m.role !== "removed"));
            });
          }}
        />
      )}
    </div>
  );
}

export default GroupChatWindow;