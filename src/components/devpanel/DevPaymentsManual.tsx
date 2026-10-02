import { useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi } from "@/lib/devApi";
import { Field, Inp } from "./DevPlans";

export default function ManualBlock({ editable }: { editable: boolean }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: number; name: string; phone: string }[]>([]);
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("Компенсация от команды Nova");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setFound([]);
      return;
    }
    const r = await devApi<{ users: { id: number; name: string; phone: string }[] }>("users", { query: q, limit: 6 });
    setFound(r.users);
  };

  const run = async (action: string, payload: Record<string, unknown>, msg: string) => {
    if (!picked) return;
    setBusy(true);
    setErr("");
    try {
      await devApi(action, { user_id: picked.id, ...payload });
      setDone(msg);
      setTimeout(() => setDone(""), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось выполнить");
    } finally {
      setBusy(false);
    }
  };

  if (!editable) {
    return (
      <div className="py-16 text-center">
        <Icon name="Lock" size={24} className="text-slate-600 mx-auto mb-2" />
        <p className="text-sm">Недостаточно прав</p>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      <p className="text-xs text-slate-500">
        Продлите подписку вручную — например, при сбое или как компенсацию
      </p>

      <Field label="Найдите пользователя">
        <Inp value={query} onChange={search} placeholder="Имя или телефон" />
      </Field>

      {found.length > 0 && !picked && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          {found.map((u) => (
            <button
              key={u.id}
              onClick={() => { setPicked({ id: u.id, name: u.name }); setFound([]); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.05] transition text-left border-b border-white/5 last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-xs font-bold">
                {(u.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm truncate">{u.name || "Без имени"}</div>
                <div className="text-[11px] text-slate-500">{u.phone}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {picked && (
        <div className="bg-violet-600/10 border border-violet-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Icon name="UserCheck" size={16} className="text-violet-400" />
          <span className="text-sm flex-1">{picked.name}</span>
          <button onClick={() => setPicked(null)} className="text-slate-500 hover:text-slate-300">
            <Icon name="X" size={15} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Дней">
          <Inp value={days} onChange={(v) => setDays(v.replace(/\D/g, ""))} />
        </Field>
        <Field label="Быстрый выбор">
          <div className="flex gap-1.5">
            {["7", "30", "90"].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`flex-1 py-2.5 rounded-xl text-xs border transition ${
                  days === d
                    ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                    : "bg-white/[0.03] border-white/8 text-slate-400"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Что увидит пользователь">
        <Inp value={reason} onChange={setReason} />
      </Field>

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

      <div className="space-y-2">
        <button
          onClick={() => run("subscription_extend", { days: Number(days) || 0, reason }, `Подписка продлена на ${days} дн.`)}
          disabled={busy || !picked || !days}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-bold disabled:opacity-40"
        >
          {busy ? "Выполняем..." : "Продлить подписку"}
        </button>
        <button
          onClick={() => {
            if (!confirm("Отключить Premium у этого пользователя?")) return;
            run("subscription_cancel", { reason }, "Подписка отключена");
          }}
          disabled={busy || !picked}
          className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 hover:bg-white/10 transition disabled:opacity-40"
        >
          Отключить подписку
        </button>
      </div>
    </div>
  );
}
