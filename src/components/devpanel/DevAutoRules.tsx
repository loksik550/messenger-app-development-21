import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface Rule {
  id: number;
  name: string;
  trigger_kind: string;
  threshold: number;
  window_hours: number;
  action: string;
  action_days: number;
  enabled: boolean;
  fired_count: number;
  last_fired_at: number | null;
}

interface Hit {
  id: number;
  user_id: number;
  user_name: string;
  rule: string;
  detail: string;
  ts: number;
}

const TRIGGERS: Record<string, { label: string; unit: string; icon: string }> = {
  reports: { label: "Жалобы на человека", unit: "жалоб", icon: "Flag" },
  msg_rate: { label: "Слишком много сообщений", unit: "сообщений", icon: "Zap" },
  mod_hits: { label: "Запрещённые слова", unit: "нарушений", icon: "ShieldAlert" },
};

const ACTIONS: Record<string, { label: string; cls: string }> = {
  ban: { label: "Заблокировать", cls: "text-red-400" },
  freeze: { label: "Заморозить на сутки", cls: "text-amber-400" },
  notify: { label: "Только сообщить мне", cls: "text-sky-400" },
};

export default function DevAutoRules({ can }: { can: (p: string) => boolean }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [hits24, setHits24] = useState(0);
  const [tab, setTab] = useState<"rules" | "hits">("rules");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Partial<Rule> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const canWrite = can("settings");

  const load = () => {
    setLoading(true);
    Promise.all([
      devApi<{ rules: Rule[]; hits_24h: number }>("auto_rules"),
      devApi<{ items: Hit[] }>("auto_rule_hits"),
    ])
      .then(([r, h]) => {
        setRules(r.rules);
        setHits24(r.hits_24h);
        setHits(h.items);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async (r: Partial<Rule>) => {
    setBusy(true);
    try {
      await devApi("auto_rule_save", {
        id: r.id, name: r.name, trigger_kind: r.trigger_kind,
        threshold: r.threshold, window_hours: r.window_hours,
        rule_action: r.action, action_days: r.action_days, enabled: r.enabled,
      });
      setEdit(null);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const r = await devApi<{ count: number; checked: number }>("auto_rule_run");
      setMsg(
        r.count === 0
          ? `Проверил ${r.checked} правил — нарушителей нет`
          : `Сработало ${r.count} раз, меры приняты`,
      );
      setTimeout(() => setMsg(""), 5000);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Не удалось проверить");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Удалить это правило?")) return;
    await devApi("auto_rule_delete", { id });
    load();
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  const active = rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-4">
      <div className="bg-violet-500/[0.07] border border-violet-500/20 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-300 flex items-center justify-center shrink-0">
          <Icon name="Bot" size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm">Правила работают за вас</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Вы задаёте условие — «три жалобы за сутки» — и что делать.
            Дальше нарушители наказываются сами, вам приходит уведомление.
          </p>
          <div className="flex gap-4 mt-2.5 text-xs">
            <span className="text-slate-500">
              Включено: <span className="text-slate-300 font-semibold">{active}</span> из {rules.length}
            </span>
            <span className="text-slate-500">
              Сработало за сутки: <span className="text-slate-300 font-semibold">{hits24}</span>
            </span>
          </div>
        </div>
      </div>

      {msg && (
        <div className="flex items-start gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
          <Icon name="CircleCheck" size={16} className="mt-0.5 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-white/[0.03] border border-white/8 rounded-xl p-1">
          {(["rules", "hits"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs transition ${
                tab === t ? "bg-violet-600/25 text-violet-200" : "text-slate-400"
              }`}
            >
              {t === "rules" ? "Правила" : "Что сработало"}
            </button>
          ))}
        </div>

        {canWrite && (
          <div className="flex gap-2 ml-auto flex-wrap">
            <button
              onClick={runNow}
              disabled={busy || active === 0}
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs hover:bg-white/10 transition disabled:opacity-40 flex items-center gap-2"
            >
              <Icon name="Play" size={14} />
              Проверить сейчас
            </button>
            <button
              onClick={() => setEdit({
                name: "", trigger_kind: "reports", threshold: 3,
                window_hours: 24, action: "notify", action_days: 7, enabled: true,
              })}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold flex items-center gap-2"
            >
              <Icon name="Plus" size={14} />
              Новое правило
            </button>
          </div>
        )}
      </div>

      {tab === "rules" ? (
        rules.length === 0 ? (
          <Empty
            icon="Bot" title="Правил пока нет"
            text="Создайте первое — например, блокировать после трёх жалоб"
          />
        ) : (
          <div className="space-y-2">
            {rules.map((r) => {
              const tr = TRIGGERS[r.trigger_kind] || TRIGGERS.reports;
              const ac = ACTIONS[r.action] || ACTIONS.notify;
              return (
                <div
                  key={r.id}
                  className={`bg-white/[0.03] border rounded-2xl p-4 transition ${
                    r.enabled ? "border-violet-500/25" : "border-white/8 opacity-70"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      r.enabled ? "bg-violet-500/15 text-violet-300" : "bg-white/5 text-slate-500"
                    }`}>
                      <Icon name={tr.icon} size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Если {tr.label.toLowerCase()}: {r.threshold} {tr.unit} за{" "}
                        {r.window_hours === 1 ? "час" : `${r.window_hours} ч`} →{" "}
                        <span className={ac.cls}>
                          {ac.label.toLowerCase()}
                          {r.action === "ban" && r.action_days ? ` на ${r.action_days} дн.` : ""}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1.5">
                        Сработало {r.fired_count} раз
                        {r.last_fired_at ? ` · последний раз ${formatTs(r.last_fired_at)}` : ""}
                      </div>
                    </div>

                    {canWrite && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => save({ ...r, enabled: !r.enabled })}
                          disabled={busy}
                          title={r.enabled ? "Выключить" : "Включить"}
                          className={`w-11 h-6 rounded-full transition relative ${
                            r.enabled ? "bg-violet-600" : "bg-white/10"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                              r.enabled ? "left-[22px]" : "left-0.5"
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => setEdit(r)}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
                          title="Изменить"
                        >
                          <Icon name="Pencil" size={13} className="text-slate-400" />
                        </button>
                        <button
                          onClick={() => remove(r.id)}
                          className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition"
                          title="Удалить"
                        >
                          <Icon name="Trash2" size={13} className="text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : hits.length === 0 ? (
        <Empty
          icon="ShieldCheck" title="Пока ничего не сработало"
          text="Это хорошо — значит, нарушителей нет"
        />
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          {hits.map((h) => (
            <div
              key={h.id}
              className="flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                <Icon name="Gavel" size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">
                  {h.user_name}
                  <span className="text-slate-600 text-xs ml-1.5">ID {h.user_id}</span>
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {h.rule} · {h.detail}
                </div>
              </div>
              <div className="text-[11px] text-slate-600 shrink-0">{formatTs(h.ts)}</div>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <RuleDialog
          rule={edit}
          busy={busy}
          onSave={save}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}

function RuleDialog({
  rule, busy, onSave, onClose,
}: {
  rule: Partial<Rule>;
  busy: boolean;
  onSave: (r: Partial<Rule>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<Partial<Rule>>(rule);
  const tr = TRIGGERS[f.trigger_kind || "reports"];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#12131f] border border-white/10 rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">{f.id ? "Изменить правило" : "Новое правило"}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <Icon name="X" size={18} />
          </button>
        </div>

        <label className="text-xs text-slate-500 mb-1.5 block">Название</label>
        <input
          value={f.name || ""}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          placeholder="Например: много жалоб — блокировать"
          className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50 transition mb-4 placeholder-slate-600"
        />

        <label className="text-xs text-slate-500 mb-1.5 block">Когда срабатывает</label>
        <div className="space-y-1.5 mb-4">
          {Object.entries(TRIGGERS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setF({ ...f, trigger_kind: k })}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition ${
                f.trigger_kind === k
                  ? "bg-violet-600/15 border-violet-500/40"
                  : "bg-white/[0.03] border-white/8"
              }`}
            >
              <Icon name={v.icon} size={15} className="text-slate-400 shrink-0" />
              <span className="text-xs">{v.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">
              Сколько {tr?.unit}
            </label>
            <input
              type="number"
              min={1}
              value={f.threshold || 1}
              onChange={(e) => setF({ ...f, threshold: Number(e.target.value) })}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">За сколько часов</label>
            <select
              value={f.window_hours || 24}
              onChange={(e) => setF({ ...f, window_hours: Number(e.target.value) })}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none"
            >
              <option value={1}>1 час</option>
              <option value={6}>6 часов</option>
              <option value={24}>сутки</option>
              <option value={168}>неделю</option>
            </select>
          </div>
        </div>

        <label className="text-xs text-slate-500 mb-1.5 block">Что сделать</label>
        <div className="space-y-1.5 mb-4">
          {Object.entries(ACTIONS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setF({ ...f, action: k })}
              className={`w-full px-3 py-2.5 rounded-xl border text-left text-xs transition ${
                f.action === k
                  ? "bg-violet-600/15 border-violet-500/40"
                  : "bg-white/[0.03] border-white/8"
              }`}
            >
              <span className={v.cls}>{v.label}</span>
            </button>
          ))}
        </div>

        {f.action === "ban" && (
          <div className="mb-4">
            <label className="text-xs text-slate-500 mb-1.5 block">На сколько дней</label>
            <div className="flex gap-1.5">
              {[1, 7, 30, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => setF({ ...f, action_days: d })}
                  className={`flex-1 py-2 rounded-xl text-xs border transition ${
                    f.action_days === d
                      ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                      : "bg-white/[0.03] border-white/8 text-slate-400"
                  }`}
                >
                  {d === 365 ? "навсегда" : d}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between bg-white/[0.03] border border-white/8 rounded-xl px-3.5 py-3 mb-4">
          <span className="text-xs">Включить сразу</span>
          <button
            onClick={() => setF({ ...f, enabled: !f.enabled })}
            className={`w-11 h-6 rounded-full transition relative ${
              f.enabled ? "bg-violet-600" : "bg-white/10"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                f.enabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm"
          >
            Отмена
          </button>
          <button
            onClick={() => onSave(f)}
            disabled={busy || !f.name?.trim()}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold disabled:opacity-40"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

export function Empty({
  icon, title, text, action,
}: {
  icon: string;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/8 flex items-center justify-center mx-auto mb-4">
        <Icon name={icon} size={24} className="text-slate-600" />
      </div>
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">{text}</div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-200 text-xs font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
