import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum, formatTs } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";
import { Toggle } from "./DevPlans";

interface Rule {
  id: number;
  word: string;
  action: string;
  created_at: number;
}

interface Hit {
  id: number;
  user_id: number;
  user_name: string;
  word: string;
  action: string;
  snippet: string;
  created_at: number;
}

interface Cfg {
  moderation_enabled: boolean;
  antispam_enabled: boolean;
  antispam_max_per_min: number;
}

export default function DevModeration({ can }: { can: (p: string) => boolean }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [hits24h, setHits24h] = useState(0);
  const [word, setWord] = useState("");
  const [mode, setMode] = useState<"block" | "flag">("block");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"rules" | "hits">("rules");
  const [saved, setSaved] = useState(false);

  const editable = can("settings");

  const load = async () => {
    setLoading(true);
    try {
      const r = await devApi<{ rules: Rule[]; settings: Cfg; hits_24h: number }>("mod_rules");
      setRules(r.rules);
      setCfg(r.settings);
      setHits24h(r.hits_24h);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const loadHits = async () => {
    const r = await devApi<{ items: Hit[] }>("mod_hits");
    setHits(r.items);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab === "hits") loadHits();
  }, [tab]);

  const addWord = async () => {
    if (word.trim().length < 2) return;
    setBusy(true);
    try {
      await devApi("mod_rule_add", { word: word.trim(), rule_action: mode });
      setWord("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const saveCfg = async (next: Cfg) => {
    setCfg(next);
    await devApi("mod_settings_save", { ...next });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox label="Стоп-слов в списке" value={formatNum(rules.length)} icon="ShieldCheck" />
        <StatBox label="Срабатываний за сутки" value={formatNum(hits24h)} icon="ShieldAlert" warn={hits24h > 0} />
        <StatBox
          label="Лимит сообщений"
          value={cfg?.antispam_enabled ? `${cfg.antispam_max_per_min} в мин` : "выключен"}
          icon="Gauge"
        />
      </div>

      {cfg && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 max-w-xl">
          <h3 className="font-semibold mb-1">Как работает защита</h3>
          <p className="text-xs text-slate-500 mb-4">
            Сообщения со стоп-словами не отправляются, автор видит предупреждение
          </p>

          <div className="space-y-3">
            <Toggle
              label="Проверять сообщения на стоп-слова"
              value={cfg.moderation_enabled}
              onChange={(v) => editable && saveCfg({ ...cfg, moderation_enabled: v })}
            />
            <Toggle
              label="Ограничивать частоту сообщений"
              value={cfg.antispam_enabled}
              onChange={(v) => editable && saveCfg({ ...cfg, antispam_enabled: v })}
            />
          </div>

          {cfg.antispam_enabled && (
            <div className="mt-4">
              <label className="text-xs text-slate-500 mb-2 block">
                Не больше {cfg.antispam_max_per_min} сообщений в минуту от одного человека
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {[15, 30, 60, 120].map((n) => (
                  <button
                    key={n}
                    onClick={() => editable && saveCfg({ ...cfg, antispam_max_per_min: n })}
                    className={`px-3.5 py-2 rounded-xl text-xs border transition ${
                      cfg.antispam_max_per_min === n
                        ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                        : "bg-white/[0.03] border-white/8 text-slate-400 hover:bg-white/[0.06]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 mt-3">
              <Icon name="Check" size={14} />
              Сохранено
            </div>
          )}
          {!editable && (
            <p className="text-xs text-slate-600 mt-3">Менять настройки может владелец панели</p>
          )}
        </div>
      )}

      <div className="flex gap-1.5">
        {([
          ["rules", "Стоп-слова"],
          ["hits", "Что заблокировали"],
        ] as ["rules" | "hits", string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition ${
              tab === k
                ? "bg-violet-600/20 border border-violet-500/40 text-violet-200"
                : "bg-white/[0.03] border border-white/8 text-slate-400 hover:bg-white/[0.06]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "rules" ? (
        <>
          {editable && (
            <div className="flex gap-2 max-w-xl flex-wrap">
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addWord()}
                placeholder="Слово или фраза"
                className="flex-1 min-w-[160px] bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 placeholder-slate-600"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => setMode("block")}
                  className={`px-3 py-2.5 rounded-xl text-xs border transition ${
                    mode === "block"
                      ? "bg-red-500/15 border-red-500/30 text-red-300"
                      : "bg-white/[0.03] border-white/8 text-slate-400"
                  }`}
                >
                  Блокировать
                </button>
                <button
                  onClick={() => setMode("flag")}
                  className={`px-3 py-2.5 rounded-xl text-xs border transition ${
                    mode === "flag"
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                      : "bg-white/[0.03] border-white/8 text-slate-400"
                  }`}
                >
                  Только отметить
                </button>
              </div>
              <button
                onClick={addWord}
                disabled={busy || word.trim().length < 2}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-xs font-semibold disabled:opacity-40"
              >
                Добавить
              </button>
            </div>
          )}

          <p className="text-xs text-slate-500">
            «Блокировать» — сообщение не отправится. «Только отметить» — дойдёт, но вы увидите его здесь.
          </p>

          {rules.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                <Icon name="ShieldCheck" size={24} className="text-slate-600" />
              </div>
              <p className="text-sm font-medium mb-1">Список пуст</p>
              <p className="text-xs text-slate-500">Добавьте слова, которых не должно быть в переписке</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                    r.action === "block"
                      ? "bg-red-500/10 border-red-500/20"
                      : "bg-amber-500/10 border-amber-500/20"
                  }`}
                >
                  <Icon
                    name={r.action === "block" ? "Ban" : "Flag"}
                    size={13}
                    className={r.action === "block" ? "text-red-400" : "text-amber-400"}
                  />
                  <span className="text-sm">{r.word}</span>
                  {editable && (
                    <button
                      onClick={async () => {
                        await devApi("mod_rule_delete", { id: r.id });
                        load();
                      }}
                      className="text-slate-500 hover:text-slate-300 ml-1"
                    >
                      <Icon name="X" size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : hits.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
            <Icon name="ShieldCheck" size={24} className="text-slate-600" />
          </div>
          <p className="text-sm font-medium mb-1">Нарушений не было</p>
          <p className="text-xs text-slate-500">Здесь появятся заблокированные сообщения</p>
        </div>
      ) : (
        <div className="space-y-2">
          {hits.map((h) => (
            <div key={h.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  h.action === "block"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
              >
                <Icon name={h.action === "block" ? "Ban" : "Flag"} size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{h.user_name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                    {h.word}
                  </span>
                </div>
                {h.snippet && (
                  <div className="text-xs text-slate-500 mt-1 line-clamp-2 break-words">
                    {h.snippet}
                  </div>
                )}
                <div className="text-[11px] text-slate-600 mt-1">{formatTs(h.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, icon, warn }: { label: string; value: string; icon: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-3 border ${
      warn ? "bg-amber-500/10 border-amber-500/25" : "bg-white/[0.03] border-white/10"
    }`}>
      <Icon name={icon} size={15} className={warn ? "text-amber-400 mb-1.5" : "text-slate-500 mb-1.5"} />
      <div className={`text-lg font-bold ${warn ? "text-amber-300" : ""}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
