import { useState } from "react";
import Icon from "@/components/ui/icon";
import { rustoreCall, fmtDate, type Version } from "./rustoreApi";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PARTIAL_ACTIVE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  ALPHA_ACTIVE: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  BETA_ACTIVE: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  READY_FOR_PUBLICATION: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  MODERATION: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  TAKEN_FOR_MODERATION: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  AUTO_CHECK: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  REJECTED_BY_MODERATOR: "bg-red-500/15 text-red-300 border-red-500/30",
  REJECTED_BY_SECURITY: "bg-red-500/15 text-red-300 border-red-500/30",
  AUTO_CHECK_FAILED: "bg-red-500/15 text-red-300 border-red-500/30",
};

const TESTING_RU: Record<string, string> = {
  ALPHA: "Альфа",
  BETA: "Бета",
  RELEASE: "Релиз",
};

function VersionRow({ v, onNoteSaved }: { v: Version; onNoteSaved: (note: string) => void }) {
  const rejected = !!v.reject_hint;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(v.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await rustoreCall("version_note", { version_id: v.version_id, note: text });
      onNoteSaved(text.trim());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-xl ${rejected ? "bg-red-500/[0.04] border border-red-500/15" : ""}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 text-sm text-left ${rejected ? "px-3 py-2" : "py-1"}`}
      >
        <div className="font-mono text-slate-300 w-16 flex-shrink-0">{v.name}</div>
        <span className="text-[10px] uppercase tracking-wide text-slate-500 w-12 flex-shrink-0">
          {TESTING_RU[v.testing || "RELEASE"] || v.testing}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[v.status] || "bg-white/5 text-slate-400 border-white/10"}`}>
          {v.status_ru}
        </span>
        {v.note && <Icon name="StickyNote" size={13} className="text-amber-300 flex-shrink-0" />}
        <div className="text-xs text-slate-500 ml-auto hidden sm:block">{fmtDate(v.published_at || v.sent_at)}</div>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={14} className="text-slate-500 flex-shrink-0" />
      </button>

      {open && (
        <div className={`text-xs space-y-2 ${rejected ? "px-3 pb-3" : "pb-2 pl-1"}`}>
          <div className="text-slate-500">
            Сборка {v.code} · отправлена {fmtDate(v.sent_at) || "—"}
            {v.whats_new && <> · «{v.whats_new.length > 80 ? `${v.whats_new.slice(0, 80)}…` : v.whats_new}»</>}
          </div>

          {rejected && (
            <div className="rounded-lg bg-black/20 p-2.5 text-slate-300 flex gap-2">
              <Icon name="Info" size={14} className="flex-shrink-0 mt-0.5 text-red-300" />
              <div>
                {v.reject_hint}{" "}
                <a href="https://console.rustore.ru/" target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300">
                  Открыть консоль RuStore
                </a>
              </div>
            </div>
          )}

          {editing ? (
            <div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={3000}
                autoFocus
                placeholder="Вставьте сюда замечание модератора из письма — чтобы вся команда видела, что исправить"
                className="w-full rounded-lg bg-black/30 border border-white/10 px-2.5 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-500/50 resize-none"
              />
              <div className="mt-1.5 flex gap-2 justify-end">
                <button onClick={() => { setEditing(false); setText(v.note || ""); }} className="px-3 py-1 rounded-lg text-slate-300 hover:bg-white/5">
                  Отмена
                </button>
                <button onClick={save} disabled={busy} className="px-3 py-1 rounded-lg font-semibold bg-sky-600 text-white disabled:opacity-50">
                  {busy ? "Сохраняю…" : "Сохранить"}
                </button>
              </div>
            </div>
          ) : v.note ? (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
              <div className="text-amber-200 whitespace-pre-wrap break-words">{v.note}</div>
              <div className="mt-1 flex gap-3 text-slate-500">
                {v.note_by && <span>{v.note_by}</span>}
                <button onClick={() => setEditing(true)} className="text-sky-400 hover:text-sky-300">Изменить</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
              <Icon name="Plus" size={13} /> {rejected ? "Записать причину отказа" : "Добавить заметку"}
            </button>
          )}

          {error && <div className="text-red-300">{error}</div>}
        </div>
      )}
    </div>
  );
}

interface Props {
  versions: Version[];
  onChange: (versions: Version[]) => void;
}

export default function RuStoreVersions({ versions, onChange }: Props) {
  if (!versions.length) return null;
  const rejectedCount = versions.filter((v) => v.reject_hint).length;

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-sm font-semibold text-white">Версии в RuStore</div>
        {rejectedCount > 0 && (
          <span className="text-xs text-red-300">· отклонено: {rejectedCount}</span>
        )}
      </div>
      <div className="space-y-1.5">
        {versions.map((v) => (
          <VersionRow
            key={v.version_id}
            v={v}
            onNoteSaved={(note) => onChange(versions.map((x) => (x.version_id === v.version_id ? { ...x, note } : x)))}
          />
        ))}
      </div>
    </div>
  );
}
