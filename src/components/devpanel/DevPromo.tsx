import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum, formatTs } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";
import { Field, Inp, Toggle } from "./DevPlans";
import { GiftPremium, ReferralBlock, Empty } from "./DevPromoParts";

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

export interface RefSettings {
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
