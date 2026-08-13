import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum, formatTs } from "@/lib/devApi";
import { Field, Inp } from "./DevPlans";

interface Sent {
  id: number;
  title: string;
  body: string;
  audience: string;
  sent: number;
  admin: string;
  created_at: number;
}

const AUDIENCES: { key: string; label: string; hint: string; icon: string }[] = [
  { key: "all", label: "Всем", hint: "Каждому, кроме заблокированных", icon: "Users" },
  { key: "premium", label: "С Premium", hint: "У кого активна подписка", icon: "Crown" },
  { key: "free", label: "Без Premium", hint: "Кому можно предложить подписку", icon: "UserPlus" },
  { key: "new_7d", label: "Новичкам", hint: "Зарегистрировались за неделю", icon: "Sparkles" },
  { key: "expiring_7d", label: "Заканчивается Premium", hint: "Истекает в ближайшую неделю", icon: "Clock" },
  { key: "inactive_30d", label: "Давно не заходили", hint: "Не были больше месяца", icon: "MoonStar" },
];

const AUDIENCE_LABEL: Record<string, string> = Object.fromEntries(
  AUDIENCES.map((a) => [a.key, a.label]),
);

export default function DevBroadcast({ can }: { can: (p: string) => boolean }) {
  const [audience, setAudience] = useState("all");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [history, setHistory] = useState<Sent[]>([]);
  const [confirm, setConfirm] = useState(false);

  const editable = can("settings");

  const loadCount = async (aud: string) => {
    try {
      const r = await devApi<{ count: number }>("broadcast_preview", { audience: aud });
      setCount(r.count);
    } catch {
      setCount(null);
    }
  };

  const loadHistory = async () => {
    try {
      const r = await devApi<{ items: Sent[] }>("broadcast_history");
      setHistory(r.items);
    } catch {
      /* нет прав — не показываем историю */
    }
  };

  useEffect(() => {
    loadCount(audience);
  }, [audience]);

  useEffect(() => {
    loadHistory();
  }, []);

  const send = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await devApi<{ sent: number }>("broadcast_send", {
        audience, title, body: text,
      });
      setDone(`Отправлено ${formatNum(r.sent)} получателям`);
      setTitle("");
      setText("");
      setConfirm(false);
      setTimeout(() => setDone(""), 5000);
      await loadHistory();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось отправить");
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  if (!editable) {
    return (
      <div className="py-16 text-center">
        <Icon name="Lock" size={24} className="text-slate-600 mx-auto mb-2" />
        <p className="text-sm">Недостаточно прав для рассылки</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        Объявление придёт в уведомления внутри приложения. Отменить отправку нельзя.
      </p>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 max-w-2xl space-y-4">
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Кому отправляем</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AUDIENCES.map((a) => (
              <button
                key={a.key}
                onClick={() => setAudience(a.key)}
                className={`text-left px-3 py-2.5 rounded-xl border transition ${
                  audience === a.key
                    ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                    : "bg-white/[0.03] border-white/8 text-slate-400 hover:bg-white/[0.06]"
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <Icon name={a.icon} size={13} />
                  {a.label}
                </span>
                <span className="block text-[10px] text-slate-600 mt-0.5 leading-tight">
                  {a.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-violet-600/10 border border-violet-500/25 rounded-xl px-4 py-3 flex items-center gap-3">
          <Icon name="Users" size={16} className="text-violet-400 shrink-0" />
          <div className="text-sm">
            Получат:{" "}
            <span className="font-bold text-violet-200">
              {count === null ? "..." : `${formatNum(count)} чел.`}
            </span>
          </div>
        </div>

        <Field label="Заголовок">
          <Inp value={title} onChange={setTitle} placeholder="Например: Новая версия Nova" />
        </Field>

        <div>
          <label className="text-xs text-slate-500 mb-1.5 block">
            Текст объявления
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Что нового или важного хотите сообщить"
            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 resize-none placeholder-slate-600"
          />
          <div className="text-[10px] text-slate-600 mt-1 text-right">
            {text.length} / 1000
          </div>
        </div>

        {(title || text) && (
          <div className="bg-black/30 border border-white/8 rounded-xl p-4">
            <div className="text-[10px] text-slate-600 mb-2">Как увидит пользователь</div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center shrink-0">
                <Icon name="Bell" size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{title || "Заголовок"}</div>
                <div className="text-xs text-slate-400 mt-0.5 whitespace-pre-wrap break-words">
                  {text || "Текст объявления"}
                </div>
              </div>
            </div>
          </div>
        )}

        {err && (
          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
            <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}
        {done && (
          <div className="flex items-start gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
            <Icon name="CircleCheck" size={16} className="mt-0.5 shrink-0" />
            <span>{done}</span>
          </div>
        )}

        <button
          onClick={() => setConfirm(true)}
          disabled={busy || !title.trim() || !text.trim() || !count}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-bold disabled:opacity-40"
        >
          {busy ? "Отправляем..." : `Отправить ${count ? formatNum(count) : ""} получателям`}
        </button>
      </div>

      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Что уже отправляли</h3>
          <div className="space-y-2 max-w-2xl">
            {history.map((h) => (
              <div key={h.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/5 text-slate-400 flex items-center justify-center shrink-0">
                    <Icon name="Send" size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{h.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{h.body}</div>
                    <div className="text-[11px] text-slate-600 mt-1.5">
                      {AUDIENCE_LABEL[h.audience] || h.audience} · {formatNum(h.sent)} чел. ·{" "}
                      {formatTs(h.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirm(false)}>
          <div className="bg-[#12131f] border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-1">Отправить рассылку?</h3>
            <p className="text-xs text-slate-500 mb-4">
              Уведомление получат {formatNum(count || 0)} человек. Отменить будет нельзя.
            </p>
            <div className="bg-black/30 border border-white/8 rounded-xl p-3 mb-4">
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-xs text-slate-400 mt-1 line-clamp-3">{text}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">
                Отмена
              </button>
              <button
                onClick={send}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Отправляем..." : "Отправить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
