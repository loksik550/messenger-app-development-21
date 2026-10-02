import Icon from "@/components/ui/icon";
import { useState, useRef, useEffect } from "react";
import { api, type Chat, type Message, type User } from "@/lib/api";
import { ChatHeader, ContextMenu, ChatInput } from "@/components/messenger/ChatWindowParts";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import StickerPicker from "@/components/messenger/StickerPicker";
import PartnerProfilePanel from "@/components/messenger/PartnerProfilePanel";
import MessageList from "@/components/messenger/MessageList";
import {
  SCROLL_NEAR_BOTTOM_PX, SCROLL_SHOW_DOWN_PX, SCROLL_RESET_NEW_PX,
  TYPING_THROTTLE_MS,
} from "@/components/messenger/chatConstants";
import { useChatMessages } from "@/components/messenger/useChatMessages";
import { useChatSettings } from "@/components/messenger/useChatSettings";
import { useChatActions, type ConfirmState } from "@/components/messenger/useChatActions";
import { enqueue, retry as retryOutbox, removeFromOutbox } from "@/lib/outbox";
import { track } from "@/lib/track";
import { useDraft } from "@/lib/drafts";
import { useChatMedia } from "@/components/messenger/useChatMedia";
import {
  ConfirmDialog, EncryptionBadge, UnknownContactHint, PinnedBar, ScrollDownButton,
} from "@/components/messenger/ChatOverlays";
import { ChatModals } from "@/components/messenger/ChatModals";

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
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [favToast, setFavToast] = useState("");
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [, setShowReactionPicker] = useState<number | null>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showDisappearing, setShowDisappearing] = useState(false);
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
    sendFile, startRecording, stopRecording, cancelRecording,
  } = useChatMedia({ chat, currentUser, setMessages, setLastSince, setShowAttach });

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ msgId: number; out: boolean } | null>(null);
  const [heartBurst, setHeartBurst] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
      if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
      const mr = mediaRecorder.current;
      if (mr && mr.state === "recording") {
        try { mr.stream?.getTracks().forEach(t => t.stop()); mr.stop(); } catch { /* noop */ }
      }
    };
  }, []);

  useEffect(() => {
    const container = messagesScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    // если близко к низу — авто-скроллим
    if (distanceFromBottom < SCROLL_NEAR_BOTTOM_PX) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
      setNewCount(0);
    } else {
      // считаем непрочитанные «новые входящие»
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && !lastMsg.out) {
        setNewCount((n) => n + 1);
      }
    }
  }, [messages, isTyping]);

  const handleMessagesScroll = () => {
    const container = messagesScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollDown(distanceFromBottom > SCROLL_SHOW_DOWN_PX);
    if (distanceFromBottom < SCROLL_RESET_NEW_PX) setNewCount(0);
  };

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewCount(0);
  };

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
        await api("edit_message", { message_id: editId, text }, currentUser.id);
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

  const deleteMessage = (msgId: number) => {
    setCtxMenu(null);
    setConfirm({
      title: "Удалить сообщение?",
      text: "Сообщение исчезнет у всех участников чата.",
      danger: true,
      action: async () => {
        // Оптимистично убираем
        setMessages(prev => prev.filter(m => m.id !== msgId));
        const r = await api("delete_message", { message_id: msgId }, currentUser.id);
        if (r?.error) {
          alert("Не удалось удалить: " + r.error);
          // Откат: перезагрузим
          setLastSince(0);
        }
      },
    });
  };

  const startHold = (msgId: number, out: boolean) => {
    if (msgId < 0) return;
    holdTimer.current = setTimeout(() => setCtxMenu({ msgId, out }), 500);
  };
  const cancelHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); };

  const addReaction = async (msgId: number, emoji: string) => {
    setShowReactionPicker(null);
    setCtxMenu(null);
    await api("add_reaction", { message_id: msgId, emoji }, currentUser.id);
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const existing = m.reactions || [];
      const myIdx = existing.findIndex(r => r.user_id === currentUser.id);
      if (myIdx >= 0) {
        const updated = [...existing];
        if (updated[myIdx].emoji === emoji) {
          updated.splice(myIdx, 1);
        } else {
          updated[myIdx] = { ...updated[myIdx], emoji };
        }
        return { ...m, reactions: updated };
      }
      return { ...m, reactions: [...existing, { emoji, user_id: currentUser.id, user_name: "Я" }] };
    }));
  };

  const {
    handleToggleMute, handleTogglePin, handleToggleFavorite,
    handleClearHistory, handleBlock, handleToggleArchive,
  } = useChatActions({ chat, currentUser, onBack, onChatUpdated, onChatDeleted, setConfirm, setMessages, setLastSince });

  // ── Reply / Forward / Edit / Pin ──
  const handleReply = (msgId: number) => {
    const m = messages.find(x => x.id === msgId);
    if (m) {
      setReplyTo({ ...m, sender_name: m.out ? "Вы" : (m.sender_name || chat.name) });
      setEditing(null);
      setCtxMenu(null);
    }
  };

  const handleEdit = (msgId: number) => {
    const m = messages.find(x => x.id === msgId);
    if (m) {
      setEditing(m);
      setReplyTo(null);
      setInput(m.text);
      setCtxMenu(null);
    }
  };

  const handleForward = (msgId: number) => {
    setForwardMsgId(msgId);
    setCtxMenu(null);
  };

  const handlePinToggle = async (msgId: number) => {
    setCtxMenu(null);
    if (pinnedMsg?.id === msgId) {
      setPinnedMsg(null);
      await api("unpin_message", { chat_id: chat.id }, currentUser.id);
    } else {
      const m = messages.find(x => x.id === msgId);
      if (m) {
        setPinnedMsg({ id: m.id, sender_name: m.out ? "Вы" : (m.sender_name || chat.name), text: m.text, media_type: m.media_type });
      }
      await api("pin_message", { chat_id: chat.id, message_id: msgId }, currentUser.id);
    }
  };

  const scrollToMessage = (msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(msgId);
      setTimeout(() => setHighlightId(null), 1500);
    }
  };


  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => (m.text || "").toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : messages;

  return (
    <div className="flex flex-col h-full animate-fade-in relative">
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
      />

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

      {ctxMenu && (
        <ContextMenu
          ctxMenu={ctxMenu}
          messages={messages}
          onClose={() => { setCtxMenu(null); setShowReactionPicker(null); }}
          onReact={addReaction}
          onDelete={deleteMessage}
          onReply={handleReply}
          onForward={handleForward}
          onEdit={handleEdit}
          onPin={handlePinToggle}
          isPinned={pinnedMsg?.id === ctxMenu.msgId}
          onFavorite={chat.saved ? undefined : async (id) => {
            setCtxMenu(null);
            const saved = await api("saved_chat", {}, currentUser.id).catch(() => null);
            const r = saved?.chat_id
              ? await api("forward_message", { message_id: id, target_chat_id: saved.chat_id }, currentUser.id).catch(() => null)
              : null;
            track("favorite_add");
            setFavToast(r && !r.error ? "Добавлено в избранное" : "Не удалось добавить");
            setTimeout(() => setFavToast(""), 1800);
          }}
        />
      )}

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
        onStartHold={startHold}
        onCancelHold={cancelHold}
        onAddReaction={addReaction}
        onCtxMenu={(c) => { if (c.msgId > 0) setCtxMenu(c); }}
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
  );
}

// ForwardDialog вынесен в @/components/messenger/ForwardDialog