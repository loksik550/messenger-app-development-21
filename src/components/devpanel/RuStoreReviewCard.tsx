import { useState } from "react";
import Icon from "@/components/ui/icon";
import { rustoreCall, fmtDate, type Review, type Reply } from "./rustoreApi";

const TEMPLATES = [
  "Спасибо за отзыв! Нам очень приятно, что Nova вам нравится.",
  "Спасибо, что написали! Мы уже разбираемся с проблемой и исправим её в ближайшем обновлении.",
  "Извините за неудобства. Напишите, пожалуйста, в поддержку прямо в приложении (Настройки → Поддержка) — поможем разобраться.",
];

const REPLY_COLOR: Record<string, string> = {
  PUBLISHED: "text-emerald-300",
  MODERATION: "text-amber-300",
  REJECTED: "text-red-300",
};

interface Props {
  review: Review;
  onReplyChange: (reply: Reply | null) => void;
}

export default function RuStoreReviewCard({ review, onReplyChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [askDelete, setAskDelete] = useState(false);

  const reply = review.reply;
  const canEdit = !!reply?.id;

  const startEdit = () => {
    setText(reply?.text || "");
    setError("");
    setEditing(true);
  };

  const save = async () => {
    const t = text.trim();
    if (!t) return setError("Напишите текст ответа");
    if (t.length > 500) return setError("Не больше 500 символов");
    setBusy(true);
    setError("");
    try {
      const r = canEdit
        ? await rustoreCall<{ id: number }>("reply_edit", { feedback_id: reply!.id, text: t })
        : await rustoreCall<{ id: number }>("reply", { comment_id: review.id, text: t });
      onReplyChange({ id: r.id ?? null, text: t, status: "MODERATION", status_ru: "На модерации", date: new Date().toISOString() });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!reply?.id) return;
    setBusy(true);
    setError("");
    try {
      await rustoreCall("reply_delete", { feedback_id: reply.id });
      onReplyChange(null);
      setAskDelete(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  };

  const low = review.rating > 0 && review.rating <= 2;

  return (
    <div className={`rounded-2xl border p-4 ${low && !reply ? "bg-red-500/[0.04] border-red-500/20" : "bg-white/[0.03] border-white/8"}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
          {(review.user || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-white">{review.user}</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon key={i} name="Star" size={12} className={i <= review.rating ? "text-amber-400 fill-amber-400" : "text-slate-600"} />
              ))}
            </div>
            <span className="text-xs text-slate-500">{fmtDate(review.date)}</span>
            {review.edited && <span className="text-xs text-slate-500">· изменён</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {[review.version && `версия ${review.version}`, review.device, review.os].filter(Boolean).join(" · ")}
          </div>
        </div>
        {(review.likes > 0 || review.dislikes > 0) && (
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
            <span className="flex items-center gap-0.5"><Icon name="ThumbsUp" size={12} />{review.likes}</span>
            <span className="flex items-center gap-0.5"><Icon name="ThumbsDown" size={12} />{review.dislikes}</span>
          </div>
        )}
      </div>

      {review.text ? (
        <div className="mt-3 text-sm text-slate-200 whitespace-pre-wrap break-words">{review.text}</div>
      ) : (
        <div className="mt-3 text-sm text-slate-500 italic">Без текста</div>
      )}

      {reply && !editing && (
        <div className="mt-3 ml-4 pl-3 border-l-2 border-sky-500/40">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-sky-300">Ваш ответ</span>
            <span className={REPLY_COLOR[reply.status] || "text-slate-400"}>{reply.status_ru}</span>
            {reply.date && <span className="text-slate-500">{fmtDate(reply.date)}</span>}
          </div>
          <div className="mt-1 text-sm text-slate-300 whitespace-pre-wrap break-words">{reply.text}</div>
          {reply.status === "REJECTED" && (
            <div className="mt-1 text-xs text-red-300">Модератор RuStore не пропустил ответ — измените текст и отправьте снова.</div>
          )}
          {canEdit && (
            <div className="mt-2 flex gap-3 text-xs">
              <button onClick={startEdit} disabled={busy} className="text-sky-400 hover:text-sky-300">Изменить</button>
              {askDelete ? (
                <>
                  <span className="text-slate-400">Удалить ответ?</span>
                  <button onClick={remove} disabled={busy} className="text-red-400 hover:text-red-300">{busy ? "Удаляю…" : "Да"}</button>
                  <button onClick={() => setAskDelete(false)} className="text-slate-400">Нет</button>
                </>
              ) : (
                <button onClick={() => setAskDelete(true)} disabled={busy} className="text-red-400 hover:text-red-300">Удалить</button>
              )}
            </div>
          )}
        </div>
      )}

      {!reply && !editing && (
        <button onClick={startEdit} className="mt-3 flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300">
          <Icon name="Reply" size={15} /> Ответить
        </button>
      )}

      {editing && (
        <div className="mt-3">
          {!canEdit && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {TEMPLATES.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setText(t)}
                  className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-left"
                >
                  {t.length > 40 ? `${t.slice(0, 40)}…` : t}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            autoFocus
            placeholder="Ответ увидят все в RuStore"
            className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-500/50 resize-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-xs ${text.length > 480 ? "text-amber-300" : "text-slate-500"}`}>{text.length} / 500</span>
            <button onClick={() => { setEditing(false); setError(""); }} className="ml-auto px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-white/5">
              Отмена
            </button>
            <button
              onClick={save}
              disabled={busy || !text.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-sky-500 to-blue-600 text-white disabled:opacity-40"
            >
              {busy ? "Отправляю…" : canEdit ? "Сохранить" : "Отправить"}
            </button>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">Ответ пройдёт модерацию RuStore и появится в карточке приложения.</div>
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-red-300 flex gap-1.5">
          <Icon name="AlertTriangle" size={13} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </div>
  );
}
