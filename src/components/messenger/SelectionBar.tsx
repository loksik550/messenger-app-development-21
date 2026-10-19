import { useState } from "react";
import Icon from "@/components/ui/icon";
import ForwardMediaDialog, { type ForwardTarget } from "@/components/messenger/ForwardMediaDialog";
import { api, type User } from "@/lib/api";
import native from "@/lib/native";
import { isMediaPlaceholder } from "@/components/messenger/chatConstants";

export interface SelectableMessage {
  id: number;
  text?: string | null;
  media_type?: string | null;
  media_url?: string | null;
  image_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  duration?: number | null;
  payload?: unknown;
  sender_name?: string | null;
}

async function forwardOne(m: SelectableMessage, t: ForwardTarget, me: User, source: "chat" | "group") {
  if (source === "chat" && t.kind === "chat") {
    const r = await api("forward_message", { message_id: m.id, target_chat_id: t.id }, me.id);
    if (r?.error) throw new Error(r.error);
    return;
  }
  const media = m.media_url || m.image_url || undefined;
  const fields = {
    text: m.text || "",
    media_type: media ? (m.media_type || "image") : undefined,
    media_url: media,
    file_name: m.file_name || undefined,
    file_size: m.file_size || undefined,
    duration: m.duration || undefined,
    payload: m.payload && typeof m.payload === "object" && "album" in (m.payload as object) ? m.payload : undefined,
  };
  const r = t.kind === "group"
    ? await api("send_group_message", { group_id: t.id, ...fields }, me.id)
    : await api("send_message", { chat_id: t.id, ...fields, forwarded_from_name: m.sender_name || undefined }, me.id);
  if (r?.error) throw new Error(r.error);
}

export default function SelectionBar({ selected, messages, source, canDelete, onDelete, onClear }: {
  selected: Set<number>;
  messages: SelectableMessage[];
  source: "chat" | "group";
  canDelete: (id: number) => boolean;
  onDelete: (ids: number[]) => Promise<void>;
  onClear: () => void;
}) {
  const [forwardOpen, setForwardOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState("");
  const picked = messages.filter((m) => selected.has(m.id)).sort((a, b) => a.id - b.id);
  const deletable = picked.length > 0 && picked.every((m) => canDelete(m.id));

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1800); };

  const copy = async () => {
    const text = picked.map((m) => m.text || "").filter((t) => t && !isMediaPlaceholder(t)).join("\n\n");
    if (!text) { flash("В выбранных нет текста"); return; }
    const ok = await native.clipboard.write(text);
    flash(ok ? "Текст скопирован" : "Не удалось скопировать");
    if (ok) setTimeout(onClear, 600);
  };

  return (
    <>
      <div
        className="absolute top-0 left-0 right-0 z-[60] flex items-center gap-1 px-2 glass-strong border-b border-white/5 animate-fade-in"
        style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))", paddingBottom: "0.5rem" }}
      >
        <button onClick={onClear} className="p-2 rounded-xl hover:bg-white/8" aria-label="Отменить выбор">
          <Icon name="X" size={20} />
        </button>
        <div className="flex-1 font-semibold">Выбрано: {picked.length}</div>
        <button onClick={copy} disabled={!picked.length} className="p-2.5 rounded-xl hover:bg-white/8 disabled:opacity-40" aria-label="Скопировать">
          <Icon name="Copy" size={20} />
        </button>
        <button onClick={() => setForwardOpen(true)} disabled={!picked.length} className="p-2.5 rounded-xl hover:bg-white/8 disabled:opacity-40" aria-label="Переслать">
          <Icon name="Forward" size={20} />
        </button>
        <button onClick={() => setConfirm(true)} disabled={!deletable} className="p-2.5 rounded-xl hover:bg-white/8 text-red-400 disabled:opacity-30" aria-label="Удалить">
          <Icon name="Trash2" size={20} />
        </button>
      </div>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[210] px-4 py-2 rounded-full glass-strong text-sm animate-fade-in pointer-events-none">
          {toast}
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[220] bg-black/60 flex items-center justify-center p-6 animate-fade-in" onClick={() => setConfirm(false)}>
          <div className="glass-strong rounded-3xl p-5 w-full max-w-xs animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-1">Удалить {picked.length > 1 ? `сообщения (${picked.length})` : "сообщение"}?</h3>
            <p className="text-sm text-muted-foreground mb-5">Они исчезнут у всех участников чата.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-white/8">Отмена</button>
              <button
                onClick={async () => { setConfirm(false); await onDelete(picked.map((m) => m.id)); onClear(); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {forwardOpen && (
        <ForwardMediaDialog
          title={`Переслать (${picked.length})`}
          sendTo={async (t, me) => { for (const m of picked) await forwardOne(m, t, me, source); }}
          onClose={() => setForwardOpen(false)}
          onDone={(name) => { setForwardOpen(false); flash(`Отправлено: ${name}`); setTimeout(onClear, 700); }}
        />
      )}
    </>
  );
}
