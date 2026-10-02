import { useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";
import { Field, Inp, Toggle } from "./DevPlans";
import type { RefSettings } from "./DevPromo";

export function GiftPremium({ editable }: { editable: boolean }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: number; name: string; phone: string }[]>([]);
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("Подарок от команды Nova");
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

  const gift = async () => {
    if (!picked) return;
    setBusy(true);
    setErr("");
    try {
      await devApi("gift_premium", { user_id: picked.id, days: Number(days) || 0, reason });
      setDone(`${picked.name} получил Premium на ${days} дн.`);
      setPicked(null);
      setQuery("");
      setFound([]);
      setTimeout(() => setDone(""), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось выдать");
    } finally {
      setBusy(false);
    }
  };

  if (!editable) return <Empty text="Недостаточно прав" hint="Нужен доступ к настройкам" />;

  return (
    <div className="max-w-md space-y-4">
      <p className="text-xs text-slate-500">
        Выдайте Premium вручную — например, как компенсацию или подарок активному пользователю
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
        <Field label="На сколько дней">
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

      <button
        onClick={gift}
        disabled={busy || !picked || !days}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-sm font-bold disabled:opacity-40"
      >
        {busy ? "Выдаём..." : "Подарить Premium"}
      </button>
    </div>
  );
}

export function ReferralBlock({
  cfg, stats, top, editable, onSaved,
}: {
  cfg: RefSettings;
  stats: { total: number; rewarded: number };
  top: { user_id: number; name: string; invited: number }[];
  editable: boolean;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(cfg.enabled);
  const [inviterDays, setInviterDays] = useState(String(cfg.inviter_days));
  const [invitedDays, setInvitedDays] = useState(String(cfg.invited_days));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await devApi("referral_settings_save", {
        enabled,
        inviter_days: Number(inviterDays) || 0,
        invited_days: Number(invitedDays) || 0,
      });
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox label="Всего приглашений" value={formatNum(stats.total)} />
        <StatBox label="С наградой" value={formatNum(stats.rewarded)} />
        <StatBox label="Программа" value={enabled ? "Включена" : "Выключена"} />
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 max-w-md">
        <h3 className="font-semibold mb-1">Настройки программы</h3>
        <p className="text-xs text-slate-500 mb-4">
          Каждый получает свой код в профиле. Награда начисляется обоим сразу.
        </p>

        <div className="space-y-3">
          <Toggle label="Программа включена" value={enabled} onChange={setEnabled} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Дней пригласившему">
              <Inp value={inviterDays} onChange={(v) => setInviterDays(v.replace(/\D/g, ""))} />
            </Field>
            <Field label="Дней приглашённому">
              <Inp value={invitedDays} onChange={(v) => setInvitedDays(v.replace(/\D/g, ""))} />
            </Field>
          </div>
        </div>

        {editable && (
          <button
            onClick={save}
            disabled={busy}
            className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Сохраняем..." : done ? "Сохранено" : "Сохранить настройки"}
          </button>
        )}
      </div>

      {top.length > 0 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Кто больше приглашает</h3>
          <div className="space-y-2">
            {top.map((t, i) => (
              <div key={t.user_id} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-center text-slate-600 font-bold">{i + 1}</span>
                <span className="flex-1 truncate">{t.name}</span>
                <span className="text-slate-500 text-xs">{formatNum(t.invited)} чел.</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

export function Empty({ text, hint }: { text: string; hint: string }) {
  return (
    <div className="py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
        <Icon name="Ticket" size={24} className="text-slate-600" />
      </div>
      <p className="text-sm font-medium mb-1">{text}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}
