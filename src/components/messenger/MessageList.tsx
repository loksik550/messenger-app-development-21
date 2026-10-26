import { type RefObject, type JSX } from "react";
import Icon from "@/components/ui/icon";
import { type Chat, type Message, type User } from "@/lib/api";
import { MediaMessage, ReactionBar } from "@/components/messenger/ChatMediaMessage";
import { type MediaItem } from "@/components/messenger/MediaViewer";
import { TypingIndicator } from "@/components/messenger/ChatAtoms";
import { SwipeableMessage } from "@/components/messenger/SwipeableMessage";
import { formatDateLabel, dayKey } from "@/components/messenger/dateGroup";
import { LinkifiedText, extractFirstUrl, getDomain } from "@/components/messenger/LinkifiedText";
import { GiftBubble, FundraiserBubble, StickerBubble } from "@/components/messenger/SpecialBubbles";
import ExpiringIndicator from "@/components/messenger/ExpiringIndicator";
import BotInlineButtons, { type InlineButton } from "@/components/messenger/BotInlineButtons";
import { wallpaperById, wallpaperClassById } from "@/components/messenger/WallpaperPicker";
import { isMediaPlaceholder } from "@/components/messenger/chatConstants";
import { useHoldDelegate } from "@/hooks/useHoldDelegate";

interface CtxMenuState { msgId: number; out: boolean }

export interface MessageListProps {
  messages: Message[];
  filteredMessages: Message[];
  chat: Chat;
  currentUser: User;
  wallpaper: string | null;
  isTyping: boolean;
  highlightId: number | null;
  heartBurst: number | null;
  messagesScrollRef: RefObject<HTMLDivElement | null>;
  endRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onBackgroundClick: () => void;
  onReply: (id: number) => void;
  onScrollToMessage: (id: number) => void;
  onStartHold?: (id: number, out: boolean) => void;
  onCancelHold?: () => void;
  onAddReaction: (id: number, emoji: string) => void;
  onCtxMenu: (s: CtxMenuState) => void;
  onHeartBurst: (id: number | null) => void;
  onOpenFundraiser?: (id: number) => void;
  onRetry?: (id: number) => void;
  onDiscard?: (id: number) => void;
  hasMore?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  selectedIds?: Set<number> | null;
  onToggleSelect?: (id: number) => void;
}

export default function MessageList({
  messages, filteredMessages, chat, currentUser, wallpaper, isTyping,
  highlightId, heartBurst, messagesScrollRef, endRef,
  onScroll, onBackgroundClick, onReply, onScrollToMessage,
  onAddReaction, onCtxMenu, onHeartBurst, onOpenFundraiser,
  onRetry, onDiscard, hasMore, loadingOlder, onLoadOlder, selectedIds, onToggleSelect,
}: MessageListProps) {
  const selecting = !!selectedIds;
  const hold = useHoldDelegate((id, out) => onCtxMenu({ msgId: id, out }), !selecting);
  return (
    <div
      {...hold}
      ref={messagesScrollRef}
      onScroll={onScroll}
      className={`flex-1 overflow-y-auto px-3 py-2 space-y-1 relative ${wallpaperClassById(wallpaper)}`}
      style={wallpaperById(wallpaper) ? { background: wallpaperById(wallpaper) } : undefined}
      onClick={onBackgroundClick}
    >
      {hasMore && (
        <div className="flex justify-center py-2">
          <button
            onClick={(e) => { e.stopPropagation(); onLoadOlder?.(); }}
            disabled={loadingOlder}
            className="px-3 py-1 glass rounded-full text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {loadingOlder ? "Загрузка..." : "Показать ранние сообщения"}
          </button>
        </div>
      )}
      {(() => {
        const mediaGallery: MediaItem[] = messages
          .filter(m => (m.media_type === "image" || m.media_type === "video") && (m.media_url || m.image_url))
          .map(m => ({ url: (m.media_url || m.image_url)!, type: m.media_type === "video" ? "video" as const : "image" as const, msgId: m.id }));

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
              <div key={msg.id} id={`msg-${msg.id}`} data-hold-id={msg.id} data-hold-out={msg.out ? "1" : "0"}
                className={`flex ${msg.out ? "justify-end" : "justify-start"} my-2 animate-fade-in px-2`}>
                <GiftBubble msg={msg} />
              </div>
            );
            return;
          }
          if (msg.kind === "fundraiser") {
            nodes.push(
              <div key={msg.id} id={`msg-${msg.id}`} data-hold-id={msg.id} data-hold-out={msg.out ? "1" : "0"}
                className={`flex ${msg.out ? "justify-end" : "justify-start"} my-2 animate-fade-in px-2`}>
                <FundraiserBubble msg={msg} onOpen={(id) => onOpenFundraiser?.(id)} />
              </div>
            );
            return;
          }
          if (msg.kind === "sticker") {
            nodes.push(
              <div key={msg.id} id={`msg-${msg.id}`} data-hold-id={msg.id} data-hold-out={msg.out ? "1" : "0"}
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
          const isCircle = msg.media_type === "video" && (msg.file_name || "").startsWith("circle_") && !showText;

          const isSel = selecting && selectedIds!.has(msg.id);
          nodes.push(
            <SwipeableMessage key={msg.id} out={msg.out} onReply={() => { if (!selecting) onReply(msg.id); }}>
              <div
                id={`msg-${msg.id}`}
                className={`relative flex flex-col ${msg.out ? "items-end" : "items-start"} animate-fade-in transition-all ${highlightId === msg.id ? "scale-[1.02]" : ""} ${selecting ? "pl-9 rounded-xl" : ""} ${isSel ? "bg-violet-500/15" : ""}`}
                style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}
              >
                {selecting && msg.id > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleSelect?.(msg.id); }}
                    className="absolute inset-0 z-30 flex items-center pl-1.5"
                    aria-label={isSel ? "Снять выбор" : "Выбрать"}
                  >
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSel ? "bg-violet-500 border-violet-500" : "border-white/50 bg-black/20"}`}>
                      {isSel && <Icon name="Check" size={14} className="text-white" />}
                    </span>
                  </button>
                )}
                <div
                  className={`relative w-fit select-none transition-shadow ${
                    isCircle
                      ? "text-foreground"
                      : `max-w-[78%] min-w-[44px] rounded-[18px] text-[14px] leading-snug overflow-hidden ${msg.out
                        ? "msg-bubble-out text-white rounded-tr-md"
                        : "msg-bubble-in text-foreground rounded-tl-md"}`
                  } ${highlightId === msg.id ? (isCircle ? "scale-[1.02]" : "ring-2 ring-violet-400") : ""}`}
                  data-hold-id={msg.id}
                  data-hold-out={msg.out ? "1" : "0"}
                  style={{ WebkitTouchCallout: "none" }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    try { (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(15); } catch { /* ignore */ }
                    onHeartBurst(msg.id);
                    window.setTimeout(() => onHeartBurst(null), 900);
                    onAddReaction(msg.id, "❤️");
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
                      onClick={(e) => { e.stopPropagation(); onScrollToMessage(msg.reply_to!.id); }}
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
                    <div className={isCircle ? "" : "p-1"}>
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
                  <div className={`flex items-center gap-0.5 pointer-events-none whitespace-nowrap ${
                    isCircle
                      ? "absolute bottom-1 right-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm [&_span]:!text-white/90 [&_svg]:!text-white/90"
                      : showText ? "absolute bottom-1 right-2" : "px-2 pb-1 justify-end"}`}>
                    {msg.edited_at && (
                      <span className={`text-[10px] italic ${msg.out ? "text-white/70" : "text-muted-foreground"}`}>изм.</span>
                    )}
                    {msg.expires_at && <ExpiringIndicator expiresAt={msg.expires_at} out={msg.out} />}
                    <span className={`text-[10px] ${msg.out ? "text-white/70" : "text-muted-foreground"}`}>{msg.time}</span>
                    {msg.out && msg.failed ? (
                      <Icon name="CircleAlert" size={12} className="text-red-300" />
                    ) : msg.out && msg.pending ? (
                      <Icon name="Clock" size={12} className="text-white/60" />
                    ) : msg.out && (
                      <Icon name={msg.read ? "CheckCheck" : "Check"} size={12} className={msg.read ? "text-sky-300" : "text-white/60"} />
                    )}
                  </div>
                </div>
                {msg.out && msg.failed && (
                  <div className="flex justify-end gap-3 mt-1 text-[11px]">
                    <span className="text-red-300">Не отправлено</span>
                    <button onClick={(e) => { e.stopPropagation(); onRetry?.(msg.id); }} className="text-violet-300 font-semibold">Повторить</button>
                    <button onClick={(e) => { e.stopPropagation(); onDiscard?.(msg.id); }} className="text-muted-foreground">Удалить</button>
                  </div>
                )}
                {(msg.reactions || []).filter(r => r.emoji !== "__removed__").length > 0 && (
                  <ReactionBar
                    reactions={msg.reactions || []}
                    currentUserId={currentUser.id}
                    onReact={(emoji) => onAddReaction(msg.id, emoji)}
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
  );
}