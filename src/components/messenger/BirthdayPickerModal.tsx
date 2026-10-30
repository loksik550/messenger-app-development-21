import Icon from "@/components/ui/icon";

interface Props {
  open: boolean;
  bdDay: number;
  bdMonth: number;
  bdYear: number;
  setBdDay: (n: number) => void;
  setBdMonth: (n: number) => void;
  setBdYear: (n: number) => void;
  hasBirthdate: boolean;
  savingMeta: boolean;
  onClose: () => void;
  onClear: () => void;
  onSave: () => void;
}

export function BirthdayPickerModal({
  open, bdDay, bdMonth, bdYear, setBdDay, setBdMonth, setBdYear,
  hasBirthdate, savingMeta, onClose, onClear, onSave,
}: Props) {
  if (!open) return null;
  const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= 1920; y--) years.push(y);
  const daysInMonth = new Date(bdYear, bdMonth, 0).getDate();
  const days: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const dayValid = bdDay <= daysInMonth ? bdDay : daysInMonth;

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-fade-in" onClick={onClose} style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
      <div className="glass-strong rounded-3xl p-5 w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Icon name="Cake" size={18} className="text-violet-400" />
            Дата рождения
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8">
            <Icon name="X" size={18} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div>
            <div className="text-[10px] text-muted-foreground mb-1 px-1">День</div>
            <select value={dayValid} onChange={e => setBdDay(parseInt(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-3 text-sm font-semibold outline-none">
              {days.map(d => <option key={d} value={d} className="bg-zinc-900">{d}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-1 px-1">Месяц</div>
            <select value={bdMonth} onChange={e => setBdMonth(parseInt(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-3 text-sm font-semibold outline-none">
              {months.map((m, i) => <option key={m} value={i + 1} className="bg-zinc-900">{m}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-1 px-1">Год</div>
            <select value={bdYear} onChange={e => setBdYear(parseInt(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-3 text-sm font-semibold outline-none">
              {years.map(y => <option key={y} value={y} className="bg-zinc-900">{y}</option>)}
            </select>
          </div>
        </div>
        <div className="text-center text-sm text-violet-300 font-semibold mb-4">
          {dayValid} {months[bdMonth - 1].toLowerCase()} {bdYear} г.
        </div>
        <div className="flex gap-2">
          {hasBirthdate && (
            <button onClick={onClear}
              className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-muted-foreground">
              Очистить
            </button>
          )}
          <button onClick={onSave} disabled={savingMeta}
            className="flex-1 py-3 rounded-2xl grad-primary text-white font-bold text-sm disabled:opacity-60">
            {savingMeta ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BirthdayPickerModal;
