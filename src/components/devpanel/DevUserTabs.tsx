import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs } from "@/lib/devApi";

interface ChatRow {
  id: number;
  partner_id: number;
  partner_name: string;
  last_message: string | null;
  last_message_at: number | null;
}

interface Msg {
  id: number;
  sender_id: number;
  sender_name: string;
  text: string;
  created_at: number;
  media_type: string | null;
  media_url: string | null;
  removed: boolean;
}

interface MediaFile {
  id: number;
  type: string;
  url: string;
  name: string;
  size: number;
  created_at: number;
}

interface TabProps {
  userId: number;
  can: (p: string) => boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
}

export function DevUserChatsTab({ userId, can, run }: TabProps) {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [openChat, setOpenChat] = useState<ChatRow | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);

  useEffect(() => {
    devApi<{ chats: ChatRow[] }>("user_chats", { user_id: userId })
      .then((r) => setChats(r.chats))
      .catch(() => undefined);
  }, [userId]);

  const openChatMessages = async (c: ChatRow) => {
    setOpenChat(c);
    setMsgs([]);
    try {
      const r = await devApi<{ messages: Msg[] }>("chat_messages", { chat_id: c.id });
      setMsgs(r.messages);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось открыть переписку");
    }
  };

  const exportChat = async (chatId: number) => {
    try {
      const r = await devApi<{ messages: { author: string; text: string; time: string }[] }>(
        "export_chat",
        { chat_id: chatId },
      );
      const text = r.messages.map((m) => `[${m.time}] ${m.author}: ${m.text || "—"}`).join("\n");
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `chat-${chatId}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось выгрузить");
    }
  };

  return (
    <div>
      {openChat ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setOpenChat(null)}
              className="flex items-center gap-1 text-violet-400 text-xs hover:text-violet-300"
            >
              <Icon name="ChevronLeft" size={14} />
              К списку
            </button>
            <span className="text-sm font-medium ml-1 truncate">{openChat.partner_name}</span>
            <div className="ml-auto flex gap-1.5">
              <button
                onClick={() => exportChat(openChat.id)}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
              >
                Выгрузить
              </button>
              {can("chats") && (
                <button
                  onClick={() => {
                    if (!confirm("Удалить всю переписку?")) return;
                    run(async () => {
                      await devApi("delete_chat", { chat_id: openChat.id });
                      await openChatMessages(openChat);
                    });
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-[11px] hover:bg-red-500/25"
                >
                  Очистить
                </button>
              )}
            </div>
          </div>

          {msgs.length === 0 ? (
            <p className="text-center text-xs text-slate-600 py-8">Сообщений нет</p>
          ) : (
            <div className="space-y-2">
              {msgs.map((m) => (
                <div
                  key={m.id}
                  className={`group flex ${m.sender_id === userId ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      m.removed
                        ? "bg-white/[0.02] text-slate-600 italic"
                        : m.sender_id === userId
                          ? "bg-violet-600/25 border border-violet-500/20"
                          : "bg-white/[0.06]"
                    }`}
                  >
                    <div className="text-[10px] text-slate-500 mb-0.5">{m.sender_name}</div>
                    {m.removed ? (
                      <span className="text-xs">сообщение удалено</span>
                    ) : (
                      <>
                        {m.media_url && (
                          <div className="text-[11px] text-cyan-400 mb-1">
                            вложение: {m.media_type || "файл"}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap break-words">{m.text || "—"}</div>
                      </>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-600">{formatTs(m.created_at)}</span>
                      {!m.removed && can("chats") && (
                        <button
                          onClick={() =>
                            run(async () => {
                              await devApi("delete_message", { message_id: m.id });
                              setMsgs((prev) =>
                                prev.map((x) => (x.id === m.id ? { ...x, removed: true } : x)),
                              );
                            })
                          }
                          className="text-[10px] text-red-400/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                        >
                          удалить
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : chats.length === 0 ? (
        <p className="text-center text-xs text-slate-600 py-8">Переписок нет</p>
      ) : (
        <div className="space-y-1.5">
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => openChatMessages(c)}
              className="w-full text-left bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 rounded-xl px-3.5 py-2.5 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{c.partner_name}</span>
                <span className="text-[10px] text-slate-600 shrink-0">{formatTs(c.last_message_at)}</span>
              </div>
              <div className="text-xs text-slate-500 truncate mt-0.5">{c.last_message || "—"}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DevUserMediaTab({ userId, can, run }: TabProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);

  useEffect(() => {
    devApi<{ files: MediaFile[] }>("media_list", { user_id: userId })
      .then((r) => setFiles(r.files))
      .catch(() => undefined);
  }, [userId]);

  return (
    <div>
      {files.length === 0 ? (
        <p className="text-center text-xs text-slate-600 py-8">Файлов нет</p>
      ) : (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-3.5 py-2.5"
            >
              <Icon
                name={f.type === "image" ? "Image" : f.type === "video" ? "Video" : "File"}
                size={16}
                className="text-slate-500 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{f.name}</div>
                <div className="text-[10px] text-slate-600">
                  {f.type} · {(f.size / 1024).toFixed(0)} КБ · {formatTs(f.created_at)}
                </div>
              </div>
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10 whitespace-nowrap"
              >
                Открыть
              </a>
              {can("media") && (
                <button
                  onClick={() =>
                    run(async () => {
                      await devApi("delete_media", { message_id: f.id });
                      setFiles((prev) => prev.filter((x) => x.id !== f.id));
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-[11px] hover:bg-red-500/25 whitespace-nowrap"
                >
                  Удалить
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
