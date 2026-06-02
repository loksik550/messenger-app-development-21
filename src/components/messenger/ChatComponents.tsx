import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { api, uploadMedia, type Chat, type Message, type Reaction, type User } from "@/lib/api";
import { playMessageSound } from "@/lib/sounds";
import { MediaMessage, ReactionBar } from "@/components/messenger/ChatMediaMessage";
import { type MediaItem } from "@/components/messenger/MediaViewer";
import { ChatHeader, ContextMenu, ChatInput } from "@/components/messenger/ChatWindowParts";
import VideoCircleRecorder from "@/components/messenger/VideoCircleRecorder";
import { TypingIndicator } from "@/components/messenger/ChatAtoms";
import { SwipeableMessage } from "@/components/messenger/SwipeableMessage";
import { formatDateLabel, dayKey } from "@/components/messenger/dateGroup";
import { LinkifiedText, extractFirstUrl, getDomain } from "@/components/messenger/LinkifiedText";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { GiftBubble, FundraiserBubble, StickerBubble } from "@/components/messenger/SpecialBubbles";
import { GiftSendModal, FundraiserAttachModal } from "@/components/messenger/ChatGiftModals";
import { ForwardDialog } from "@/components/messenger/ForwardDialog";
import StickerPicker from "@/components/messenger/StickerPicker";
import DisappearingModal from "@/components/messenger/DisappearingModal";
import ExpiringIndicator from "@/components/messenger/ExpiringIndicator";
import BotInlineButtons, { type InlineButton } from "@/components/messenger/BotInlineButtons";
import ScheduleModal from "@/components/messenger/ScheduleModal";
import ScheduledList, { type ScheduledItem } from "@/components/messenger/ScheduledList";
import WallpaperPicker, { wallpaperById, wallpaperClassById } from "@/components/messenger/WallpaperPicker";
import PartnerProfilePanel from "@/components/messenger/PartnerProfilePanel";

// Re-export atoms so existing imports from ChatComponents still work
export { Avatar, TypingIndicator, ChatList } from "@/components/messenger/ChatAtoms";

// Магические числа/строки в одном месте
const SCROLL_NEAR_BOTTOM_PX = 120;
const SCROLL_SHOW_DOWN_PX = 200;
const SCROLL_RESET_NEW_PX = 50;
const TYPING_THROTTLE_MS = 3000;
const MEDIA_PLACEHOLDERS = ["📷 Фото", "🎥 Видео", "🎵 Голосовое"] as const;
const isMediaPlaceholder = (text: string) =>
  (MEDIA_PLACEHOLDERS as readonly string[]).includes(text) || text.startsWith("📎");

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; text: string; danger?: boolean; action: () => void | Promise<void>; }>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [forwardMsgId, setForwardMsgId] = useState<number | null>(null);
  const [pinnedMsg, setPinnedMsg] = useState<{ id: number; sender_name: string; text: string; media_type?: string } | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  // Подсказка о незнакомце: показываем если собеседник не в контактах
  const [isUnknown, setIsUnknown] = useState(false);
  const [unknownDismissed, setUnknownDismissed] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
  const [lastSince, setLastSince] = useState(0);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showDisappearing, setShowDisappearing] = useState(false);
  const [disappearingSec, setDisappearingSec] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    api("chat_get_settings", { chat_id: chat.id }, currentUser.id).then(r => {
      if (!alive) return;
      if (r && !r.error) setDisappearingSec(r.disappearing_seconds ?? null);
    });
    return () => { alive = false; };
  }, [chat.id, currentUser.id]);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("Загружаем...");
  const [isTyping, setIsTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const recordSecRef = useRef(0);
  useEffect(() => { recordSecRef.current = recordSec; }, [recordSec]);
  const [showVideoCircle, setShowVideoCircle] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showScheduledList, setShowScheduledList] = useState(false);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [showWallpaper, setShowWallpaper] = useState(false);
  useEffect(() => {
    const ls = localStorage.getItem(`nova_wp_${chat.id}`);
    if (ls) setWallpaper(ls);
    api("get_wallpaper", { chat_id: chat.id }, currentUser.id).then(r => {
      if (r && !r.error) {
        setWallpaper(r.wallpaper || null);
        if (r.wallpaper) localStorage.setItem(`nova_wp_${chat.id}`, r.wallpaper);
        else localStorage.removeItem(`nova_wp_${chat.id}`);
      }
    });
  }, [chat.id, currentUser.id]);
  // Незнакомец: проверяем что собеседник не в контактах
  useEffect(() => {
    if (!chat.partner_id) { setIsUnknown(false); return; }
    setUnknownDismissed(false);
    api("get_contacts", {}, currentUser.id).then(r => {
      if (r?.contacts) {
        const known = (r.contacts as Array<{ id: number }>).some(c => c.id === chat.partner_id);
        setIsUnknown(!known);
      }
    });
  }, [chat.id, chat.partner_id, currentUser.id]);
  const addToContacts = async () => {
    if (!chat.partner_id) return;
    await api("add_contact", { contact_id: chat.partner_id, name_override: chat.name }, currentUser.id);
    setIsUnknown(false);
  };
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ msgId: number; out: boolean } | null>(null);
  const [heartBurst, setHeartBurst] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = useCallback(async (since = 0) => {
    const data = await api("get_messages", { chat_id: chat.id, since }, currentUser.id);

    // Удаляем у себя то, что удалили на сервере (для получателя)
    if (Array.isArray(data.removed_ids) && data.removed_ids.length > 0) {
      const removedSet = new Set<number>(data.removed_ids);
      setMessages(prev => prev.some(m => removedSet.has(m.id)) ? prev.filter(m => !removedSet.has(m.id)) : prev);
    }

    if (data.messages && data.messages.length > 0) {
      const mapped: Message[] = data.messages.map((m: {
        id: number; text: string; created_at: number; sender_id: number; sender_name?: string; read_at?: number;
        image_url?: string; media_type?: string; media_url?: string;
        file_name?: string; file_size?: number; duration?: number;
        reactions?: Reaction[];
        reply_to?: { id: number; sender_name: string; text: string; media_type?: string } | null;
        forwarded_from_user_id?: number | null;
        forwarded_from_name?: string | null;
        edited_at?: number | null;
        kind?: "text" | "missed_call" | "system";
      }) => ({
        id: m.id,
        text: m.text,
        time: new Date(m.created_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
        out: m.sender_id === currentUser.id,
        read: !!m.read_at,
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        kind: m.kind || "text",
        created_at: m.created_at,
        image_url: m.image_url,
        media_type: m.media_type as Message["media_type"],
        media_url: m.media_url,
        file_name: m.file_name,
        file_size: m.file_size,
        duration: m.duration,
        reactions: m.reactions || [],
        reply_to: m.reply_to || null,
        forwarded_from_user_id: m.forwarded_from_user_id || null,
        forwarded_from_name: m.forwarded_from_name || null,
        edited_at: m.edited_at || null,
      }));
      if (since === 0) {
        setMessages(mapped);
      } else {
        const hasIncoming = mapped.some(m => !m.out);
        if (hasIncoming) playMessageSound();
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          // Дополнительная дедупликация: если это наше сообщение (out) с тем же текстом и создано
          // в пределах 5 секунд от уже существующего — считаем дубликатом.
          const isDuplicate = (m: Message) => {
            if (existingIds.has(m.id)) return true;
            if (!m.out) return false;
            return prev.some(pm =>
              pm.out &&
              pm.text === m.text &&
              Math.abs((pm.created_at || 0) - (m.created_at || 0)) < 5
            );
          };
          const newMsgs = mapped.filter(m => !isDuplicate(m));
          const updated = prev.map(pm => {
            const fresh = mapped.find(m => m.id === pm.id);
            return fresh ? { ...pm, reactions: fresh.reactions, read: fresh.read || pm.read } : pm;
          });
          return newMsgs.length > 0 ? [...updated, ...newMsgs] : updated;
        });
      }
      const maxTs = Math.max(...data.messages.map((m: { created_at: number }) => m.created_at));
      setLastSince(maxTs);
      api("mark_read", { chat_id: chat.id }, currentUser.id);
    }
  }, [chat.id, currentUser.id]);

  useEffect(() => {
    setMessages([]);
    setLastSince(0);
    loadMessages(0);
  }, [chat.id]);

  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") loadMessages(lastSince); };
    const interval = setInterval(tick, 3000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVis); };
  }, [chat.id, lastSince, loadMessages]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const data = await api("get_typing", { chat_id: chat.id }, currentUser.id);
      setIsTyping(!!data.typing);
    }, 4000);
    return () => clearInterval(interval);
  }, [chat.id, currentUser.id]);

  // Загрузка запланированных + автозапуск отправки доспевших
  const reloadScheduled = useCallback(async () => {
    const r = await api("scheduled_list", { chat_id: chat.id }, currentUser.id);
    if (r && Array.isArray(r.items)) setScheduled(r.items);
  }, [chat.id, currentUser.id]);

  useEffect(() => {
    reloadScheduled();
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const r = await api("scheduled_run_due", {}, currentUser.id);
      if (r && r.sent && r.sent > 0) {
        setLastSince(0);
      }
      reloadScheduled();
    }, 60000);
    return () => clearInterval(t);
  }, [reloadScheduled, currentUser.id]);

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

      const data = await api("send_message", {
        chat_id: chat.id,
        text,
        reply_to_id: replyId,
      }, currentUser.id);
      if (data.id) {
        const timeStr = new Date(data.created_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
        setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, { id: data.id, text, time: timeStr, out: true, created_at: data.created_at, reactions: [], reply_to: replyPreview }]);
        setLastSince(data.created_at);
      }
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
    holdTimer.current = setTimeout(() => setCtxMenu({ msgId, out }), 500);
  };
  const cancelHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); };

  const sendFile = async (file: File, extra?: { duration?: number; mediaTypeOverride?: "audio" | "video" | "image" | "file" }) => {
    setUploading(true);
    setShowAttach(false);
    const labelMap: Record<string, string> = { image: "Загружаем фото...", video: "Загружаем видео...", audio: "Загружаем аудио...", file: "Загружаем файл..." };
    try {
      const result = await uploadMedia(file, currentUser.id);
      const finalMediaType = extra?.mediaTypeOverride || result.media_type;
      setUploadLabel(labelMap[finalMediaType] || "Загружаем...");
      const data = await api("send_message", {
        chat_id: chat.id,
        media_type: finalMediaType,
        media_url: result.url,
        file_name: result.file_name,
        file_size: result.file_size,
        duration: extra?.duration,
      }, currentUser.id);
      if (data.id) {
        const timeStr = new Date(data.created_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
        setMessages(prev => [...prev, {
          id: data.id,
          text: data.text || "",
          time: timeStr,
          out: true,
          created_at: data.created_at,
          media_type: finalMediaType,
          media_url: result.url,
          image_url: finalMediaType === "image" ? result.url : undefined,
          file_name: result.file_name,
          file_size: result.file_size,
          duration: extra?.duration,
          reactions: [],
        }]);
        setLastSince(data.created_at);
      }
    } catch (uploadErr) { console.error(uploadErr); } finally { setUploading(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      // Подбираем поддерживаемый формат (Safari/iOS не любит webm)
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "",
      ];
      let mime = "";
      for (const c of candidates) {
        if (!c) { mime = ""; break; }
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) {
          mime = c; break;
        }
      }
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorder.current = mr;
      audioChunks.current = [];
      mr.ondataavailable = e => { if (e.data && e.data.size > 0) audioChunks.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const realType = mr.mimeType || mime || "audio/webm";
        const ext = realType.includes("mp4") ? "m4a" : realType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(audioChunks.current, { type: realType });
        if (blob.size < 500) return; // совсем пустая запись — отменили
        const dur = recordSecRef.current;
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: realType });
        await sendFile(file, { duration: dur, mediaTypeOverride: "audio" });
      };
      mr.start(100); // ловим chunks каждые 100мс
      setRecording(true);
      setRecordSec(0);
      if (recordTimer.current) clearInterval(recordTimer.current);
      recordTimer.current = setInterval(() => setRecordSec(s => {
        if (s + 1 >= 300) { // макс 5 минут
          if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
            try { mediaRecorder.current.stop(); } catch { /* ignore */ }
          }
          if (recordTimer.current) clearInterval(recordTimer.current);
          setRecording(false);
          return 300;
        }
        return s + 1;
      }), 1000);
    } catch (e) {
      const name = (e as DOMException).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        alert("Доступ к микрофону запрещён. Разреши его в настройках браузера.");
      } else {
        alert("Не удалось включить запись: " + (e as Error).message);
      }
    }
  };

  const stopRecording = () => {
    if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      try { mediaRecorder.current.stop(); } catch { /* ignore */ }
    }
    setRecording(false);
  };

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

  const setChatField = async (field: "muted" | "pinned" | "favorite", value: boolean) => {
    onChatUpdated?.({ ...chat, [field]: value });
    try {
      await api("set_chat_setting", { chat_id: chat.id, field, value }, currentUser.id);
    } catch {
      onChatUpdated?.({ ...chat, [field]: !value });
    }
  };

  const handleToggleMute = () => setChatField("muted", !chat.muted);
  const handleTogglePin = () => setChatField("pinned", !chat.pinned);
  const handleToggleFavorite = () => setChatField("favorite", !chat.favorite);

  const handleClearHistory = () => {
    setConfirm({
      title: "Очистить историю?",
      text: "Все сообщения в этом чате будут скрыты у вас. Собеседник продолжит видеть их у себя.",
      danger: true,
      action: async () => {
        await api("clear_history", { chat_id: chat.id }, currentUser.id);
        setMessages([]);
        setLastSince(Math.floor(Date.now() / 1000));
      },
    });
  };

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

  // Загружаем pinned при смене чата
  useEffect(() => {
    let cancel = false;
    api("get_pinned_message", { chat_id: chat.id }, currentUser.id).then(data => {
      if (cancel) return;
      setPinnedMsg(data.pinned || null);
    });
    return () => { cancel = true; };
  }, [chat.id, currentUser.id]);

  const handleBlock = () => {
    if (!chat.partner_id) return;
    setConfirm({
      title: "Заблокировать пользователя?",
      text: `${chat.name} больше не сможет писать вам сообщения. Чат скроется из списка.`,
      danger: true,
      action: async () => {
        await api("block_user", { target_user_id: chat.partner_id }, currentUser.id);
        onChatDeleted?.();
        onBack();
      },
    });
  };

  const handleToggleArchive = async () => {
    const next = !chat.archived;
    await api("archive_chat", { chat_id: chat.id, archived: next }, currentUser.id);
    onChatDeleted?.();
    onBack();
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

      {showProfile && !chat.group && (
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
        />
      )}

      {confirm && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-6 animate-fade-in" onClick={() => setConfirm(null)}>
          <div className="glass-strong rounded-2xl p-5 max-w-sm w-full animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-2">{confirm.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{confirm.text}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-xl hover:bg-white/8 text-sm">
                Отмена
              </button>
              <button
                onClick={async () => { const a = confirm.action; setConfirm(null); await a(); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${confirm.danger ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"}`}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock badge */}
      <div className="flex justify-center py-2">
        <div className="flex items-center gap-1.5 px-3 py-1 glass rounded-full">
          <Icon name="Lock" size={11} className="text-violet-400" />
          <span className="text-[11px] text-muted-foreground">Сквозное шифрование</span>
        </div>
      </div>

      {/* Подсказка о незнакомце */}
      {isUnknown && !unknownDismissed && chat.partner_id && (
        <div className="mx-3 mb-2 glass-strong border border-amber-400/30 rounded-2xl p-3 flex items-start gap-3 animate-fade-in">
          <Icon name="ShieldAlert" size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold mb-0.5">Незнакомый контакт</div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Этот пользователь не сохранён у вас в контактах. Будьте внимательны к ссылкам и просьбам о деньгах.
            </p>
            <div className="flex gap-2">
              <button
                onClick={addToContacts}
                className="px-3 py-1.5 rounded-xl grad-primary text-white text-xs font-bold"
              >
                Добавить в контакты
              </button>
              <button
                onClick={async () => {
                  await api("block_user", { blocked_id: chat.partner_id }, currentUser.id);
                  onChatDeleted?.();
                  onBack();
                }}
                className="px-3 py-1.5 rounded-xl bg-red-500/15 text-red-400 text-xs font-bold"
              >
                Заблокировать
              </button>
              <button
                onClick={() => setUnknownDismissed(true)}
                className="px-3 py-1.5 rounded-xl glass text-xs font-bold text-muted-foreground"
              >
                Скрыть
              </button>
            </div>
          </div>
        </div>
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
        />
      )}

      {/* Pinned message bar */}
      {pinnedMsg && (
        <button
          onClick={() => scrollToMessage(pinnedMsg.id)}
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
            onClick={(e) => { e.stopPropagation(); handlePinToggle(pinnedMsg.id); }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground"
          >
            <Icon name="X" size={14} />
          </button>
        </button>
      )}

      {/* Messages */}
      <div
        ref={messagesScrollRef}
        onScroll={handleMessagesScroll}
        className={`flex-1 overflow-y-auto px-3 py-2 space-y-1 relative ${wallpaperClassById(wallpaper)}`}
        style={wallpaperById(wallpaper) ? { background: wallpaperById(wallpaper) } : undefined}
        onClick={() => { setShowMenu(false); setShowReactionPicker(null); }}
      >
        {(() => {
          const mediaGallery: MediaItem[] = messages
            .filter(m => (m.media_type === "image" || m.media_type === "video") && (m.media_url || m.image_url))
            .map(m => ({ url: (m.media_url || m.image_url)!, type: m.media_type === "video" ? "video" as const : "image" as const }));

          let prevDayKey = "";
          const nodes: JSX.Element[] = [];

          filteredMessages.forEach((msg, i) => {
            const isMedia = (msg.media_type === "image" || msg.media_type === "video") && (msg.media_url || msg.image_url);
            const galleryIndex = isMedia
              ? mediaGallery.findIndex(g => g.url === (msg.media_url || msg.image_url))
              : 0;

            // Date separator
            const ts = msg.created_at || 0;
            const k = dayKey(ts);
            if (ts && k !== prevDayKey) {
              prevDayKey = k;
              nodes.push(
                <div key={`d-${k}-${msg.id}`} className="flex justify-center my-3">
                  <div className="px-3 py-1 glass rounded-full text-[11px] text-muted-foreground capitalize">
                    {formatDateLabel(ts)}
                  </div>
                </div>
              );
            }

            // Спецсообщения: подарок ⚡ / сбор / стикер
            if (msg.kind === "gift") {
              nodes.push(
                <div key={msg.id} id={`msg-${msg.id}`}
                  className={`flex ${msg.out ? "justify-end" : "justify-start"} my-2 animate-fade-in px-2`}>
                  <GiftBubble msg={msg} />
                </div>
              );
              return;
            }
            if (msg.kind === "fundraiser") {
              nodes.push(
                <div key={msg.id} id={`msg-${msg.id}`}
                  className={`flex ${msg.out ? "justify-end" : "justify-start"} my-2 animate-fade-in px-2`}>
                  <FundraiserBubble msg={msg} onOpen={(id) => onOpenFundraiser?.(id)} />
                </div>
              );
              return;
            }
            if (msg.kind === "sticker") {
              nodes.push(
                <div key={msg.id} id={`msg-${msg.id}`}
                  className={`flex ${msg.out ? "justify-end" : "justify-start"} my-1.5 animate-fade-in px-2`}>
                  <StickerBubble msg={msg} />
                </div>
              );
              return;
            }

            // Системные сообщения (например, пропущенный звонок)
            if (msg.kind === "missed_call") {
              const isCaller = msg.out;
              nodes.push(
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className="flex justify-center my-2 animate-fade-in"
                >
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-red-500/25">
                    <Icon name="PhoneMissed" size={13} className="text-red-400" />
                    <span className="text-[12px] text-foreground">
                      {isCaller ? "Звонок не принят" : "Пропущенный звонок"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{msg.time}</span>
                  </div>
                </div>
              );
              return;
            }

            const url = msg.text ? extractFirstUrl(msg.text) : null;
            const showText = !!msg.text && !isMediaPlaceholder(msg.text);

            nodes.push(
              <SwipeableMessage key={msg.id} out={msg.out} onReply={() => handleReply(msg.id)}>
                <div
                  id={`msg-${msg.id}`}
                  className={`flex flex-col ${msg.out ? "items-end" : "items-start"} animate-fade-in transition-all ${highlightId === msg.id ? "scale-[1.02]" : ""}`}
                  style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}
                >
                  <div
                    className={`relative max-w-[78%] w-fit min-w-[44px] rounded-[18px] text-[14px] leading-snug overflow-hidden select-none transition-shadow ${
                      msg.out
                        ? "msg-bubble-out text-white rounded-tr-md"
                        : "msg-bubble-in text-foreground rounded-tl-md"
                    } ${highlightId === msg.id ? "ring-2 ring-violet-400" : ""}`}
                    onMouseDown={() => startHold(msg.id, msg.out)}
                    onMouseUp={cancelHold}
                    onMouseLeave={cancelHold}
                    onContextMenu={e => { e.preventDefault(); setCtxMenu({ msgId: msg.id, out: msg.out }); }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      try { (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(15); } catch { /* ignore */ }
                      setHeartBurst(msg.id);
                      window.setTimeout(() => setHeartBurst(h => (h === msg.id ? null : h)), 900);
                      addReaction(msg.id, "❤️");
                    }}
                  >
                    {heartBurst === msg.id && (
                      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 text-3xl animate-heart-burst" aria-hidden>
                        ❤️
                      </div>
                    )}
                    {msg.forwarded_from_name && (
                      <div className={`px-4 pt-2 pb-0.5 text-[11px] font-medium ${msg.out ? "text-white/80" : "text-violet-400"} flex items-center gap-1`}>
                        <Icon name="Forward" size={11} />
                        Переслано от {msg.forwarded_from_name}
                      </div>
                    )}
                    {msg.reply_to && (
                      <button
                        onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.reply_to!.id); }}
                        className={`block w-full text-left mx-1 mt-1 px-3 py-1.5 rounded-lg border-l-2 ${msg.out ? "bg-white/15 border-white" : "bg-violet-500/15 border-violet-400"}`}
                      >
                        <div className={`text-[11px] font-medium ${msg.out ? "text-white" : "text-violet-400"}`}>
                          {msg.reply_to.sender_name}
                        </div>
                        <div className={`text-xs truncate ${msg.out ? "text-white/80" : "text-muted-foreground"}`}>
                          {msg.reply_to.text || (msg.reply_to.media_type === "image" ? "📷 Фото" : msg.reply_to.media_type === "video" ? "🎥 Видео" : "[медиа]")}
                        </div>
                      </button>
                    )}
                    {msg.kind === "story_reply" && msg.payload && (msg.payload as { story_media_url?: string }).story_media_url && (
                      <div className={`mx-2 mt-2 mb-1 flex items-center gap-2 rounded-xl p-1.5 pr-3 ${msg.out ? "bg-white/15" : "bg-white/5"}`}>
                        <img
                          src={(msg.payload as { story_media_url: string }).story_media_url}
                          alt="story"
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className={`text-[10px] uppercase tracking-wide font-bold ${msg.out ? "text-white/70" : "text-violet-400"}`}>Ответ на историю</div>
                          {(msg.payload as { story_caption?: string | null }).story_caption && (
                            <div className={`text-xs truncate ${msg.out ? "text-white/80" : "text-muted-foreground"}`}>
                              {(msg.payload as { story_caption: string }).story_caption}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {(msg.media_url || msg.image_url) && (
                      <div className="p-1">
                        <MediaMessage msg={msg} gallery={mediaGallery} galleryIndex={galleryIndex} out={msg.out} />
                      </div>
                    )}
                    {showText && (
                      <p className="px-2.5 pt-1.5 pb-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        <LinkifiedText text={msg.text} out={msg.out} />
                        <span
                          className="inline-block h-[1px] align-baseline"
                          style={{ width: (msg.edited_at ? 60 : 38) + (msg.out ? 14 : 0) }}
                          aria-hidden
                        />
                      </p>
                    )}
                    {url && showText && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`block mx-3 mb-2 px-3 py-2 rounded-lg border-l-2 ${msg.out ? "bg-white/10 border-white/60" : "bg-white/5 border-violet-400"} hover:opacity-90 transition-opacity`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon name="Link" size={12} className={msg.out ? "text-white/80" : "text-violet-400"} />
                          <span className={`text-[11px] font-medium ${msg.out ? "text-white" : "text-violet-400"}`}>
                            {getDomain(url)}
                          </span>
                        </div>
                        <div className={`text-xs mt-0.5 truncate ${msg.out ? "text-white/80" : "text-muted-foreground"}`}>
                          {url}
                        </div>
                      </a>
                    )}
                    <div className={`absolute bottom-1 right-2 flex items-center gap-0.5 pointer-events-none whitespace-nowrap ${showText ? "" : "px-2 pb-1 relative bottom-auto right-auto justify-end"}`}>
                      {msg.edited_at && (
                        <span className={`text-[10px] italic ${msg.out ? "text-white/70" : "text-muted-foreground"}`}>изм.</span>
                      )}
                      {msg.expires_at && <ExpiringIndicator expiresAt={msg.expires_at} out={msg.out} />}
                      <span className={`text-[10px] ${msg.out ? "text-white/70" : "text-muted-foreground"}`}>{msg.time}</span>
                      {msg.out && (
                        <Icon name={msg.read ? "CheckCheck" : "Check"} size={12} className={msg.read ? "text-sky-300" : "text-white/60"} />
                      )}
                    </div>
                  </div>
                  {(msg.reactions || []).filter(r => r.emoji !== "__removed__").length > 0 && (
                    <ReactionBar
                      reactions={msg.reactions || []}
                      currentUserId={currentUser.id}
                      onReact={(emoji) => addReaction(msg.id, emoji)}
                    />
                  )}
                  {(() => {
                    const p = msg.payload as { buttons?: InlineButton[][] } | null | undefined;
                    if (!p?.buttons || !Array.isArray(p.buttons) || p.buttons.length === 0) return null;
                    return (
                      <BotInlineButtons
                        rows={p.buttons}
                        chatId={chat.id}
                        messageId={msg.id}
                        currentUserId={currentUser.id}
                      />
                    );
                  })()}
                </div>
              </SwipeableMessage>
            );
          });

          return nodes;
        })()}
        {isTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex items-center gap-2 msg-bubble-in rounded-2xl rounded-tl-sm px-3 py-2">
              <TypingIndicator />
              <span className="text-xs text-violet-400 font-medium">{chat.name.split(" ")[0]} печатает</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          className="absolute right-4 bottom-24 z-20 w-11 h-11 rounded-full glass-strong flex items-center justify-center shadow-lg hover:bg-white/10 transition-all animate-fade-in"
        >
          <Icon name="ChevronDown" size={20} className="text-foreground" />
          {newCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 grad-primary rounded-full text-[10px] font-bold text-white flex items-center justify-center">
              {newCount > 99 ? "99+" : newCount}
            </span>
          )}
        </button>
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

      {showGiftModal && (
        <GiftSendModal
          currentUser={currentUser}
          chatId={chat.id}
          onClose={() => setShowGiftModal(false)}
          onSent={() => { setLastSince(0); }}
          onUserUpdate={onUserUpdate}
        />
      )}

      {showFundModal && (
        <FundraiserAttachModal
          currentUser={currentUser}
          chatId={chat.id}
          onClose={() => setShowFundModal(false)}
          onSent={() => { setLastSince(0); }}
          onCreate={() => { setShowFundModal(false); onOpenFundraiser?.(-1); }}
        />
      )}

      {showDisappearing && (
        <DisappearingModal
          current={disappearingSec}
          onClose={() => setShowDisappearing(false)}
          onSelect={async (sec) => {
            setShowDisappearing(false);
            const r = await api("chat_set_disappearing", { chat_id: chat.id, seconds: sec ?? 0 }, currentUser.id);
            if (r && !r.error) {
              setDisappearingSec(sec);
              setLastSince(0);
            }
          }}
        />
      )}

      {/* Forward dialog */}
      {forwardMsgId !== null && (
        <ForwardDialog
          messageId={forwardMsgId}
          currentUser={currentUser}
          currentChatId={chat.id}
          onClose={() => setForwardMsgId(null)}
        />
      )}

      {/* Video circle recorder */}
      <VideoCircleRecorder
        open={showVideoCircle}
        onClose={() => setShowVideoCircle(false)}
        onRecorded={(file, duration) => sendFile(file, { duration, mediaTypeOverride: "video" })}
      />

      <ScheduleModal
        open={showSchedule}
        hasContent={!!input.trim()}
        onClose={() => setShowSchedule(false)}
        onConfirm={async (ts) => {
          const r = await api("schedule_message", {
            chat_id: chat.id,
            text: input.trim(),
            scheduled_at: ts,
          }, currentUser.id);
          if (r?.error) throw new Error(r.error);
          setInput("");
          reloadScheduled();
        }}
      />

      <ScheduledList
        open={showScheduledList}
        items={scheduled}
        onClose={() => setShowScheduledList(false)}
        onCancel={async (id) => {
          await api("scheduled_cancel", { id }, currentUser.id);
          reloadScheduled();
        }}
      />

      <WallpaperPicker
        open={showWallpaper}
        current={wallpaper}
        onClose={() => setShowWallpaper(false)}
        onSelect={async (id) => {
          setWallpaper(id);
          if (id) localStorage.setItem(`nova_wp_${chat.id}`, id);
          else localStorage.removeItem(`nova_wp_${chat.id}`);
          await api("set_wallpaper", { chat_id: chat.id, wallpaper: id }, currentUser.id);
        }}
      />
    </div>
  );
}

// ForwardDialog вынесен в @/components/messenger/ForwardDialog