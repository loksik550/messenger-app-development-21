import Icon from "@/components/ui/icon";

export function SettingsGroup({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <div>
      {title && <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5">{title}</div>}
      <div className="glass rounded-2xl overflow-hidden [&>*+*]:border-t [&>*+*]:border-white/[0.06]">{children}</div>
      {footer && <p className="text-[11px] text-muted-foreground px-3 mt-1.5 leading-relaxed">{footer}</p>}
    </div>
  );
}

export function SettingsIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color }}>
      <Icon name={icon} fallback="Circle" size={17} className="text-white" />
    </div>
  );
}

export function SettingsSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`w-12 h-6 rounded-full transition-all duration-300 relative flex-shrink-0 ${on ? "grad-primary" : "bg-white/10"}`}
    >
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300" style={{ left: on ? "calc(100% - 22px)" : "2px" }} />
    </button>
  );
}

export function SettingsToggleRow({ icon, color, label, sub, on, onToggle }: {
  icon: string; color: string; label: string; sub?: string; on: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <SettingsIcon icon={icon} color={color} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      </div>
      <SettingsSwitch on={on} onToggle={onToggle} />
    </div>
  );
}

export function SettingsRow({ icon, color, label, sub, onClick, right, danger }: {
  icon: string; color: string; label: string; sub?: string; onClick?: () => void; right?: React.ReactNode; danger?: boolean;
}) {
  const body = (
    <>
      <SettingsIcon icon={icon} color={color} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${danger ? "text-red-400" : ""}`}>{label}</div>
        {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      </div>
      {right !== undefined ? right : onClick ? <Icon name="ChevronRight" size={16} className="text-muted-foreground flex-shrink-0" /> : null}
    </>
  );
  if (!onClick) return <div className="flex items-center gap-3 px-3.5 py-3">{body}</div>;
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-white/5 active:bg-white/8 transition text-left">
      {body}
    </button>
  );
}

export function SettingsChoiceRow<T extends string>({ icon, color, label, sub, value, options, onChange }: {
  icon: string; color: string; label: string; sub?: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="px-3.5 py-3">
      <div className="flex items-center gap-3 mb-2.5">
        <SettingsIcon icon={icon} color={color} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
        </div>
      </div>
      <div className="grid gap-1 p-1 rounded-xl bg-black/20" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`py-1.5 rounded-lg text-xs font-semibold transition ${value === o.id ? "grad-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsHeader({ title, sub, onBack }: { title: string; sub?: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-3" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
      <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-white/8 transition-colors flex-shrink-0" aria-label="Назад">
        <Icon name="ChevronLeft" size={20} />
      </button>
      <div className="flex-1 min-w-0">
        <h2 className="text-xl font-bold">{title}</h2>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
