import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum, formatTs } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";
import { Field, Inp, Toggle } from "./DevPlans";

interface Promo {
  id: number;
  code: string;
  title: string;
  kind: string;
  discount_percent: number;
  discount_amount: number;
  free_days: number;
  plan_code: string;
  max_activations: number;
  used_count: number;
  per_user_limit: number;
  expires_at: number | null;
  active: boolean;
  note: string;
  created_at: number;
}

interface Activation {
  id: number;
  code: string;
  user_id: number;
  user_name: string;
  granted_days: number;
  discount: number;
  ip: string;
  suspicious: boolean;
  reason: string;
  created_at: number;
}

interface RefSettings {
  enabled: boolean;
  inviter_days: number;
  invited_days: number;
}

const EMPTY: Promo = {
  id: 0, code: "", title: "", kind: "free_days",
  discount_percent: 0, discount_amount: 0, free_days: 7, plan_code: "",
  max_activations: 100, used_count: 0, per_user_limit: 1,
  expires_at: null, active: true, note: "", created_at: 0,
};

type Tab = "promos" | "suspicious" | "gift" | "referral";

export default function DevPromo({ can }: { can: (p: string) => boolean }) {
  const [tab, setTab] = useState<Tab>("promos");
  const [promos, setPromos] = useState<Promo[]>([]);
  const [acts, setActs] = useState<Activation[]>([]);
  const [refCfg, setRefCfg] = useState<RefSettings | null>(null);
  const [refStats, setRefStats] = useState<{ total: number; rewarded: number }>({ total: 0, rewarded: 0 });
  const [refTop, setRefTop] = useState<{ user_id: number; name: string; invited: number }[]>([]);
  const [suspCount, setSuspCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Promo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const editable = can("settings");

  const load = async () => {
    setLoading(true);
    try {
      const res = await devApi<{ promos: Promo[]; suspicious: number }>("promos");
      setPromos(res.promos);
      setSuspCount(res.suspicious || 0);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const loadActs = async (onlySusp: boolean) => {
    const r = await devApi<{ items: Activation[] }>("promo_activations", { suspicious: onlySusp });
    setActs(r.items);
  };

  const loadRef = async () => {
    const r = await devApi<{ settings: RefSettings; stats: { total: number; rewarded: number } }>("referral_settings");
    setRefCfg(r.settings);
    setRefStats(r.stats);
    const t = await devApi<{ items: { user_id: number; name: string; invited: number }[] }>("referrals_top");
    setRefTop(t.items);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab === "suspicious") loadActs(true);
    if (tab === "referral") loadRef();
  }, [tab]);

  const savePromo = async () => {
    if (!edit) return;
    if (!edit.code.trim()) {
      setMsg("Укажите код промокода");
      return;
    }
    setBusy(true);
    try {
      await devApi("promo_save", { ...edit });
      setEdit(null);
      setMsg("");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {([
          ["promos", "Промокоды", "Ticket"],
          ["suspicious", `Подозрительные${suspCount ? ` (${suspCount})` : ""}`, "ShieldAlert"],
          ["gift", "Подарить Premium", "Gift"],
          ["referral", "Рефералы", "Users"],
        ] as [Tab, string, string][]).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
              tab === k
                ? "bg-violet-600/20 border border-violet-500/40 text-violet-200"
                : "bg-white/[0.03] border border-white/8 text-slate-400 hover:bg-white/[0.06]"
            }`}
          >
            <Icon name={icon} size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === "promos" && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-slate-500">
              Пользователи вводят промокод в профиле и получают бонус автоматически
            </p>
            {editable && (
              <button
                onClick={() => { setEdit({ ...EMPTY }); setMsg(""); }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-xs font-semibold"
              >
                Создать промокод
              </button>
            )}
          </div>

          {promos.length === 0 ? (
            <Empty text="Промокодов пока нет" hint="Создайте первый — например, на 7 дней Premium бесплатно" />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {promos.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-2xl p-4 border ${
                    p.active ? "bg-white/[0.03] border-white/10" : "bg-white/[0.01] border-white/5 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-base tracking-wider text-violet-300 truncate">
                        {p.code}
                      </div>
                      {p.title && <div className="text-xs text-slate-400 mt-0.5 truncate">{p.title}</div>}
                    </div>
                    {!p.active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 shrink-0">
                        выкл
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-semibold mb-2">
                    {p.free_days > 0
                      ? `${p.free_days} дн. Premium`
                      : p.discount_percent > 0
                        ? `Скидка ${p.discount_percent}%`
                        : p.discount_amount > 0
                          ? `Скидка ${formatNum(p.discount_amount)} ₽`
                          : "Без бонуса"}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-3">
                    <span>
                      {formatNum(p.used_count)}
                      {p.max_activations > 0 ? ` / ${formatNum(p.max_activations)}` : ""} активаций
                    </span>
                    {p.expires_at ? <span>до {formatTs(p.expires_at)}</span> : null}
                  </div>

                  {p.max_activations > 0 && (
                    <div className="h-1 bg-white/5 rounded-full mb-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
                        style={{ width: `${Math.min(100, (p.used_count / p.max_activations) * 100)}%` }}
                      />
                    </div>
                  )}

                  {editable && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEdit({ ...p }); setMsg(""); }}
                        className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={async () => { await devApi("promo_toggle", { id: p.id }); load(); }}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:bg-white/10 transition"
                      >
                        {p.active ? "Выкл" : "Вкл"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "suspicious" && (
        <>
          <p className="text-xs text-slate-500">
            Активации, помеченные системой: несколько аккаунтов с одного адреса за сутки
          </p>
          {acts.length === 0 ? (
            <Empty text="Подозрительных активаций нет" hint="Система следит за накрутками автоматически" />
          ) : (
            <div className="space-y-2">
              {acts.map((a) => (
                <div
                  key={a.id}
                  className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                    <Icon name="ShieldAlert" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{a.user_name}</span>
                      <span className="font-mono text-xs text-violet-300">{a.code}</span>
                    </div>
                    <div className="text-xs text-amber-400/90 mt-1">{a.reason}</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {formatTs(a.created_at)}
                      {a.granted_days > 0 ? ` · выдано ${a.granted_days} дн.` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "gift" && <GiftPremium editable={editable} />}

      {tab === "referral" && refCfg && (
        <ReferralBlock
          cfg={refCfg}
          stats={refStats}
          top={refTop}
          editable={editable}
          onSaved={loadRef}
        />
      )}

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-[#12131f] border border-white/10 rounded-2xl w-full max-w-md max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#12131f] px-5 py-4 border-b border-white/8 flex items-center justify-between">
              <h3 className="font-bold">{edit.id ? "Промокод" : "Новый промокод"}</h3>
              <button onClick={() => setEdit(null)} className="text-slate-500 hover:text-slate-300">
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <Field label="Код (его вводит пользователь)">
                <Inp
                  value={edit.code}
                  onChange={(v) => setEdit({ ...edit, code: v.toUpperCase() })}
                  placeholder="NOVA2026"
                />
              </Field>

              <Field label="Название для себя">
                <Inp value={edit.title} onChange={(v) => setEdit({ ...edit, title: v })} placeholder="Летняя акция" />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Дней Premium">
                  <Inp
                    value={String(edit.free_days)}
                    onChange={(v) => setEdit({ ...edit, free_days: Number(v.replace(/\D/g, "")) || 0 })}
                  />
                </Field>
                <Field label="Скидка, %">
                  <Inp
                    value={String(edit.discount_percent)}
                    onChange={(v) => setEdit({ ...edit, discount_percent: Number(v.replace(/\D/g, "")) || 0 })}
                  />
                </Field>
                <Field label="Скидка, ₽">
                  <Inp
                    value={String(edit.discount_amount)}
                    onChange={(v) => setEdit({ ...edit, discount_amount: Number(v.replace(/[^\d.]/g, "")) || 0 })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Всего активаций (0 — без лимита)">
                  <Inp
                    value={String(edit.max_activations)}
                    onChange={(v) => setEdit({ ...edit, max_activations: Number(v.replace(/\D/g, "")) || 0 })}
                  />
                </Field>
                <Field label="Раз на человека">
                  <Inp
                    value={String(edit.per_user_limit)}
                    onChange={(v) => setEdit({ ...edit, per_user_limit: Number(v.replace(/\D/g, "")) || 1 })}
                  />
                </Field>
              </div>

              <Field label="Действует до">
                <input
                  type="date"
                  value={edit.expires_at ? new Date(edit.expires_at * 1000).toISOString().slice(0, 10) : ""}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      expires_at: e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000) : null,
                    })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
                />
              </Field>

              <Toggle label="Промокод активен" value={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />

              {msg && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                  <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
                  <span>{msg}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setEdit(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">
                  Отмена
                </button>
                <button
                  onClick={savePromo}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50"
                >
                  {busy ? "Сохраняем..." : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GiftPremium({ editable }: { editable: boolean }) {
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

function ReferralBlock({
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function Empty({ text, hint }: { text: string; hint: string }) {
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
