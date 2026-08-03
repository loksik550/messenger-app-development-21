import { useCallback, useEffect, useRef, useState } from "react";
import { api, uploadMedia, type User, type Group, type GroupMessage, type GroupMember } from "@/lib/api";
import VideoCircleRecorder from "@/components/messenger/VideoCircleRecorder";
import GroupProfilePanel from "@/components/messenger/GroupProfilePanel";
import { MediaViewer } from "@/components/messenger/MediaViewer";
import GroupContextMenu from "@/components/messenger/GroupContextMenu";
import ForwardGroupDialog from "@/components/messenger/ForwardGroupDialog";
import GroupChatHeader from "@/components/messenger/group-chat/GroupChatHeader";
import GroupChatMessages from "@/components/messenger/group-chat/GroupChatMessages";
import GroupChatInput from "@/components/messenger/group-chat/GroupChatInput";
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
      <GroupChatHeader
        group={group}
        membersLength={members.length}
        isMuted={isMuted}
        showSearch={showSearch}
        searchQuery={searchQuery}
        searching={searching}
        searchResults={searchResults}
        onBack={onBack}
        onOpenInfo={() => setShowInfo(true)}
        onOpenAvatar={() => setAvatarOpen(true)}
        onOpenSearch={() => { setShowSearch(true); setSearchQuery(""); setSearchResults([]); }}
        onCloseSearch={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}
        onSearch={runSearch}
      />

      <GroupChatMessages
        group={group}
        currentUser={currentUser}
        messages={messages}
        groupedMessages={groupedMessages}
        pinned={pinned}
        isAdminHere={isAdminHere}
        scrollRef={scrollRef}
        endRef={endRef}
        holdTimer={holdTimer}
        onUnpin={unpinMessage}
        onOpenContext={setCtxMenu}
        onReact={reactToMessage}
      />

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

      <GroupChatInput
        group={group}
        canWrite={canWrite}
        input={input}
        replyTo={replyTo}
        editing={editing}
        showAttach={showAttach}
        showEmoji={showEmoji}
        recording={recording}
        recordSec={recordSec}
        mentionCandidates={mentionCandidates}
        fileInputRef={fileInputRef}
        onInputChange={setInput}
        onSend={send}
        onSendFile={(f) => sendFile(f)}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => { setEditing(null); setInput(""); }}
        onToggleAttach={() => setShowAttach(v => !v)}
        onCloseAttach={() => setShowAttach(false)}
        onOpenVideoCircle={() => setShowVideoCircle(true)}
        onToggleEmoji={() => setShowEmoji(v => !v)}
        onCloseEmoji={() => setShowEmoji(false)}
        onPickEmoji={(e) => setInput(v => v + e)}
        onApplyMention={applyMention}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onCancelRecording={cancelRecording}
      />

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
