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
import GroupContextMenu from "@/components/messenger/GroupContextMenu";
import ForwardGroupDialog from "@/components/messenger/ForwardGroupDialog";
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
  const [editing, setEditing] = useState<GroupMessage | null>(null);
  const [forwardMsg, setForwardMsg] = useState<GroupMessage | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ msgId: number; out: boolean } | null>(null);
  const [pinned, setPinned] = useState<{ id: number; text: string; sender_name: string; media_type?: string } | null>(null);
  const [onlyAdminsPost, setOnlyAdminsPost] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: number; sender_name: string; text: string; created_at: number }[]>([]);
  const [searching, setSearching] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordSecRef = useRef(0);
  const recordCancelledRef = useRef(false);
  const recStartingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
      const mr = mediaRecorder.current;
      if (mr && mr.state === "recording") {
        try { mr.stream?.getTracks().forEach(t => t.stop()); mr.stop(); } catch { /* noop */ }
      }
    };
  }, []);

  const toTime = (ts: number) => new Date(ts * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });

  const loadMessages = useCallback(async (since = 0): Promise<boolean> => {
    const d = await api("get_group_messages", { group_id: group.id, since }, currentUser.id);
    if (!d.messages) return false;
    const msgs: GroupMessage[] = d.messages.map((m: GroupMessage) => ({ ...m, time: toTime(m.created_at) }));
    let changed = false;
    if (since === 0) {
      setMessages(msgs);
      if (msgs.length) setLastSince(msgs[msgs.length - 1].created_at);
    } else if (msgs.length) {
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        // Обновляем статус прочтения у уже загруженных сообщений (галочки)
        const readMap = new Map(msgs.map(m => [m.id, m.read]));
        const merged = prev.map(m => readMap.has(m.id) ? { ...m, read: readMap.get(m.id) } : m);
        return [...merged, ...msgs.filter(m => !ids.has(m.id))];
      });
      setLastSince(msgs[msgs.length - 1].created_at);
      changed = true;
    }
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
  const pollCountRef = useRef(0);

  useAdaptivePoll(() => {
    // Каждый 4-й опрос делаем полную перезагрузку — чтобы обновлялись галочки прочтения
    pollCountRef.current += 1;
    const full = pollCountRef.current % 4 === 0;
    return loadMessages(full ? 0 : lastSinceRef.current);
  }, [group.id, loadMessages], POLL_MS, 10000);

  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (messages.length === 0) return;
    endRef.current?.scrollIntoView({ behavior: didInitialScroll.current ? "smooth" : "auto" });
    didInitialScroll.current = true;
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    // Режим редактирования
    if (editing) {
      const editId = editing.id;
      const r = await api("edit_group_message", { message_id: editId, text }, currentUser.id);
      if (r?.error) { alert(r.error); return; }
      setInput("");
      setEditing(null);
      setMessages(prev => prev.map(m => m.id === editId ? { ...m, text, edited_at: r.edited_at } : m));
      return;
    }
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

  const reactToMessage = async (msgId: number, emoji: string) => {
    setCtxMenu(null);
    const snapshot = messages;
    // Оптимистично обновляем UI: одна реакция от пользователя (toggle)
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const had = (m.reactions || []).some(r => r.user_id === currentUser.id && r.emoji === emoji);
      const others = (m.reactions || []).filter(r => r.user_id !== currentUser.id);
      return { ...m, reactions: had ? others : [...others, { emoji, user_id: currentUser.id, user_name: currentUser.name }] };
    }));
    const r = await api("add_group_reaction", { message_id: msgId, emoji }, currentUser.id);
    if (r?.error) { alert(r.error); setMessages(snapshot); }
  };

  const deleteMessage = async (msgId: number) => {
    setCtxMenu(null);
    const r = await api("delete_group_message", { message_id: msgId }, currentUser.id);
    if (r?.error) { alert(r.error); return; }
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const startEdit = (msgId: number) => {
    setCtxMenu(null);
    const m = messages.find(x => x.id === msgId);
    if (m) { setEditing(m); setReplyTo(null); setInput(m.text); }
  };

  const forwardMessage = (msgId: number) => {
    setCtxMenu(null);
    const m = messages.find(x => x.id === msgId);
    if (m) setForwardMsg(m);
  };

  const runSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const r = await api("search_group_messages", { group_id: group.id, query: q.trim() }, currentUser.id);
    setSearching(false);
    setSearchResults(r?.results || []);
  };

  // ── Упоминания @имя ──
  const mentionMatch = input.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = mentionMatch ? mentionMatch[1].toLowerCase() : null;
  const mentionCandidates = mentionQuery !== null
    ? members
        .filter(m => m.id !== currentUser.id && m.role !== "removed" && m.name.toLowerCase().includes(mentionQuery))
        .slice(0, 6)
    : [];

  const applyMention = (name: string) => {
    const cleanName = name.replace(/\s+/g, "_");
    setInput(prev => prev.replace(/(^|\s)@([^\s@]*)$/, (_m, p1) => `${p1}@${cleanName} `));
  };

  const sendFile = async (file: File, opts?: { duration?: number; mediaTypeOverride?: string }) => {
    const isVideo = opts?.mediaTypeOverride === "video";
    const MAX_FILE_MB = isVideo ? 4 : 4.5;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      alert(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум ${MAX_FILE_MB} МБ. Сожми файл или запиши короче.`);
      return;
    }
    setUploading(true); setShowAttach(false);
    try {
      const result = await uploadMedia(file, currentUser.id);
      const mediaType = opts?.mediaTypeOverride || result.media_type;
      const d = await api("send_group_message", {
        group_id: group.id, media_type: mediaType, media_url: result.url,
        file_name: result.file_name, file_size: result.file_size,
        duration: opts?.duration,
      }, currentUser.id);
      if (d.id) {
        setMessages(prev => [...prev, {
          id: d.id, sender_id: currentUser.id, sender_name: currentUser.name,
          sender_avatar: currentUser.avatar_url, text: "", created_at: d.created_at,
          time: toTime(d.created_at), out: true, kind: "text",
          media_type: mediaType, media_url: result.url,
          file_name: result.file_name, file_size: result.file_size,
          duration: opts?.duration,
        }]);
        setLastSince(d.created_at);
      }
    } catch (uploadErr) {
      console.error(uploadErr);
      alert("Не удалось отправить файл. Попробуй ещё раз или выбери файл меньшего размера.");
    } finally { setUploading(false); }
  };

  const startRecording = async () => {
    if (recStartingRef.current || recording) return;
    recStartingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const isApple = /iphone|ipad|ipod|mac/i.test(navigator.userAgent);
      const candidates = isApple
        ? ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", ""]
        : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/ogg;codecs=opus", ""];
      let mime = "";
      for (const c of candidates) {
        if (!c) { mime = ""; break; }
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) {
          mime = c; break;
        }
      }
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorder.current = mr; audioChunks.current = []; recordCancelledRef.current = false;
      mr.ondataavailable = e => { if (e.data && e.data.size > 0) audioChunks.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
        setRecording(false);
        if (recordCancelledRef.current) return;
        const realType = mr.mimeType || mime || "audio/webm";
        const ext = realType.includes("mp4") ? "m4a" : realType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(audioChunks.current, { type: realType });
        if (blob.size < 500 || recordSecRef.current < 1) return; // слишком короткая запись — не отправляем
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: realType });
        await sendFile(file, { duration: recordSecRef.current, mediaTypeOverride: "audio" });
      };
      mr.start();
      setRecording(true); setRecordSec(0); recordSecRef.current = 0;
      if (recordTimer.current) clearInterval(recordTimer.current);
      recordTimer.current = setInterval(() => setRecordSec(s => {
        const next = s + 1; recordSecRef.current = next;
        if (next >= 300) {
          if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
            try { mediaRecorder.current.stop(); } catch { /* ignore */ }
          }
          return 300;
        }
        return next;
      }), 1000);
    } catch (e) {
      const name = (e as DOMException).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        alert("Доступ к микрофону запрещён. Разреши его в настройках браузера.");
      } else {
        alert("Нет доступа к микрофону");
      }
    } finally {
      recStartingRef.current = false;
    }
  };

  const stopRecording = () => {
    recordCancelledRef.current = false;
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      try { mediaRecorder.current.stop(); } catch { /* ignore */ }
    } else {
      if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
      setRecording(false);
    }
  };

  const cancelRecording = () => {
    recordCancelledRef.current = true;
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      try { mediaRecorder.current.stop(); } catch { /* ignore */ }
    } else {
      if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
      setRecording(false);
    }
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
    <div className="flex flex-col h-full min-h-0 relative">
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
        <button onClick={() => { setShowSearch(true); setSearchQuery(""); setSearchResults([]); }} className="p-2 rounded-xl hover:bg-white/8 text-muted-foreground">
          <Icon name="Search" size={18} />
        </button>
        <button onClick={() => setShowInfo(true)} className="p-2 rounded-xl hover:bg-white/8 text-muted-foreground">
          <Icon name="Info" size={18} />
        </button>
      </div>

      {/* Search overlay */}
      {showSearch && (
        <div className="absolute inset-0 z-[90] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-2 glass-strong border-b border-white/5 flex-shrink-0"
            style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
            <button onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }} className="p-2 rounded-xl hover:bg-white/8">
              <Icon name="ChevronLeft" size={20} />
            </button>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
              <Icon name="Search" size={16} className="text-muted-foreground" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => runSearch(e.target.value)}
                placeholder="Поиск по сообщениям"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button onClick={() => runSearch("")} className="text-muted-foreground hover:text-foreground">
                  <Icon name="X" size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {searching && <div className="text-center text-sm text-muted-foreground py-6">Поиск...</div>}
            {!searching && searchQuery.trim() && searchResults.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-6">Ничего не найдено</div>
            )}
            {searchResults.map(r => (
              <div key={r.id} className="px-3 py-2.5 rounded-xl hover:bg-white/5 transition">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-semibold text-violet-400">{r.sender_name}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(r.created_at * 1000).toLocaleDateString("ru", { day: "numeric", month: "short" })}</span>
                </div>
                <div className="text-sm text-foreground line-clamp-2">{r.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1 relative">
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
                        msg={{ id: msg.id, text: msg.text, time: msg.time || "", out: msg.out,
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
                        <LinkifiedText text={msg.text} out={msg.out} mentions />
                        <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-0.5 ${msg.out ? "text-white/60" : "text-muted-foreground"}`}>
                          {msg.edited_at && <span className="opacity-70">ред.</span>}
                          <span>{msg.time}</span>
                          {msg.out && (
                            <Icon name={msg.read ? "CheckCheck" : "Check"} size={12} className={msg.read ? "text-sky-300" : "text-white/60"} />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${msg.out ? "justify-end" : "justify-start"}`}>
                        {Object.entries(
                          msg.reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
                            const cur = acc[r.emoji] || { count: 0, mine: false };
                            cur.count += 1;
                            if (r.user_id === currentUser.id) cur.mine = true;
                            acc[r.emoji] = cur;
                            return acc;
                          }, {})
                        ).map(([emoji, info]) => (
                          <button
                            key={emoji}
                            onClick={() => reactToMessage(msg.id, emoji)}
                            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs transition ${
                              info.mine ? "bg-violet-500/30 border border-violet-400/50" : "bg-white/8 border border-transparent hover:bg-white/12"
                            }`}
                          >
                            <span>{emoji}</span>
                            {info.count > 1 && <span className="text-[10px] text-muted-foreground">{info.count}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {messages.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
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
        <GroupContextMenu
          ctxMenu={ctxMenu}
          messages={messages}
          canModerate={isAdminHere}
          isPinned={pinned?.id === ctxMenu.msgId}
          onClose={() => setCtxMenu(null)}
          onReact={reactToMessage}
          onReply={(id) => { const m = messages.find(m => m.id === id); if (m) { setReplyTo(m); setEditing(null); } setCtxMenu(null); }}
          onForward={forwardMessage}
          onEdit={startEdit}
          onPin={(id) => { if (pinned?.id === id) unpinMessage(); else pinMessage(id); }}
          onDelete={deleteMessage}
        />
      )}

      {/* Forward dialog */}
      {forwardMsg && (
        <ForwardGroupDialog
          message={forwardMsg}
          currentUser={currentUser}
          onClose={() => setForwardMsg(null)}
        />
      )}

      {/* Input */}
      {canWrite ? (
        <div className="px-4 py-3 glass-strong border-t border-white/5 flex-shrink-0 relative"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
            className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = ""; }} />

          {replyTo && !editing && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 glass rounded-xl border-l-2 border-violet-400 animate-fade-in">
              <Icon name="Reply" size={14} className="text-violet-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-violet-400">{replyTo.sender_name}</div>
                <div className="text-xs text-muted-foreground truncate">{replyTo.text || "[медиа]"}</div>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1"><Icon name="X" size={14} /></button>
            </div>
          )}

          {editing && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 glass rounded-xl border-l-2 border-amber-400 animate-fade-in">
              <Icon name="Pencil" size={14} className="text-amber-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-amber-400">Редактирование</div>
                <div className="text-xs text-muted-foreground truncate">{editing.text || "[медиа]"}</div>
              </div>
              <button onClick={() => { setEditing(null); setInput(""); }} className="p-1"><Icon name="X" size={14} /></button>
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
              <button onClick={cancelRecording} className="ml-auto text-xs text-muted-foreground">Отмена</button>
            </div>
          )}

          {mentionCandidates.length > 0 && (
            <div className="mb-2 glass rounded-xl overflow-hidden max-h-44 overflow-y-auto animate-fade-in">
              {mentionCandidates.map(m => (
                <button
                  key={m.id}
                  onClick={() => applyMention(m.name)}
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
                onPointerDown={(e) => { e.preventDefault(); startRecording(); }}
                onPointerUp={(e) => { e.preventDefault(); stopRecording(); }}
                onPointerLeave={() => { if (recording) stopRecording(); }}
                onContextMenu={(e) => e.preventDefault()}
                className={`p-2.5 rounded-xl select-none touch-none ${recording ? "bg-red-500 text-white" : "glass text-muted-foreground hover:text-violet-400"}`}>
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
          onHistoryCleared={() => {
            setMessages([]);
            setLastSince(Math.floor(Date.now() / 1000));
            didInitialScroll.current = false;
          }}
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