import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";
import { BIRTHDAY_CARDS, GIFT_AMOUNTS, type BirthdayCardId } from "./birthdayCards";

interface Friend { id: number; name: string; avatar_url?: string | null; age?: number | null; greeted: boolean }

const todayKey = () => {
  const d = new Date();
  return `bday_hidden_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export default function BirthdayReminder({ userId, onOpenChat }: { userId: number; onOpenChat: (friendId: number) => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [balance, setBalance] = useState(0);
  const [hidden, setHidden] = useState(true);
  const [active, setActive] = useState<Friend | null>(null);
  const [card, setCard] = useState<BirthdayCardId>("balloons");
  const [qty, setQty] = useState<number>(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    setHidden(localStorage.getItem(todayKey()) === "1");
    api("birthdays_today", {}, userId).then((r) => {
      if (Array.isArray(r?.items)) setFriends(r.items);
      if (typeof r?.lightning === "number") setBalance(r.lightning);
    }).catch(() => null);
  }, [userId]);

  const pending = friends.filter((f) => !f.greeted);
  if (hidden || pending.length === 0) {
    return done ? (
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] glass-strong rounded-2xl px-4 py-3 text-sm animate-fade-in max-w-[90vw]">{done}</div>
    ) : null;
  }

  const first = pending[0];
  const hide = () => { localStorage.setItem(todayKey(), "1"); setHidden(true); };

  const open = (f: Friend) => {
    setActive(f); setError("");
    setQty(balance >= 10 ? 10 : 0);
  };

  const greet = async () => {
    if (!active) return;
    setBusy(true); setError("");
    const r = await api("birthday_greet", { friend_id: active.id, card, quantity: qty }, userId).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      setFriends((list) => list.map((f) => (f.id === active.id ? { ...f, greeted: true } : f)));
      if (typeof r.lightning === "number") setBalance(r.lightning);
      setDone(`Поздравление отправлено ${active.name} 🎉`);
      setTimeout(() => setDone(""), 3000);
      setActive(null);
    } else {
      setError(r?.error || "Не удалось отправить. Попробуйте ещё раз.");
    }
  };

  return (
    <>
      <div className="mx-2 mb-2 rounded-2xl p-3 flex items-center gap-3 animate-fade-in"
        style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.22), rgba(139,92,246,0.22))", border: "1px solid rgba(236,72,153,0.35)" }}>
        <div className="relative flex-shrink-0">
          {first.avatar_url ? (
            <img src={first.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center font-bold text-white">
              {first.name[0]?.toUpperCase()}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 text-lg">🎂</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">
            {pending.length === 1 ? `Сегодня день рождения у ${first.name}` : `Сегодня дни рождения: ${first.name} и ещё ${pending.length - 1}`}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {first.age ? `Исполняется ${first.age}. ` : ""}Поздравьте открыткой и подарком
          </div>
        </div>
        <button onClick={() => open(first)} className="px-3 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white text-xs font-semibold flex-shrink-0">
          Поздравить
        </button>
        <button onClick={hide} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground flex-shrink-0" aria-label="Скрыть">
          <Icon name="X" size={14} />
        </button>
      </div>

      {active && (
        <div className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={() => !busy && setActive(null)}>
          <div className="glass-strong w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 animate-scale-in max-h-[92vh] overflow-y-auto"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold">Поздравить {active.name}</h3>
                <p className="text-xs text-muted-foreground">Выберите открытку и подарок</p>
              </div>
              <button onClick={() => setActive(null)} disabled={busy} className="p-2 rounded-xl hover:bg-white/8"><Icon name="X" size={18} /></button>
            </div>

            {pending.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                {pending.map((f) => (
                  <button key={f.id} onClick={() => open(f)}
                    className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${f.id === active.id ? "bg-pink-500 text-white" : "glass"}`}>
                    {f.name}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4">
              {BIRTHDAY_CARDS.map((c) => (
                <button key={c.id} onClick={() => setCard(c.id)}
                  className={`relative rounded-2xl p-3 text-left text-white overflow-hidden transition ${card === c.id ? "ring-2 ring-white scale-[1.02]" : "opacity-80"}`}
                  style={{ background: c.gradient }}>
                  <div className="text-3xl mb-1">{c.emoji}</div>
                  <div className="text-sm font-bold leading-tight">{c.title}</div>
                  <div className="text-[10px] text-white/85 line-clamp-2 mt-0.5">{c.wish}</div>
                  {card === c.id && <Icon name="CircleCheck" size={16} className="absolute top-2 right-2" />}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Подарок</span>
              <span className="text-xs text-muted-foreground">Ваш баланс: ⚡ {balance}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {GIFT_AMOUNTS.map((a) => (
                <button key={a} onClick={() => setQty(a)} disabled={a > balance}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-35 ${qty === a ? "bg-amber-500 text-black" : "glass"}`}>
                  {a === 0 ? "Без" : `⚡ ${a}`}
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

            <div className="flex gap-2">
              <button onClick={() => { onOpenChat(active.id); setActive(null); }} disabled={busy}
                className="py-3 px-4 rounded-2xl glass text-sm font-medium disabled:opacity-50">
                Написать
              </button>
              <button onClick={greet} disabled={busy}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 text-white font-semibold disabled:opacity-60">
                {busy ? "Отправляем…" : qty > 0 ? `Поздравить и подарить ⚡ ${qty}` : "Отправить открытку"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
