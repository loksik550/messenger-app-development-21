import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";

const PRESETS = [10, 25, 50, 100];

export function GiftSendModal({ currentUser, chatId, onClose, onSent, onUserUpdate }: {
  currentUser: User;
  chatId: number;
  onClose: () => void;
  onSent: () => void;
  onUserUpdate?: (u: User) => void;
}) {
  const [qty, setQty] = useState<string>("10");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lightning, setLightning] = useState<number>(currentUser.lightning_balance || 0);

  useEffect(() => {
    api("lightning_balance", {}, currentUser.id).then(r => {
      if (typeof r.lightning === "number") setLightning(r.lightning);
    });
  }, [currentUser.id]);

  const send = async () => {
    setError("");
    const q = parseInt(qty, 10);
    if (!q || q < 1) { setError("Минимум 1 ⚡"); return; }
    if (q > lightning) { setError(`У тебя только ${lightning} ⚡`); return; }
    setBusy(true);
    const r = await api("lightning_send_to_chat", { quantity: q, chat_id: chatId, message: msg }, currentUser.id);
    setBusy(false);
    if (r.msg_id) {
      const userR = await api("get_me", {}, currentUser.id);
      if (userR.user) {
        onUserUpdate?.(userR.user);
        localStorage.setItem("nova_user", JSON.stringify(userR.user));
      }
      onSent();
      onClose();
    } else {
      setError(r.error || "Не удалось отправить");
    }
  };

  return (
    <div className="fixed inset-0 z-[290] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in" onClick={onClose} style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
      <div className="glass-strong rounded-3xl p-5 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-lg flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            Подарить молнии
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="rounded-2xl p-3 mb-3 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.10))" }}>
          <span className="text-xs text-muted-foreground">Твой баланс</span>
          <span className="font-black text-amber-400">{lightning} ⚡</span>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-2">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setQty(String(p))}
              className={`py-2 rounded-xl text-sm font-bold transition ${
                parseInt(qty) === p ? "bg-amber-500 text-white" : "bg-white/5"
              }`}>
              {p} ⚡
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 mb-2">
          <Icon name="Zap" size={14} className="text-amber-400" />
          <input type="number" value={qty} onChange={e => setQty(e.target.value)}
            min="1" max="100000" placeholder="Количество ⚡"
            className="flex-1 bg-transparent outline-none text-sm font-semibold" />
        </div>

        <input value={msg} onChange={e => setMsg(e.target.value)} maxLength={200}
          placeholder="Сообщение к подарку (необязательно)"
          className="w-full bg-white/5 rounded-xl px-3 py-2.5 outline-none text-xs mb-3" />

        {error && <p className="text-xs text-red-400 text-center mb-2">{error}</p>}

        <button onClick={send} disabled={busy || !parseInt(qty)}
          className="w-full py-3 rounded-2xl font-black text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
          {busy ? "Отправляем..." : `Подарить ${qty || 0} ⚡`}
        </button>
      </div>
    </div>
  );
}

export function FundraiserAttachModal({ currentUser, chatId, onClose, onSent, onCreate }: {
  currentUser: User;
  chatId: number;
  onClose: () => void;
  onSent: () => void;
  onCreate: () => void;
}) {
  const [list, setList] = useState<{ id: number; title: string; target_amount: number; collected_amount: number; status: string; cover_url?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("my_fundraisers", {}, currentUser.id).then(r => {
      if (Array.isArray(r.fundraisers)) setList(r.fundraisers);
      setLoading(false);
    });
  }, [currentUser.id]);

  const attach = async (f: typeof list[number]) => {
    setBusy(true); setError("");
    const r = await api("send_message", {
      chat_id: chatId,
      kind: "fundraiser",
      payload: {
        fundraiser_id: f.id,
        title: f.title,
        target_amount: f.target_amount,
        collected_amount: f.collected_amount,
        cover_url: f.cover_url || null,
      },
      text: `❤️ Сбор: ${f.title}`,
    }, currentUser.id);
    setBusy(false);
    if (r.id) { onSent(); onClose(); }
    else setError(r.error || "Ошибка отправки");
  };

  return (
    <div className="fixed inset-0 z-[290] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in" onClick={onClose} style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
      <div className="glass-strong rounded-3xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-lg flex items-center gap-2">
            <Icon name="HandHeart" size={20} className="text-pink-400" />
            Прикрепить сбор
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8">
            <Icon name="X" size={16} />
          </button>
        </div>

        <button onClick={onCreate}
          className="w-full p-3 mb-3 rounded-2xl border-2 border-dashed border-pink-400/40 text-pink-400 text-sm font-bold flex items-center justify-center gap-2 hover:bg-pink-500/5">
          <Icon name="Plus" size={16} />
          Создать новый сбор
        </button>

        {loading && <div className="text-center text-sm text-muted-foreground py-4">Загружаем...</div>}

        {!loading && list.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-4">
            У тебя пока нет сборов
          </div>
        )}

        <div className="space-y-2">
          {list.map(f => {
            const pct = Math.min(100, Math.round((f.collected_amount / f.target_amount) * 100));
            return (
              <button key={f.id} onClick={() => attach(f)} disabled={busy}
                className="w-full flex items-center gap-3 p-3 glass rounded-2xl hover:bg-white/8 text-left disabled:opacity-50">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center flex-shrink-0">
                  {f.cover_url ? <img src={f.cover_url} alt="" className="w-full h-full object-cover" /> : <Icon name="HandHeart" size={20} className="text-pink-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{f.title}</div>
                  <div className="text-[10px] text-muted-foreground">{f.collected_amount.toLocaleString("ru")} / {f.target_amount.toLocaleString("ru")} ₽ · {pct}%</div>
                  <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div className="h-full grad-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {f.status === "closed" && <span className="text-[9px] px-1.5 py-0.5 bg-zinc-500/20 text-muted-foreground rounded">Закрыт</span>}
              </button>
            );
          })}
        </div>

        {error && <p className="text-xs text-red-400 text-center mt-2">{error}</p>}
      </div>
    </div>
  );
}
