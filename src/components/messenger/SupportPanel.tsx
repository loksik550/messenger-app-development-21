import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { useT } from "@/hooks/useT";
import { refreshSupportUnread } from "@/hooks/useSupportUnread";

interface Ticket {
  id: number;
  subject: string;
  status: "open" | "closed";
  created_at: number;
  last_message_at: number;
  unread: number;
  last_text: string;
}

interface SupportMsg {
  id: number;
  sender_id: number | null;
  is_admin: boolean;
  text: string;
  created_at: number;
}

const fmtTime = (ts: number) => new Date(ts * 1000).toLocaleString("ru", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
});

export default function SupportPanel({
  currentUser,
  onClose,
}: {
  currentUser: User;
  onClose: () => void;
}) {
  useEdgeSwipeBack(onClose);
  const { t: tr } = useT();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newText, setNewText] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadTickets = async () => {
    setLoading(true);
    const r = await api("support_my_tickets", {}, currentUser.id);
    if (Array.isArray(r?.tickets)) setTickets(r.tickets);
    setLoading(false);
  };

  useEffect(() => { if (!activeTicket) loadTickets(); }, [currentUser.id, activeTicket]);

  useEffect(() => {
    if (!activeTicket) return;
    let cancel = false;
    const load = async () => {
      const r = await api("support_ticket_messages", { ticket_id: activeTicket.id }, currentUser.id);
      if (cancel) return;
      if (Array.isArray(r?.messages)) {
        setMessages(r.messages);
        refreshSupportUnread();
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    };
    load();
    const tick = () => { if (document.visibilityState === "visible") load(); };
    const t = setInterval(tick, 10000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancel = true; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [activeTicket, currentUser.id]);

  const createTicket = async () => {
    if (!newText.trim()) return;
    setCreating(true);
    const r = await api("support_create_ticket", { subject: newSubject.trim(), text: newText.trim() }, currentUser.id);
    setCreating(false);
    if (r?.error) { alert(r.error); return; }
    setNewSubject(""); setNewText(""); setShowNew(false);
    await loadTickets();
  };

  const sendMsg = async () => {
    if (!activeTicket || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    const optimistic: SupportMsg = { id: Date.now(), sender_id: currentUser.id, is_admin: false, text, created_at: Math.floor(Date.now() / 1000) };
    setMessages(prev => [...prev, optimistic]);
    const r = await api("support_send_message", { ticket_id: activeTicket.id, text }, currentUser.id);
    setSending(false);
    if (r?.error) {
      alert("Не отправилось: " + r.error);
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(text);
    }
  };

  // ===== Detail view =====
  if (activeTicket) {
    return (
      <div className="fixed inset-0 z-[260] bg-background flex flex-col animate-fade-in">
        <div className="flex items-center gap-2 px-3 py-2 glass-strong border-b border-white/5" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
          <button onClick={() => setActiveTicket(null)} className="p-2 rounded-xl hover:bg-white/8">
            <Icon name="ChevronLeft" size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Icon name="LifeBuoy" size={14} className="text-violet-400" />
              <span className="font-semibold text-sm truncate">Поддержка Nova</span>
              {activeTicket.status === "closed" && (
                <span className="text-[10px] bg-zinc-500/20 text-zinc-300 px-2 py-0.5 rounded-full">закрыт</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{activeTicket.subject}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="text-center text-[11px] text-muted-foreground py-2">
            Тикет #{activeTicket.id} · открыт {fmtTime(activeTicket.created_at)}
          </div>
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.is_admin ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-snug ${m.is_admin ? "bg-violet-500/15 border border-violet-500/20 text-foreground rounded-tl-md" : "grad-primary text-white rounded-tr-md"}`}>
                {m.is_admin && (
                  <div className="text-[10px] font-bold text-violet-300 mb-0.5 flex items-center gap-1">
                    <Icon name="Shield" size={10} /> Поддержка
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <div className={`text-[10px] mt-1 ${m.is_admin ? "text-muted-foreground" : "text-white/70"}`}>
                  {new Date(m.created_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {activeTicket.status === "closed" ? (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-white/5">
            Тикет закрыт. Создайте новый, если есть ещё вопросы.
          </div>
        ) : (
          <div className="p-3 glass-strong border-t border-white/5 flex items-center gap-2" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
              placeholder="Напишите сообщение..."
              className="flex-1 glass rounded-2xl px-4 py-2.5 text-sm outline-none"
            />
            <button
              onClick={sendMsg}
              disabled={!input.trim() || sending}
              className="w-11 h-11 grad-primary rounded-2xl flex items-center justify-center text-white disabled:opacity-50"
            >
              {sending
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Icon name="Send" size={16} />}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ===== List view =====
  return (
    <div className="fixed inset-0 z-[260] bg-background flex flex-col animate-fade-in">
      <div className="flex items-center gap-2 px-3 py-2 glass-strong border-b border-white/5" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <Icon name="LifeBuoy" size={18} className="text-violet-400" />
          <h2 className="font-bold text-base">{tr("nav.support")}</h2>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="p-2 rounded-xl grad-primary text-white"
          title="Новый тикет"
        >
          <Icon name="Plus" size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {!showNew && tickets.length === 0 && !loading && (
          <div className="text-center pt-12">
            <div className="w-20 h-20 mx-auto rounded-3xl grad-primary flex items-center justify-center mb-4 glow-primary">
              <Icon name="LifeBuoy" size={36} className="text-white" />
            </div>
            <h3 className="font-bold text-lg mb-1">Привет, {currentUser.name}!</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
              Если что-то не работает или есть идеи — напиши в поддержку. Обычно отвечаем за пару часов.
            </p>
            <button
              onClick={() => setShowNew(true)}
              className="px-5 py-2.5 grad-primary rounded-xl text-white font-bold text-sm inline-flex items-center gap-2"
            >
              <Icon name="MessageSquare" size={14} /> Написать в поддержку
            </button>
          </div>
        )}

        {showNew && (
          <div className="glass rounded-2xl p-4 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Новый тикет</h3>
              <button onClick={() => setShowNew(false)} className="p-1 rounded-lg hover:bg-white/8">
                <Icon name="X" size={14} />
              </button>
            </div>
            <input
              value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
              placeholder="Тема (например, «Не работают звонки»)"
              className="w-full glass rounded-xl px-3 py-2 text-sm outline-none"
            />
            <textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="Опиши проблему или вопрос подробно..."
              className="w-full glass rounded-xl px-3 py-2 text-sm outline-none resize-none"
              rows={5}
            />
            <button
              onClick={createTicket}
              disabled={creating || !newText.trim()}
              className="w-full grad-primary rounded-xl py-2.5 text-white font-bold text-sm disabled:opacity-50"
            >
              {creating ? "Отправляем..." : "Отправить"}
            </button>
          </div>
        )}

        {tickets.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTicket(t)}
            className="w-full glass rounded-2xl p-3 flex items-start gap-3 hover:bg-white/5 transition text-left"
          >
            <div className="w-11 h-11 rounded-2xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
              <Icon name={t.status === "closed" ? "CheckCircle2" : "MessageSquare"} size={18} className={t.status === "closed" ? "text-emerald-400" : "text-violet-400"} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate flex-1">{t.subject || "Без темы"}</span>
                {t.unread > 0 && (
                  <span className="px-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {t.unread}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{t.last_text || "—"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{fmtTime(t.last_message_at)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}