import { useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi } from "@/lib/devApi";

export default function DevNovaMessage({ userId, userName }: { userId: number; userName: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      await devApi("nova_message", { user_ids: [userId], text: text.trim() });
      setText("");
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600/15 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-600/25 transition"
      >
        <Icon name="MessageSquarePlus" size={15} />
        Написать от имени Nova
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-2xl bg-white/[0.03] border border-violet-500/25 p-3">
      <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[9px] font-bold text-white">N</div>
        <span>Nova</span>
        <Icon name="ArrowRight" size={11} />
        <span className="text-slate-200 truncate">{userName || `ID ${userId}`}</span>
        <button onClick={() => setOpen(false)} className="ml-auto text-slate-500 hover:text-slate-300"><Icon name="X" size={14} /></button>
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
        rows={3}
        maxLength={4000}
        placeholder="Сообщение придёт в чат «Nova» с галочкой и пушем"
        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500/50 resize-none"
      />
      <div className="flex items-center gap-2 mt-2">
        {err && <span className="text-xs text-red-400">{err}</span>}
        {done && <span className="text-xs text-emerald-400">Отправлено</span>}
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          className="ml-auto px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
        >
          <Icon name={busy ? "Loader2" : "Send"} size={14} className={busy ? "animate-spin" : ""} />
          Отправить
        </button>
      </div>
    </div>
  );
}
