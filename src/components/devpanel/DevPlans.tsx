import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface PlanLimits {
  file_mb: number;
  storage_gb: number;
  pinned_chats: number;
  group_members: number;
  voice_minutes: number;
  devices: number;
}

export interface Plan {
  id: number;
  code: string;
  title: string;
  subtitle: string;
  badge: string;
  price: number;
  old_price: number | null;
  currency: string;
  duration_days: number;
  is_trial: boolean;
  active: boolean;
  sort_order: number;
  features: string[];
  limits: PlanLimits;
}

const EMPTY: Plan = {
  id: 0, code: "", title: "", subtitle: "", badge: "",
  price: 0, old_price: null, currency: "RUB", duration_days: 30,
  is_trial: false, active: true, sort_order: 10, features: [],
  limits: {
    file_mb: 20, storage_gb: 5, pinned_chats: 10,
    group_members: 500, voice_minutes: 15, devices: 5,
  },
};

const LIMIT_LABELS: { key: keyof PlanLimits; label: string; unit: string }[] = [
  { key: "file_mb", label: "Размер файла", unit: "МБ" },
  { key: "storage_gb", label: "Хранилище", unit: "ГБ" },
  { key: "pinned_chats", label: "Закреплённых чатов", unit: "шт" },
  { key: "group_members", label: "Участников группы", unit: "чел" },
  { key: "voice_minutes", label: "Голосовое сообщение", unit: "мин" },
  { key: "devices", label: "Устройств", unit: "шт" },
];

export default function DevPlans({ can }: { can: (p: string) => boolean }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeSubs, setActiveSubs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const editable = can("settings");

  const load = async () => {
    setLoading(true);
    try {
      const res = await devApi<{ plans: Plan[]; active_subscriptions: number }>("plans");
      setPlans(res.plans);
      setActiveSubs(res.active_subscriptions || 0);
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

  const save = async () => {
    if (!edit) return;
    setSaveErr("");
    if (!edit.code.trim() || !edit.title.trim()) {
      setSaveErr("Заполните код и название");
      return;
    }
    setBusy(true);
    try {
      await devApi("plan_save", { ...edit, features: edit.features });
      setEdit(null);
      await load();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: Plan) => {
    await devApi("plan_save", { ...p, active: !p.active });
    load();
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3">
          <div className="text-xl font-bold">{formatNum(activeSubs)}</div>
          <div className="text-xs text-slate-500">активных подписок</div>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3">
          <div className="text-xl font-bold">{plans.filter((p) => p.active).length}</div>
          <div className="text-xs text-slate-500">тарифов в продаже</div>
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={load}
            className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 transition"
          >
            <Icon name="RefreshCw" size={16} className="text-slate-400" />
          </button>
          {editable && (
            <button
              onClick={() => { setEdit({ ...EMPTY }); setSaveErr(""); }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold"
            >
              Новый тариф
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Изменения применяются в мессенджере сразу — цены и лимиты подтягиваются из этой таблицы.
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl p-5 border transition ${
              p.active
                ? "bg-white/[0.03] border-white/10"
                : "bg-white/[0.01] border-white/5 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold truncate">{p.title}</h3>
                  {p.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                      {p.badge}
                    </span>
                  )}
                  {p.is_trial && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      пробный
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5 font-mono">{p.code}</div>
              </div>
              {!p.active && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 shrink-0">
                  скрыт
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-black">
                {p.price === 0 ? "Бесплатно" : `${formatNum(p.price)} ₽`}
              </span>
              {p.old_price ? (
                <span className="text-sm text-slate-600 line-through">{formatNum(p.old_price)} ₽</span>
              ) : null}
            </div>
            <div className="text-xs text-slate-500 mb-3">
              {p.duration_days} дн. {p.subtitle ? `· ${p.subtitle}` : ""}
            </div>

            {p.features.length > 0 && (
              <ul className="space-y-1 mb-3">
                {p.features.slice(0, 4).map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                    <Icon name="Check" size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span className="truncate">{f}</span>
                  </li>
                ))}
                {p.features.length > 4 && (
                  <li className="text-[11px] text-slate-600">и ещё {p.features.length - 4}</li>
                )}
              </ul>
            )}

            <div className="grid grid-cols-3 gap-1.5 mb-3">
              <MiniLimit label="файл" value={`${p.limits.file_mb} МБ`} />
              <MiniLimit label="диск" value={`${p.limits.storage_gb} ГБ`} />
              <MiniLimit label="группа" value={formatNum(p.limits.group_members)} />
            </div>

            {editable && (
              <div className="flex gap-2">
                <button
                  onClick={() => { setEdit({ ...p }); setSaveErr(""); }}
                  className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition"
                >
                  Редактировать
                </button>
                <button
                  onClick={() => toggleActive(p)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 hover:bg-white/10 transition"
                >
                  {p.active ? "Скрыть" : "Включить"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {edit && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEdit(null)}
        >
          <div
            className="bg-[#12131f] border border-white/10 rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#12131f] px-5 py-4 border-b border-white/8 flex items-center justify-between">
              <h3 className="font-bold">{edit.id ? "Редактирование тарифа" : "Новый тариф"}</h3>
              <button onClick={() => setEdit(null)} className="text-slate-500 hover:text-slate-300">
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Код (латиницей)">
                  <Inp value={edit.code} onChange={(v) => setEdit({ ...edit, code: v })} placeholder="month" />
                </Field>
                <Field label="Название">
                  <Inp value={edit.title} onChange={(v) => setEdit({ ...edit, title: v })} placeholder="1 месяц" />
                </Field>
              </div>

              <Field label="Подпись под ценой">
                <Inp value={edit.subtitle} onChange={(v) => setEdit({ ...edit, subtitle: v })} placeholder="199 ₽/мес" />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Цена, ₽">
                  <Inp
                    value={String(edit.price)}
                    onChange={(v) => setEdit({ ...edit, price: Number(v.replace(/[^\d.]/g, "")) || 0 })}
                  />
                </Field>
                <Field label="Старая цена">
                  <Inp
                    value={edit.old_price === null ? "" : String(edit.old_price)}
                    onChange={(v) =>
                      setEdit({ ...edit, old_price: v.trim() ? Number(v.replace(/[^\d.]/g, "")) || 0 : null })
                    }
                    placeholder="—"
                  />
                </Field>
                <Field label="Дней">
                  <Inp
                    value={String(edit.duration_days)}
                    onChange={(v) => setEdit({ ...edit, duration_days: Number(v.replace(/\D/g, "")) || 0 })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Плашка">
                  <Inp value={edit.badge} onChange={(v) => setEdit({ ...edit, badge: v })} placeholder="ВЫГОДНО" />
                </Field>
                <Field label="Порядок в списке">
                  <Inp
                    value={String(edit.sort_order)}
                    onChange={(v) => setEdit({ ...edit, sort_order: Number(v.replace(/\D/g, "")) || 0 })}
                  />
                </Field>
              </div>

              <div className="flex gap-4">
                <Toggle label="Пробный период" value={edit.is_trial} onChange={(v) => setEdit({ ...edit, is_trial: v })} />
                <Toggle label="Показывать в приложении" value={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">
                  Что входит — каждый пункт с новой строки
                </label>
                <textarea
                  value={edit.features.join("\n")}
                  onChange={(e) => setEdit({ ...edit, features: e.target.value.split("\n") })}
                  rows={5}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 resize-none placeholder-slate-600"
                  placeholder={"Файлы до 20 МБ\nХранилище 5 ГБ\nРасширенный поиск"}
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-2 block">Лимиты тарифа</label>
                <div className="grid grid-cols-2 gap-3">
                  {LIMIT_LABELS.map((l) => (
                    <Field key={l.key} label={`${l.label}, ${l.unit}`}>
                      <Inp
                        value={String(edit.limits[l.key])}
                        onChange={(v) =>
                          setEdit({
                            ...edit,
                            limits: { ...edit.limits, [l.key]: Number(v.replace(/\D/g, "")) || 0 },
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
              </div>

              {saveErr && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                  <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
                  <span>{saveErr}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setEdit(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">
                  Отмена
                </button>
                <button
                  onClick={save}
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

function MiniLimit({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1.5 text-center">
      <div className="text-xs font-bold truncate">{value}</div>
      <div className="text-[9px] text-slate-600">{label}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

export function Inp({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 placeholder-slate-600"
    />
  );
}

export function Toggle({
  label, value, onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button onClick={() => onChange(!value)} className="flex items-center gap-2 text-xs">
      <span className={`w-9 h-5 rounded-full transition relative ${value ? "bg-violet-500" : "bg-white/10"}`}>
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="text-slate-400">{label}</span>
    </button>
  );
}
