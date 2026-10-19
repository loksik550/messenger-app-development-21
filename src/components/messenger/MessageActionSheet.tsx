import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { MenuList, VIEWER_REACTIONS, type PhotoMenuItem } from "@/components/messenger/MediaPhotoMenu";
import { saveMedia } from "@/lib/saveMedia";
import native from "@/lib/native";
import ForwardMediaDialog from "@/components/messenger/ForwardMediaDialog";
import { isMediaPlaceholder } from "@/components/messenger/chatConstants";

const MORE = ["😂", "😮", "😢", "😭", "😡", "🤯", "🥳", "😎", "🤔", "🙏", "💯", "✨", "⭐", "💪", "💔", "💜", "🎉", "🎁", "🚀", "🤡", "👻", "🌚", "💎", "🏆", "🤝", "😍", "😴", "🤩"];

export interface SheetMessage {
  id: number;
  out: boolean;
  text?: string | null;
  media_type?: string | null;
  media_url?: string | null;
  image_url?: string | null;
  file_name?: string | null;
  kind?: string | null;
}

export interface SheetActions {
  canDelete: boolean;
  canPin: boolean;
  isPinned: boolean;
  canEdit: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onPin: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onForward: () => void;
  onFavorite?: () => void;
  onClose: () => void;
}

function kindOf(m: SheetMessage) {
  const url = m.media_url || m.image_url || "";
  const isCircle = m.media_type === "video" && (m.file_name || "").startsWith("circle_");
  if (m.kind === "sticker") return { label: "стикер", icon: "Sticker", url: "" };
  if (isCircle) return { label: "кружок", icon: "CircleDot", url };
  if (m.media_type === "audio") return { label: "голосовое", icon: "Mic", url };
  if (m.media_type === "video") return { label: "видео", icon: "Video", url };
  if (m.media_type === "image" || m.image_url) return { label: "фото", icon: "Image", url };
  if (m.media_type === "file") return { label: "файл", icon: "File", url };
  return { label: "", icon: "MessageSquare", url: "" };
}

export default function MessageActionSheet({ msg, actions }: { msg: SheetMessage; actions: SheetActions }) {
  const [more, setMore] = useState(false);
  const [forwardMedia, setForwardMedia] = useState(false);
  const [toast, setToast] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const k = kindOf(msg);
  const text = msg.text && !isMediaPlaceholder(msg.text) ? msg.text : "";

  const flash = (t: string, close = true) => {
    setToast(t);
    setTimeout(() => { setToast(""); if (close) actions.onClose(); }, 1300);
  };

  const save = async () => {
    if (!k.url) return;
    try {
      const type = msg.media_type === "audio" ? "audio" : msg.media_type === "video" ? "video" : msg.media_type === "file" ? "file" : "image";
      const r = await saveMedia(k.url, type);
      flash(r === "downloaded" ? "Файл скачан" : r === "shared" ? "Готово" : "Сохранено на телефон");
    } catch { flash("Не удалось сохранить", false); }
  };

  const copy = async () => {
    const ok = await native.clipboard.write(text);
    flash(ok ? "Текст скопирован" : "Не удалось скопировать");
  };

  const saveLabel = k.label === "голосовое" ? "Сохранить голосовое" : k.label === "кружок" ? "Сохранить кружок"
    : k.label === "видео" ? "Сохранить видео" : k.label === "фото" ? "Сохранить фото" : "Сохранить файл";

  const items: PhotoMenuItem[] = [
    { key: "reply", icon: "Reply", label: "Ответить", onClick: actions.onReply },
    ...(text ? [{ key: "copy", icon: "Copy", label: "Скопировать", onClick: copy }] : []),
    ...(actions.canEdit ? [{ key: "edit", icon: "Pencil", label: "Изменить", onClick: actions.onEdit }] : []),
    ...(k.url ? [{ key: "save", icon: "Download", label: saveLabel, onClick: save }] : []),
    ...(actions.canPin ? [{ key: "pin", icon: actions.isPinned ? "PinOff" : "Pin", label: actions.isPinned ? "Открепить" : "Закрепить", onClick: actions.onPin }] : []),
    { key: "fwd", icon: "Forward", label: "Переслать", onClick: actions.onForward },
    ...(actions.onFavorite ? [{ key: "fav", icon: "Bookmark", label: "В избранное", onClick: actions.onFavorite }] : []),
    ...(actions.canDelete ? [{ key: "del", icon: "Trash2", label: "Удалить", danger: true, onClick: () => setConfirmDel(true) }] : []),
    { key: "select", icon: "CircleCheck", label: "Выбрать", divider: true, onClick: actions.onSelect },
  ];

  const preview = (() => {
    if (k.label === "кружок" && k.url) {
      return <video src={`${k.url}#t=0.1`} muted playsInline preload="metadata" className="w-40 h-40 rounded-full object-cover bg-zinc-900 shadow-2xl" />;
    }
    if (k.label === "фото" && k.url) {
      return <img src={k.url} alt="" className="max-h-[30vh] max-w-[70vw] rounded-[22px] object-contain shadow-2xl" draggable={false} />;
    }
    return (
      <div className={`max-w-[78vw] rounded-[20px] px-4 py-3 shadow-2xl ${msg.out ? "msg-bubble-out text-white" : "msg-bubble-in text-foreground"}`}>
        {k.label && (
          <div className="flex items-center gap-2 text-sm opacity-90">
            <Icon name={k.icon} size={18} />
            <span className="capitalize">{k.label}</span>
          </div>
        )}
        {text && <p className={`text-[15px] whitespace-pre-wrap break-words line-clamp-6 ${k.label ? "mt-1" : ""}`}>{text}</p>}
      </div>
    );
  })();

  if (forwardMedia && k.url) {
    return (
      <ForwardMediaDialog
        url={k.url}
        type={msg.media_type === "video" ? "video" : "image"}
        onClose={() => setForwardMedia(false)}
        onDone={(name) => { setForwardMedia(false); flash(`Отправлено: ${name}`); }}
      />
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-md flex flex-col justify-center gap-3 px-3 overflow-y-auto animate-fade-in"
      style={{
        alignItems: msg.out ? "flex-end" : "flex-start",
        paddingTop: "calc(1rem + env(safe-area-inset-top))",
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
      }}
      onClick={actions.onClose}
    >
      <div className="animate-scale-in max-w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-[#232733]/90 border border-white/10 shadow-2xl">
          {VIEWER_REACTIONS.map((e) => (
            <button key={e} onClick={() => actions.onReact(e)} className="text-[26px] w-10 h-10 flex items-center justify-center rounded-full active:scale-90 hover:scale-110 transition-transform">
              {e}
            </button>
          ))}
          <button onClick={() => setMore((v) => !v)} className="w-9 h-9 ml-0.5 rounded-full bg-white/15 flex items-center justify-center text-white" aria-label="Ещё реакции">
            <Icon name={more ? "ChevronUp" : "ChevronDown"} size={18} />
          </button>
        </div>
        {more && (
          <div className="mt-2 grid grid-cols-7 gap-1 p-2 rounded-3xl bg-[#232733]/90 border border-white/10 shadow-2xl animate-fade-in">
            {MORE.map((e) => (
              <button key={e} onClick={() => actions.onReact(e)} className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl active:scale-90 hover:bg-white/10">{e}</button>
            ))}
          </div>
        )}
      </div>

      <div className="animate-scale-in" onClick={(e) => e.stopPropagation()}>{preview}</div>

      <div className="animate-scale-in w-[min(78vw,300px)]" onClick={(e) => e.stopPropagation()}>
        <MenuList items={items.map((it) => it.key === "fwd" && k.url && (k.label === "фото" || k.label === "видео") ? { ...it, onClick: () => setForwardMedia(true) } : it)} />
      </div>

      {confirmDel && (
        <div className="fixed inset-0 z-[310] bg-black/60 flex items-center justify-center p-6" onClick={(e) => { e.stopPropagation(); setConfirmDel(false); }}>
          <div className="w-full max-w-xs rounded-3xl bg-[#232733] border border-white/10 p-5 text-white animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-1">Удалить {k.label || "сообщение"}?</h3>
            <p className="text-sm text-white/60 mb-5">Сообщение исчезнет у всех участников чата.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(false)} className="px-4 py-2 rounded-xl text-sm text-white/80 hover:bg-white/10">Отмена</button>
              <button onClick={() => { setConfirmDel(false); actions.onDelete(); }} className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30">Удалить</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[320] px-4 py-2.5 rounded-xl bg-[#232733] text-white text-sm shadow-xl flex items-center gap-2 pointer-events-none">
          <Icon name="CircleCheck" size={16} className="text-emerald-400" />
          {toast}
        </div>
      )}
    </div>,
    document.body,
  );
}
