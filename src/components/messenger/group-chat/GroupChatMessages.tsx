import type { RefObject } from "react";
import ProName from "@/components/messenger/ProName";
import Icon from "@/components/ui/icon";
import { useHoldDelegate } from "@/hooks/useHoldDelegate";
import { Avatar } from "@/components/messenger/ChatAtoms";
import { MediaMessage } from "@/components/messenger/ChatMediaMessage";
import { LinkifiedText } from "@/components/messenger/LinkifiedText";
import type { User, Group, GroupMessage } from "@/lib/api";

interface Props {
  group: Group;
  currentUser: User;
  messages: GroupMessage[];
  groupedMessages: { date: string; msgs: GroupMessage[] }[];
  pinned: { id: number; text: string; sender_name: string; media_type?: string } | null;
  isAdminHere: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  endRef: RefObject<HTMLDivElement | null>;
  onUnpin: () => void;
  onOpenContext: (ctx: { msgId: number; out: boolean }) => void;
  selectedIds?: Set<number> | null;
  onToggleSelect?: (id: number) => void;
  onReact: (msgId: number, emoji: string) => void;
  onRetry?: (msgId: number) => void;
  onDiscard?: (msgId: number) => void;
}

export default function GroupChatMessages({
  group,
  currentUser,
  messages,
  groupedMessages,
  pinned,
  isAdminHere,
  scrollRef,
  endRef,
  onUnpin,
  onOpenContext,
  selectedIds,
  onToggleSelect,
  onReact,
  onRetry,
  onDiscard,
}: Props) {
  const hold = useHoldDelegate((id, out) => onOpenContext({ msgId: id, out }), !selectedIds);
  return (
    <>
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
            <button onClick={onUnpin} className="p-1.5 rounded-lg hover:bg-white/8 flex-shrink-0">
              <Icon name="X" size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div {...hold} ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1 relative">
        {groupedMessages.map(({ date, msgs }) => (
          <div key={date}>
            <div className="flex justify-center my-3">
              <span className="text-[11px] text-muted-foreground bg-white/5 px-3 py-1 rounded-full">{date}</span>
            </div>
            {msgs.map((msg, i) => {
              const showAvatar = !msg.out && (i === 0 || msgs[i - 1]?.sender_id !== msg.sender_id);
              const showName = !msg.out && showAvatar;
              const selecting = !!selectedIds;
              const isSel = selecting && selectedIds!.has(msg.id);
              return (
                <div
                  key={msg.id}
                  id={`gmsg-${msg.id}`}
                  className={`relative flex items-end gap-2 mb-0.5 rounded-xl transition-colors ${msg.out ? "flex-row-reverse" : "flex-row"} ${selecting ? "pl-9" : ""} ${isSel ? "bg-violet-500/15" : ""}`}
                  data-hold-id={msg.id}
                  data-hold-out={msg.out ? "1" : "0"}
                  style={{ WebkitTouchCallout: "none" }}
                >
                  {selecting && msg.id > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleSelect?.(msg.id); }}
                      className="absolute inset-0 z-30 flex items-center pl-1.5"
                      aria-label={isSel ? "Снять выбор" : "Выбрать"}
                    >
                      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSel ? "bg-violet-500 border-violet-500" : "border-white/50 bg-black/20"}`}>
                        {isSel && <Icon name="Check" size={14} className="text-white" />}
                      </span>
                    </button>
                  )}
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
                      <span className="text-[11px] font-semibold text-violet-400 px-1 mb-0.5 max-w-full"><ProName name={msg.sender_name || ""} isPro={msg.sender_pro} emoji={msg.sender_emoji} color={msg.sender_color} badgeSize={11} /></span>
                    )}

                    {msg.media_type ? (
                      <MediaMessage
                        msg={{ id: msg.id, text: msg.text, time: msg.time || "", out: msg.out,
                          media_type: msg.media_type as "image"|"video"|"audio"|"file",
                          media_url: msg.media_url || undefined, file_name: msg.file_name || undefined,
                          file_size: msg.file_size || undefined, duration: msg.duration || undefined,
                          payload: msg.payload || null }}
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
                          {msg.out && msg.failed ? (
                            <Icon name="CircleAlert" size={12} className="text-red-300" />
                          ) : msg.out && msg.pending ? (
                            <Icon name="Clock" size={12} className="text-white/60" />
                          ) : msg.out && (
                            <Icon name={msg.read ? "CheckCheck" : "Check"} size={12} className={msg.read ? "text-sky-300" : "text-white/60"} />
                          )}
                        </div>
                      </div>
                    )}
                    {msg.out && msg.failed && (
                      <div className="flex justify-end gap-3 mt-1 text-[11px]">
                        <span className="text-red-300">Не отправлено</span>
                        <button onClick={(e) => { e.stopPropagation(); onRetry?.(msg.id); }} className="text-violet-300 font-semibold">Повторить</button>
                        <button onClick={(e) => { e.stopPropagation(); onDiscard?.(msg.id); }} className="text-muted-foreground">Удалить</button>
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
                            onClick={() => onReact(msg.id, emoji)}
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
    </>
  );
}