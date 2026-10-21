import Icon from "@/components/ui/icon";
import E2EPanel, { E2EBadge, useChatSecurity } from "@/components/messenger/E2EPanel";
import { useState, useRef, useEffect } from "react";
import { api, type Chat, type Message, type User } from "@/lib/api";
import { ChatHeader, ChatInput } from "@/components/messenger/ChatWindowParts";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import StickerPicker from "@/components/messenger/StickerPicker";
import PartnerProfilePanel from "@/components/messenger/PartnerProfilePanel";
import MessageList from "@/components/messenger/MessageList";
import { TYPING_THROTTLE_MS } from "@/components/messenger/chatConstants";
import { useChatMessages } from "@/components/messenger/useChatMessages";
import { useChatSettings } from "@/components/messenger/useChatSettings";
import { useChatActions, type ConfirmState } from "@/components/messenger/useChatActions";
import { enqueue, retry as retryOutbox, removeFromOutbox } from "@/lib/outbox";
import { track } from "@/lib/track";
import { useDraft } from "@/lib/drafts";
import { useChatMedia } from "@/components/messenger/useChatMedia";
import { useChatScroll } from "@/components/messenger/useChatScroll";
import { useMessageActions } from "@/components/messenger/useMessageActions";
import {
  ConfirmDialog, EncryptionBadge, UnknownContactHint, PinnedBar, ScrollDownButton,
} from "@/components/messenger/ChatOverlays";
import { ChatModals } from "@/components/messenger/ChatModals";
import { MediaActionsContext, type MediaMessageActions } from "@/components/messenger/MediaActionsContext";
import SelectionBar from "@/components/messenger/SelectionBar";
import MessageActionSheet from "@/components/messenger/MessageActionSheet";

// Re-export atoms so existing imports from ChatComponents still work
export { Avatar, TypingIndicator, ChatList } from "@/components/messenger/ChatAtoms";

// ─── ChatWindow ───────────────────────────────────────────────────────────────

export function ChatWindow({
  chat, onBack, currentUser, onCall, onVideoCall, onChatUpdated, onChatDeleted,
  onOpenFundraiser, onUserUpdate, onOpenStickersStore,
}: {
  chat: Chat;
  onBack: () => void;
  currentUser: User;
  onCall?: (partnerId: number, name: string) => void;
  onVideoCall?: (partnerId: number, name: string) => void;
  onChatUpdated?: (chat: Chat) => void;
  onChatDeleted?: () => void;
  onOpenFundraiser?: (id: number) => void;
  onUserUpdate?: (u: User) => void;
  onOpenStickersStore?: () => void;
}) {
  useEdgeSwipeBack(onBack);
  const { messages, setMessages, isTyping, setLastSince, hasMore, loadingOlder, loadOlder } = useChatMessages(chat, currentUser);
  const [input, setInput] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  useDraft(`c${chat.id}`, input, setInput, !!editing);
  const [forwardMsgId, setForwardMsgId] = useState<number | null>(null);
  const { messagesScrollRef, endRef, showScrollDown, newCount, handleMessagesScroll, scrollToBottom } = useChatScroll({ messages, isTyping, chatKey: chat.id });
  const [, setShowReactionPicker] = useState<number | null>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showDisappearing, setShowDisappearing] = useState(false);
  const [showE2E, setShowE2E] = useState(false);
  const e2eSec = useChatSecurity(chat.id, currentUser.id, !chat.saved && !chat.group && chat.id > 0);
  const {
    pinnedMsg, setPinnedMsg,
    isUnknown, setIsUnknown, unknownDismissed, setUnknownDismissed, addToContacts,
    disappearingSec, setDisappearingSec,
    scheduled, reloadScheduled,
    wallpaper, setWallpaper,
  } = useChatSettings(chat, currentUser, setLastSince);
  const [showVideoCircle, setShowVideoCircle] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showScheduledList, setShowScheduledList] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);

  const {
    uploading, uploadLabel, recording, recordSec,
    mediaRecorder, recordTimer,
    sendFile, sendFiles, startRecording, stopRecording, cancelRecording,
  } = useChatMedia({ chat, currentUser, setMessages, setLastSince, setShowAttach });

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ msgId: number; out: boolean } | null>(null);
  const [heartBurst, setHeartBurst] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
      if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
      const mr = mediaRecorder.current;
      if (mr && mr.state === "recording") {
        try { mr.stream?.getTracks().forEach(t => t.stop()); mr.stop(); } catch { /* noop */ }
      }
    };
  }, []);

  const notifyTyping = () => {
    // Не чаще одного запроса в 3 секунды
    if (typingTimerRef.current) return;
    api("set_typing", { chat_id: chat.id }, currentUser.id);
    typingTimerRef.current = setTimeout(() => { typingTimerRef.current = null; }, TYPING_THROTTLE_MS);
  };

  const sendingRef = useRef(false);
  const send = async () => {
    // Защита от двойного вызова (Android: keydown+click, ghost-tap, IME-коммит)
    if (sendingRef.current) return;
    if (!input.trim()) return;
    sendingRef.current = true;
    const text = input.trim();
    setInput("");

    try {
      // edit-режим
      if (editing) {
        const editId = editing.id;
        setEditing(null);
        const er = await api("edit_message", { message_id: editId, chat_id: chat.id, text }, currentUser.id);
        if (er?.error) { alert(er.error); return; }
        setMessages(prev => prev.map(m => m.id === editId ? { ...m, text, edited_at: Math.floor(Date.now() / 1000) } : m));
        return;
      }

      const replyId = replyTo?.id;
      const replyPreview = replyTo ? { id: replyTo.id, sender_name: replyTo.sender_name || (replyTo.out ? "Вы" : chat.name), text: replyTo.text, media_type: replyTo.media_type } : null;
      setReplyTo(null);

      const item = enqueue({ chatId: chat.id, userId: currentUser.id, text, replyToId: replyId });
      track(navigator.onLine ? "msg_text" : "msg_offline");
      const timeStr = new Date(item.createdAt * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
      setMessages(prev => prev.some(m => m.id === item.localId) ? prev : [...prev, { id: item.localId, text, time: timeStr, out: true, created_at: item.createdAt, reactions: [], reply_to: replyPreview, pending: true }]);
    } finally {
      // небольшой кулдаун, чтобы успел отработать second tap/keydown
      setTimeout(() => { sendingRef.current = false; }, 250);
    }
  };

  const {
    handleToggleMute, handleTogglePin, handleToggleFavorite,
    handleClearHistory, handleBlock, handleToggleArchive,
  } = useChatActions({ chat, currentUser, onBack, onChatUpdated, onChatDeleted, setConfirm, setMessages, setLastSince });

  const {
    highlightId, favToast,
    startHold, cancelHold, addReaction,
    handleReply, handleEdit, handleForward, handlePinToggle, scrollToMessage, handleFavorite,
  } = useMessageActions({
    chat, currentUser, messages, setMessages, setLastSince, setConfirm, setCtxMenu, setShowReactionPicker,
    setReplyTo, setEditing, setInput, setForwardMsgId, pinnedMsg, setPinnedMsg,
  });

  const mediaActions: MediaMessageActions = {
    canDelete: (id) => !!messages.find(m => m.id === id)?.out,
    canPin: true,
    isPinned: (id) => pinnedMsg?.id === id,
    showInChat: (id) => setTimeout(() => scrollToMessage(id), 250),
    reply: (id) => handleReply(id),
    togglePin: (id) => handlePinToggle(id),
    deleteNow: async (id) => {
      const r = await api("delete_message", { message_id: id }, currentUser.id);
      if (r?.error) throw new Error(r.error);
      setMessages(prev => prev.filter(m => m.id !== id));
    },
    react: (id, emoji) => addReaction(id, emoji),
    select: (id) => setSelectedIds(new Set([id])),
  };

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev || []);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next.size ? next : null;
  });

  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => (m.text || "").toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : messages;

  return (
    <MediaActionsContext.Provider value={mediaActions}>
    <div className="flex flex-col h-full animate-fade-in relative">
      {selectedIds && (
        <SelectionBar
          selected={selectedIds}
          messages={messages}
          source="chat"
          canDelete={(id) => !!messages.find(m => m.id === id)?.out}
          onDelete={async (ids) => {
            setMessages(prev => prev.filter(m => !ids.includes(m.id)));
            const res = await Promise.all(ids.map(id => api("delete_message", { message_id: id }, currentUser.id).catch(() => ({ error: "x" }))));
            if (res.some(r => r?.error)) setLastSince(0);
          }}
          onClear={() => setSelectedIds(null)}
        />
      )}
      <ChatHeader
        chat={chat}
        onBack={onBack}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        onOpenProfile={chat.group ? undefined : () => setShowProfile(true)}
        onCall={onCall}
        onVideoCall={onVideoCall}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        onToggleMute={handleToggleMute}
        onTogglePin={handleTogglePin}
        onToggleFavorite={handleToggleFavorite}
        onClearHistory={handleClearHistory}
        onBlock={handleBlock}
        onToggleArchive={handleToggleArchive}
        onSetDisappearing={() => setShowDisappearing(true)}
        disappearingSeconds={disappearingSec}
        onChooseWallpaper={() => setShowWallpaper(true)}
        e2eSlot={<E2EBadge sec={e2eSec} onClick={() => setShowE2E(true)} />}
      />

      {showE2E && (
        <E2EPanel chatId={chat.id} userId={currentUser.id} partnerName={chat.name} sec={e2eSec} onClose={() => setShowE2E(false)} />
      )}

      {showProfile && !chat.group && !chat.saved && (
        <PartnerProfilePanel
          chat={chat}
          currentUserId={currentUser.id}
          disappearingSeconds={disappearingSec}
          onClose={() => setShowProfile(false)}
          onCall={() => onCall && chat.partner_id && onCall(chat.partner_id, chat.name)}
          onVideoCall={() => onVideoCall && chat.partner_id && onVideoCall(chat.partner_id, chat.name)}
          onToggleMute={handleToggleMute}
          onTogglePin={handleTogglePin}
          onToggleFavorite={handleToggleFavorite}
          onToggleArchive={handleToggleArchive}
          onChooseWallpaper={() => setShowWallpaper(true)}
          onSetDisappearing={() => setShowDisappearing(true)}
          onSearch={() => setShowSearch(true)}
          onClearHistory={handleClearHistory}
          onBlock={handleBlock}
          isContact={!isUnknown}
          onDeleteContact={chat.partner_id ? async () => {
            await api("remove_contact", { contact_id: chat.partner_id }, currentUser.id);
            setIsUnknown(true);
            // Сообщаем списку контактов, что его пора обновить
            window.dispatchEvent(new CustomEvent("nova:contacts-changed"));
          } : undefined}
        />
      )}

      {confirm && (
        <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
      )}

      {/* Lock badge */}
      {!chat.saved && <EncryptionBadge />}

      {/* Подсказка о незнакомце */}
      {isUnknown && !unknownDismissed && chat.partner_id && !chat.saved && (
        <UnknownContactHint
          onAddToContacts={addToContacts}
          onBlock={async () => {
            await api("block_user", { target_user_id: chat.partner_id }, currentUser.id);
            onChatDeleted?.();
            onBack();
          }}
          onDismiss={() => setUnknownDismissed(true)}
        />
      )}

      {ctxMenu && (() => {
        const m = messages.find(x => x.id === ctxMenu.msgId);
        if (!m) return null;
        const close = () => { setCtxMenu(null); setShowReactionPicker(null); };
        const canEdit = m.out && (!m.media_type || m.media_type === "image") && !!m.text && !/^(📷|🎥|🎵|📎)/.test(m.text) && m.kind !== "sticker";
        return (
          <MessageActionSheet
            msg={m}
            actions={{
              canDelete: m.out,
              canPin: true,
              isPinned: pinnedMsg?.id === m.id,
              canEdit,
              onReact: (e) => addReaction(m.id, e),
              onReply: () => handleReply(m.id),
              onEdit: () => handleEdit(m.id),
              onPin: () => handlePinToggle(m.id),
              onDelete: async () => {
                close();
                setMessages(prev => prev.filter(x => x.id !== m.id));
                const r = await api("delete_message", { message_id: m.id }, currentUser.id).catch(() => ({ error: "net" }));
                if (r?.error) setLastSince(0);
              },
              onSelect: () => { close(); setSelectedIds(new Set([m.id])); },
              onForward: () => handleForward(m.id),
              onFavorite: chat.saved ? undefined : () => handleFavorite(m.id),
              onClose: close,
            }}
          />
        );
      })()}

      {favToast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[210] px-4 py-2 rounded-full glass-strong text-sm flex items-center gap-2 animate-fade-in pointer-events-none">
          <Icon name="Star" size={14} className="text-amber-400" /> {favToast}
        </div>
      )}

      {/* Pinned message bar */}
      {pinnedMsg && (
        <PinnedBar
          pinnedMsg={pinnedMsg}
          onScrollToMessage={scrollToMessage}
          onUnpin={handlePinToggle}
        />
      )}

      {/* Messages */}
      <MessageList
        messages={messages}
        filteredMessages={filteredMessages}
        chat={chat}
        currentUser={currentUser}
        wallpaper={wallpaper}
        isTyping={isTyping}
        highlightId={highlightId}
        heartBurst={heartBurst}
        messagesScrollRef={messagesScrollRef}
        endRef={endRef}
        onScroll={handleMessagesScroll}
        onBackgroundClick={() => { setShowMenu(false); setShowReactionPicker(null); }}
        onReply={handleReply}
        onScrollToMessage={scrollToMessage}
        onStartHold={(id, out) => { if (!selectedIds) startHold(id, out); }}
        onCancelHold={cancelHold}
        onAddReaction={addReaction}
        onCtxMenu={(c) => { if (c.msgId > 0 && !selectedIds) setCtxMenu(c); }}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onHeartBurst={(id) => setHeartBurst(id)}
        onOpenFundraiser={onOpenFundraiser}
        onRetry={(id) => { setMessages(prev => prev.map(m => m.id === id ? { ...m, failed: false, pending: true } : m)); retryOutbox(id); }}
        onDiscard={(id) => { removeFromOutbox(id); setMessages(prev => prev.filter(m => m.id !== id)); }}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        onLoadOlder={async () => {
          const el = messagesScrollRef.current;
          const prevH = el?.scrollHeight || 0;
          await loadOlder();
          requestAnimationFrame(() => { if (el) el.scrollTop += el.scrollHeight - prevH; });
        }}
      />

      {showScrollDown && (
        <ScrollDownButton newCount={newCount} onClick={scrollToBottom} />
      )}

      <ChatInput
        input={input}
        setInput={setInput}
        showAttach={showAttach}
        setShowAttach={setShowAttach}
        uploading={uploading}
        uploadLabel={uploadLabel}
        recording={recording}
        recordSec={recordSec}
        fileInputRef={fileInputRef}
        onSend={send}
        onNotifyTyping={notifyTyping}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onCancelRecording={cancelRecording}
        onFileChange={sendFile}
        onFilesChange={sendFiles}
        onVideoCircle={() => { setShowAttach(false); setShowVideoCircle(true); }}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editing={editing}
        onCancelEdit={() => { setEditing(null); setInput(""); }}
        onSendGift={() => { setShowAttach(false); setShowGiftModal(true); }}
        onAttachFundraiser={() => { setShowAttach(false); setShowFundModal(true); }}
        onOpenStickerPicker={() => { setShowAttach(false); setShowStickerPicker(p => !p); }}
        onSchedule={() => { setShowAttach(false); setShowSchedule(true); }}
        onShowScheduledList={() => setShowScheduledList(true)}
        scheduledCount={scheduled.length}
        stickerPickerSlot={showStickerPicker ? (
          <StickerPicker
            currentUser={currentUser}
            onClose={() => setShowStickerPicker(false)}
            onOpenStore={() => { setShowStickerPicker(false); onOpenStickersStore?.(); }}
            onPick={async (it) => {
              setShowStickerPicker(false);
              await api("send_message", {
                chat_id: chat.id,
                kind: "sticker",
                payload: it,
                text: "🎨 Стикер",
              }, currentUser.id);
              setLastSince(0);
            }}
          />
        ) : null}
      />

      <ChatModals
        forwardText={forwardMsgId !== null ? messages.find(m => m.id === forwardMsgId)?.text : undefined}
        chat={chat}
        currentUser={currentUser}
        input={input}
        setInput={setInput}
        showGiftModal={showGiftModal}
        setShowGiftModal={setShowGiftModal}
        showFundModal={showFundModal}
        setShowFundModal={setShowFundModal}
        showDisappearing={showDisappearing}
        setShowDisappearing={setShowDisappearing}
        setDisappearingSec={setDisappearingSec}
        disappearingSec={disappearingSec}
        forwardMsgId={forwardMsgId}
        setForwardMsgId={setForwardMsgId}
        showVideoCircle={showVideoCircle}
        setShowVideoCircle={setShowVideoCircle}
        showSchedule={showSchedule}
        setShowSchedule={setShowSchedule}
        showScheduledList={showScheduledList}
        setShowScheduledList={setShowScheduledList}
        showWallpaper={showWallpaper}
        setShowWallpaper={setShowWallpaper}
        wallpaper={wallpaper}
        setWallpaper={setWallpaper}
        scheduled={scheduled}
        reloadScheduled={reloadScheduled}
        setLastSince={setLastSince}
        onUserUpdate={onUserUpdate}
        onOpenFundraiser={onOpenFundraiser}
        sendFile={sendFile}
      />
    </div>
    </MediaActionsContext.Provider>
  );
}

// ForwardDialog вынесен в @/components/messenger/ForwardDialog