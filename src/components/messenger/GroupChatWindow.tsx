import { useCallback, useEffect, useRef, useState } from "react";
import { useDraft } from "@/lib/drafts";
import { track } from "@/lib/track";
import { enqueue, getPending, subscribeOutbox, flush as flushOutbox, retry as retryOutbox, removeFromOutbox, type OutboxItem } from "@/lib/outbox";
import { api, type User, type Group, type GroupMessage, type GroupMember } from "@/lib/api";
import VideoCircleRecorder from "@/components/messenger/VideoCircleRecorder";
import GroupProfilePanel from "@/components/messenger/GroupProfilePanel";
import { MediaViewer } from "@/components/messenger/MediaViewer";
import GroupContextMenu from "@/components/messenger/GroupContextMenu";
import ForwardGroupDialog from "@/components/messenger/ForwardGroupDialog";
import GroupChatHeader from "@/components/messenger/group-chat/GroupChatHeader";
import GroupChatMessages from "@/components/messenger/group-chat/GroupChatMessages";
import GroupChatInput from "@/components/messenger/group-chat/GroupChatInput";
import { useAdaptivePoll } from "@/hooks/useAdaptivePoll";
import { useGroupMedia } from "@/components/messenger/useGroupMedia";

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
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showVideoCircle, setShowVideoCircle] = useState(false);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [editing, setEditing] = useState<GroupMessage | null>(null);
  useDraft(`g${group.id}`, input, setInput, !!editing);
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
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    };
  }, []);

  const pendingGroupMsgRef = useRef<(i: OutboxItem) => GroupMessage>(() => ({} as GroupMessage));
  const toTime = (ts: number) => new Date(ts * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });

  const loadMessages = useCallback(async (since = 0): Promise<boolean> => {
    const d = await api("get_group_messages", { group_id: group.id, since }, currentUser.id);
    if (!d.messages) return false;
    const msgs: GroupMessage[] = d.messages.map((m: GroupMessage) => ({ ...m, time: toTime(m.created_at) }));
    let changed = false;
    if (since === 0) {
      const pendingIds = new Set(msgs.map(m => m.id));
      setMessages([...msgs, ...getPending(group.id, "group").map(pendingGroupMsgRef.current).filter(m => !pendingIds.has(m.id))]);
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
    const item = enqueue({ chatId: group.id, kind: "group", userId: currentUser.id, text, replyToId: replyId });
    track(navigator.onLine ? "msg_group" : "msg_offline");
    setMessages(prev => prev.some(m => m.id === item.localId) ? prev : [...prev, pendingGroupMsg(item)]);
  };

  const pendingGroupMsg = (i: OutboxItem): GroupMessage => ({
    id: i.localId, sender_id: currentUser.id, sender_name: currentUser.name,
    sender_avatar: currentUser.avatar_url, text: i.text, created_at: i.createdAt,
    time: toTime(i.createdAt), out: true, kind: "text", reply_to_id: i.replyToId ?? null,
    pending: !i.failed, failed: !!i.failed,
  });

  useEffect(() => {
    return subscribeOutbox(e => {
      if (e.type === "sent") {
        if (e.item.chatId !== group.id || e.item.kind !== "group") return;
        setMessages(prev => {
          if (prev.some(m => m.id === e.item.id)) return prev.filter(m => m.id !== e.item.localId);
          return prev.map(m => m.id === e.item.localId
            ? { ...m, id: e.item.id, created_at: e.item.created_at, time: toTime(e.item.created_at), pending: false, failed: false }
            : m);
        });
        return;
      }
      const pend = new Map(getPending(group.id, "group").map(i => [i.localId, i]));
      setMessages(prev => {
        let changed = false;
        const next = prev.map(m => {
          const p = pend.get(m.id);
          if (!p) return m;
          pend.delete(m.id);
          if (m.failed === !!p.failed && m.pending === !p.failed) return m;
          changed = true;
          return { ...m, pending: !p.failed, failed: !!p.failed };
        });
        if (pend.size) { changed = true; next.push(...Array.from(pend.values()).map(pendingGroupMsg)); }
        return changed ? next : prev;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  pendingGroupMsgRef.current = pendingGroupMsg;
  useEffect(() => { flushOutbox(); }, [group.id]);

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

  const { recording, recordSec, sendFile, startRecording, stopRecording, cancelRecording } =
    useGroupMedia({ group, currentUser, setMessages, setLastSince, setShowAttach, toTime });

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
        onRetry={(id) => { setMessages(prev => prev.map(m => m.id === id ? { ...m, failed: false, pending: true } : m)); retryOutbox(id); }}
        onDiscard={(id) => { removeFromOutbox(id); setMessages(prev => prev.filter(m => m.id !== id)); }}
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
