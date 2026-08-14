import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface Step {
  key: string;
  label: string;
  value: number;
  percent: number;
  drop: number;
}

interface Week {
  label: string;
  total: number;
  back: number;
  percent: number;
}

interface Retention {
  weeks: Week[];
  dau: number;
  mau: number;
  sleeping: number;
  stickiness: number;
}

const STEP_COLOR = ["from-violet-500 to-purple-600", "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600"];

export default function DevGrowth({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [ret, setRet] = useState<Retention | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (d: number) => {
    setLoading(true);
    Promise.all([
      devApi<{ steps: Step[] }>("funnel", { days: d }),
      devApi<Retention>("retention"),
    ])
      .then(([f, r]) => {
        setSteps(f.steps);
        setRet(r);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(days);
  }, [days]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={() => load(days)} />;

  const worst = steps.reduce(
    (acc, s, i) => (i > 0 && s.drop > (steps[acc]?.drop ?? 0) ? i : acc),
    0,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-500">Период:</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-xl text-xs border transition ${
              days === d
                ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                : "bg-white/[0.03] border-white/8 text-slate-400 hover:bg-white/[0.06]"
            }`}
          >
            {d} дней
          </button>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
        <div className="mb-1">
          <h3 className="font-semibold">Путь пользователя</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Сколько людей доходит до каждого шага
          </p>
        </div>

        <div className="space-y-3 mt-4">
          {steps.map((s, i) => (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="text-sm truncate">{s.label}</span>
                <span className="text-sm font-semibold shrink-0">
                  {formatNum(s.value)}
                  <span className="text-slate-500 font-normal text-xs ml-1.5">
                    {s.percent}%
                  </span>
                </span>
              </div>
              <div className="h-8 bg-black/25 rounded-xl overflow-hidden relative">
                <div
                  className={`h-full bg-gradient-to-r ${STEP_COLOR[i] || STEP_COLOR[0]} transition-all duration-500 rounded-xl`}
                  style={{ width: `${Math.max(s.percent, 2)}%` }}
                />
              </div>
              {i > 0 && s.drop > 0 && (
                <div className={`text-[11px] mt-1 flex items-center gap-1 ${
                  i === worst ? "text-red-400" : "text-slate-600"
                }`}>
                  <Icon name="TrendingDown" size={11} />
                  Потеряли {s.drop}% с прошлого шага
                  {i === worst && " — самое слабое место"}
                </div>
              )}
            </div>
          ))}
        </div>

        {steps.length > 0 && steps[worst]?.drop > 0 && (
          <div className="mt-4 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <Icon name="Lightbulb" size={15} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-slate-400 leading-relaxed">
              Больше всего людей теряется на шаге «{steps[worst].label.toLowerCase()}».
              {worst === 1 && " Стоит упростить первый шаг после регистрации."}
              {worst === 2 && " Людям не хватает причин вернуться — попробуйте рассылку."}
              {worst === 3 && " Premium не выглядит нужным — проверьте цену и что входит."}
            </div>
          </div>
        )}
      </div>

      {ret && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric
              label="Активны сегодня" value={formatNum(ret.dau)}
              icon="Sun" hint="человек за сутки"
            />
            <Metric
              label="Активны за месяц" value={formatNum(ret.mau)}
              icon="CalendarDays" hint="человек за 30 дней"
            />
            <Metric
              label="Заходят часто" value={`${ret.stickiness}%`}
              icon="Repeat"
              hint="из месячных — каждый день"
              accent={ret.stickiness >= 20}
            />
            <Metric
              label="Уснувшие" value={formatNum(ret.sleeping)}
              icon="Moon" hint="нет больше месяца"
              warn={ret.sleeping > 0}
              onClick={() => onNavigate?.("broadcast")}
            />
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <div className="mb-4">
              <h3 className="font-semibold">Возвращаются ли новые люди</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Из тех, кто зарегистрировался, сколько заходило на этой неделе
              </p>
            </div>

            <div className="space-y-3">
              {ret.weeks.map((w) => (
                <div key={w.label}>
                  <div className="flex items-center justify-between mb-1.5 gap-2 text-sm">
                    <span className="text-slate-400 truncate">{w.label}</span>
                    <span className="shrink-0">
                      {w.back} из {w.total}
                      <span className={`ml-1.5 font-semibold ${
                        w.percent >= 40 ? "text-emerald-400"
                          : w.percent >= 15 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {w.percent}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-black/25 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        w.percent >= 40 ? "bg-emerald-500"
                          : w.percent >= 15 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${Math.max(w.percent, 1)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-[11px] text-slate-600 leading-relaxed">
              Хороший показатель для мессенджера — 40% и выше. Ниже 15% означает,
              что люди пробуют приложение и не возвращаются.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label, value, icon, hint, accent, warn, onClick,
}: {
  label: string;
  value: string;
  icon: string;
  hint: string;
  accent?: boolean;
  warn?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`rounded-2xl p-4 border text-left w-full transition ${
        accent
          ? "bg-emerald-500/[0.08] border-emerald-500/25"
          : warn
            ? "bg-amber-500/[0.07] border-amber-500/20"
            : "bg-white/[0.03] border-white/10"
      } ${onClick ? "hover:brightness-125" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon name={icon} size={14} className="text-slate-500" />
        <span className="text-xs text-slate-500 truncate">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] text-slate-600 mt-0.5">{hint}</div>
    </Tag>
  );
}
