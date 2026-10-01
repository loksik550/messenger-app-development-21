import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";

export function ForwardDialog({
  messageId,
  currentUser,
  currentChatId,
  onClose,
}: {
  messageId: number;
  currentUser: User;
  currentChatId: number;
  onClose: () => void;
}) {
  const [chats, setChats] = useState<Array<{ id: number; name: string; avatar: string; saved?: boolean }>>([]);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api("saved_chat", {}, currentUser.id).catch(() => null),
      api("get_chats", {}, currentUser.id),
    ]).then(([saved, data]) => {
      const list: Array<{ id: number; name: string; avatar: string; saved?: boolean }> = [];
      if (saved?.chat_id && saved.chat_id !== currentChatId) {
        list.push({ id: saved.chat_id, name: "Избранное", avatar: "", saved: true });
      }
      if (data.chats) {
        list.push(...data.chats
          .filter((c: { id: number }) => c.id !== currentChatId)
          .map((c: { id: number; partner: { name: string } }) => ({
            id: c.id,
            name: c.partner.name,
            avatar: c.partner.name[0]?.toUpperCase() || "?",
          })));
      }
      setChats(list);
    });
  }, [currentUser.id, currentChatId]);

  const filtered = query.trim()
    ? chats.filter(c => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : chats;

  const send = async (chatId: number) => {
    setSending(true);
    await api("forward_message", { message_id: messageId, target_chat_id: chatId }, currentUser.id);
    setSentTo(chatId);
    setTimeout(onClose, 600);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-end md:items-center justify-center animate-fade-in" onClick={onClose}>
      <div
        className="glass-strong rounded-t-3xl md:rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="font-semibold">Переслать в чат</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
            <Icon name="Search" size={16} className="text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск чата..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">Нет чатов</div>
          )}
          {filtered.map(c => (
            <button
              key={c.id}
              disabled={sending}
              onClick={() => send(c.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/8 transition-colors disabled:opacity-50 ${sentTo === c.id ? "bg-emerald-500/10" : ""}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white ${c.saved ? "bg-gradient-to-br from-sky-500 to-violet-600" : "grad-primary"}`}>
                {c.saved ? <Icon name="Bookmark" size={18} /> : c.avatar}
              </div>
              <span className="flex-1 text-left font-medium">{c.name}</span>
              {sentTo === c.id && <Icon name="Check" size={18} className="text-emerald-400" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ForwardDialog;
