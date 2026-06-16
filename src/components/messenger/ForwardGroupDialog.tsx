import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User, type GroupMessage } from "@/lib/api";

export function ForwardGroupDialog({
  message,
  currentUser,
  onClose,
}: {
  message: GroupMessage;
  currentUser: User;
  onClose: () => void;
}) {
  const [chats, setChats] = useState<Array<{ id: number; name: string; avatar: string; partner_id: number }>>([]);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<number | null>(null);

  useEffect(() => {
    api("get_chats", {}, currentUser.id).then((data) => {
      if (data.chats) {
        setChats(data.chats.map((c: { id: number; partner: { id: number; name: string; avatar_url?: string | null } }) => ({
          id: c.id,
          partner_id: c.partner.id,
          name: c.partner.name,
          avatar: c.partner.name[0]?.toUpperCase() || "?",
        })));
      }
    });
  }, [currentUser.id]);

  const filtered = query.trim()
    ? chats.filter(c => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : chats;

  const send = async (partnerId: number) => {
    if (sending) return;
    setSending(true);
    const c = await api("get_or_create_chat", { partner_id: partnerId }, currentUser.id);
    if (c.chat_id) {
      await api("send_message", {
        chat_id: c.chat_id,
        text: message.text || "",
        media_type: message.media_type || undefined,
        media_url: message.media_url || undefined,
        file_name: message.file_name || undefined,
        file_size: message.file_size || undefined,
        duration: message.duration || undefined,
        forwarded_from_name: message.sender_name || "",
      }, currentUser.id);
      setSentTo(partnerId);
      setTimeout(onClose, 600);
    } else {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] bg-black/60 flex items-end md:items-center justify-center animate-fade-in" onClick={onClose}>
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
              onClick={() => send(c.partner_id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/8 transition-colors disabled:opacity-50 ${sentTo === c.partner_id ? "bg-emerald-500/10" : ""}`}
            >
              <div className="w-10 h-10 rounded-full grad-primary flex items-center justify-center font-semibold text-white">
                {c.avatar}
              </div>
              <span className="flex-1 text-left font-medium">{c.name}</span>
              {sentTo === c.partner_id && <Icon name="Check" size={18} className="text-emerald-400" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ForwardGroupDialog;
