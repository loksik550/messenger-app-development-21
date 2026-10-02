import { useState } from "react";
import Icon from "@/components/ui/icon";

export function Pick({
  label, value, options, onPick,
}: {
  label: string;
  value?: string;
  options: [string, string][];
  onPick: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[11px] text-slate-600 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, t]) => (
          <button
            key={v}
            onClick={() => onPick(value === v ? "" : v)}
            className={`px-2 py-1 rounded-lg text-[11px] border transition ${
              value === v
                ? "bg-violet-600/25 border-violet-500/40 text-violet-200"
                : "bg-white/[0.03] border-white/8 text-slate-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Box({ checked }: { checked: boolean }) {
  return (
    <span
      className={`w-4 h-4 rounded border flex items-center justify-center transition ${
        checked ? "bg-violet-500 border-violet-500" : "border-white/20"
      }`}
    >
      {checked && <Icon name="Check" size={11} className="text-white" />}
    </span>
  );
}

export function BulkDialog({
  count, busy, onRun, onClose,
}: {
  count: number;
  busy: boolean;
  onRun: (bulk: string, days?: number) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState(7);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#12131f] border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold">Действие для {count} чел.</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <Icon name="X" size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Применится сразу ко всем выбранным</p>

        <div className="mb-4">
          <label className="text-xs text-slate-500 mb-1.5 block">Срок, дней</label>
          <div className="flex gap-1.5">
            {[7, 30, 90, 365].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`flex-1 py-2 rounded-xl text-xs border transition ${
                  days === d
                    ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                    : "bg-white/[0.03] border-white/8 text-slate-400"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <BulkBtn
            icon="Crown" label={`Продлить Premium на ${days} дн.`}
            cls="bg-amber-500/15 border-amber-500/25 text-amber-300"
            disabled={busy}
            onClick={() => onRun("premium", days)}
          />
          <BulkBtn
            icon="LogOut" label="Выйти со всех устройств"
            cls="bg-white/5 border-white/10 text-slate-300"
            disabled={busy}
            onClick={() => onRun("logout")}
          />
          <BulkBtn
            icon="ShieldCheck" label="Снять блокировку"
            cls="bg-emerald-500/15 border-emerald-500/25 text-emerald-300"
            disabled={busy}
            onClick={() => onRun("unban")}
          />
          <BulkBtn
            icon="Ban" label={`Заблокировать на ${days} дн.`}
            cls="bg-red-500/15 border-red-500/25 text-red-300"
            disabled={busy}
            onClick={() => {
              if (!confirm(`Заблокировать ${count} чел. на ${days} дней?`)) return;
              onRun("ban", days);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function BulkBtn({
  icon, label, cls, disabled, onClick,
}: {
  icon: string;
  label: string;
  cls: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center gap-2 disabled:opacity-40 transition hover:brightness-125 ${cls}`}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
}
