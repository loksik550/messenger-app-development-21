import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface Ticket {
  id: number;
  user_id: number;
  user_name: string;
  subject: string;
  status: string;
  created_at: number;
}

interface Msg {
  id: number;
  ticket_id: number;
  sender: string;
  text: string;
  created_at: number;
}

export default function DevSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await devApi<{ tickets: Ticket[] }>("support_tickets");
      setTickets(res.tickets);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openTicket = async (t: Ticket) => {
    setActive(t);
    setMsgs([]);
    try {
      const res = await devApi<{ messages: Msg[] }>("support_messages", { ticket_id: t.id });
      setMsgs(res.messages);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось открыть");
    }
  };

  const send = async () => {
    if (!active || !reply.trim()) return;
    setBusy(true);
    try {
      await devApi("support_reply", { ticket_id: active.id, text: reply.trim() });
      setReply("");
      await openTicket(active);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await devApi("support_close", { ticket_id: active.id });
      setActive(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось закрыть");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
          <span className="text-sm font-semibold">Обращения</span>
          <button onClick={load} className="text-slate-500 hover:text-slate-300">
            <Icon name="RefreshCw" size={14} />
          </button>
        </div>
        {tickets.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">Обращений нет</div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => openTicket(t)}
                className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] transition ${
                  active?.id === t.id ? "bg-violet-500/10" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{t.subject || `Обращение #${t.id}`}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                      t.status === "closed"
                        ? "bg-slate-500/20 text-slate-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {t.status === "closed" ? "закрыто" : "открыто"}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 truncate">{t.user_name}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{formatTs(t.created_at)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl flex flex-col min-h-[400px]">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
              <Icon name="MessageSquare" size={24} className="text-slate-600" />
            </div>
            <p className="text-sm text-slate-500">Выберите обращение слева</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{active.subject || `Обращение #${active.id}`}</div>
                <div className="text-xs text-slate-500">{active.user_name}</div>
              </div>
              {active.status !== "closed" && (
                <button
                  onClick={close}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition disabled:opacity-50 whitespace-nowrap"
                >
                  Закрыть
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[420px]">
              {msgs.length === 0 ? (
                <p className="text-center text-sm text-slate-600 py-8">Сообщений пока нет</p>
              ) : (
                msgs.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        m.sender === "admin"
                          ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                          : "bg-white/[0.06] text-slate-200"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{m.text}</div>
                      <div className={`text-[10px] mt-1 ${m.sender === "admin" ? "text-white/60" : "text-slate-500"}`}>
                        {formatTs(m.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {active.status !== "closed" && (
              <div className="p-3 border-t border-white/8 flex items-center gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ваш ответ..."
                  className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50 transition placeholder-slate-600"
                />
                <button
                  onClick={send}
                  disabled={busy || !reply.trim()}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 disabled:opacity-40 transition"
                >
                  <Icon name="Send" size={16} className="text-white" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
