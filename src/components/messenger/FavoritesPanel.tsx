import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { formatDateLabel } from "@/components/messenger/dateGroup";
import { native } from "@/lib/native";
import { track } from "@/lib/track";

interface FavMessage {
  id: number;
  chat_id: number;
  sender_id: number;
  sender_name: string;
  text: string;
  created_at: number;
  media_type?: string | null;
  media_url?: string | null;
  file_name?: string | null;
}

const MEDIA_LABEL: Record<string, { icon: string; label: string }> = {
  image: { icon: "Image", label: "Фото" },
  video: { icon: "Video", label: "Видео" },
  audio: { icon: "Mic", label: "Голосовое" },
  file: { icon: "FileText", label: "Файл" },
};

export default function FavoritesPanel({
  currentUser, onClose, onOpenChat,
}: {
  currentUser: User;
  onClose: () => void;
  onOpenChat: (chatId: number) => void;
}) {
  useEdgeSwipeBack(onClose);
  const [items, setItems] = useState<FavMessage[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    track("favorites_open");
    api("get_favorite_messages", {}, currentUser.id)
      .then(r => setItems(Array.isArray(r?.messages) ? r.messages : []))
      .catch(() => setItems([]));
  }, [currentUser.id]);

  const remove = async (id: number) => {
    setItems(prev => (prev || []).filter(m => m.id !== id));
    await api("toggle_favorite_message", { message_id: id }, currentUser.id).catch(() => null);
  };

  const q = query.trim().toLowerCase();
  const list = (items || []).filter(m => !q || (m.text || "").toLowerCase().includes(q) || (m.sender_name || "").toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0f0c1d] animate-fade-in">
      <div className="px-4 pb-3 border-b border-white/5" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8 transition-colors" aria-label="Назад">
            <Icon name="ChevronLeft" size={22} />
          </button>
          <h2 className="text-xl font-bold flex-1">Избранное</h2>
          <Icon name="Star" size={20} className="text-amber-400" />
        </div>
        {(items?.length || 0) > 3 && (
          <div className="flex items-center gap-3 glass rounded-2xl px-4 py-2.5">
            <Icon name="Search" size={16} className="text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск в избранном"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
        {items === null ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-6 text-muted-foreground">
            <div className="w-16 h-16 rounded-full glass flex items-center justify-center mb-4">
              <Icon name="Star" size={26} className="text-amber-400" />
            </div>
            <div className="font-semibold text-foreground mb-1">{q ? "Ничего не найдено" : "Здесь пока пусто"}</div>
            <div className="text-sm">Зажмите любое сообщение в чате и выберите «В избранное»</div>
          </div>
        ) : list.map(m => {
          const media = m.media_type ? MEDIA_LABEL[m.media_type] : null;
          const isImage = m.media_type === "image" && m.media_url;
          return (
            <div key={m.id} className="glass rounded-2xl p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                <span className="font-semibold text-violet-300 truncate">{m.sender_id === currentUser.id ? "Вы" : m.sender_name}</span>
                <span className="capitalize">· {formatDateLabel(m.created_at)}</span>
              </div>
              {isImage && (
                <img src={m.media_url!} alt="" className="rounded-xl max-h-56 w-full object-cover mb-2" loading="lazy" />
              )}
              {media && !isImage && (
                <div className="flex items-center gap-2 text-sm mb-1">
                  <Icon name={media.icon} size={16} className="text-violet-400" />
                  <span>{m.file_name || media.label}</span>
                </div>
              )}
              {m.text && !(media && m.text.startsWith("[")) && (
                <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>
              )}
              <div className="flex gap-1 mt-2 -mb-1 justify-end">
                <button onClick={() => onOpenChat(m.chat_id)} className="px-3 py-1.5 rounded-lg hover:bg-white/8 text-xs text-violet-300 flex items-center gap-1.5">
                  <Icon name="MessageCircle" size={14} /> К чату
                </button>
                {m.text && (
                  <button onClick={() => native.clipboard.write(m.text)} className="px-3 py-1.5 rounded-lg hover:bg-white/8 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Icon name="Copy" size={14} /> Копировать
                  </button>
                )}
                <button onClick={() => remove(m.id)} className="px-3 py-1.5 rounded-lg hover:bg-white/8 text-xs text-red-400 flex items-center gap-1.5">
                  <Icon name="StarOff" size={14} /> Убрать
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
