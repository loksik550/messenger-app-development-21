import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { api, subscribeToPush, type User } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { useT } from "@/hooks/useT";

export default function NotificationsPanel({
  currentUser, onClose, onUserUpdate,
}: {
  currentUser: User; onClose: () => void; onUserUpdate: (u: User) => void;
}) {
  useEdgeSwipeBack(onClose);
  const { t } = useT();
  const [msg, setMsg] = useState<boolean>(currentUser.notify_messages ?? true);
  const [grp, setGrp] = useState<boolean>(currentUser.notify_groups ?? true);
  const [calls, setCalls] = useState<boolean>(currentUser.notify_calls ?? true);
  const [vibr, setVibr] = useState<boolean>(currentUser.notify_vibration ?? true);
  const [sound, setSound] = useState<string>(currentUser.notify_sound || "default");
  const [qFrom, setQFrom] = useState<number | null>(currentUser.quiet_hours_from ?? null);
  const [qTo, setQTo] = useState<number | null>(currentUser.quiet_hours_to ?? null);

  // Статус разрешения на push в браузере
  const [pushPerm, setPushPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    if (typeof Notification === "undefined") setPushPerm("unsupported");
  }, []);

  const enablePush = async () => {
    setPushBusy(true);
    const res = await subscribeToPush(currentUser.id);
    if (res === "ok") setPushPerm("granted");
    else if (res === "denied") setPushPerm("denied");
    else if (res === "unsupported") setPushPerm("unsupported");
    setPushBusy(false);
  };

  const update = async (field: string, value: unknown) => {
    await api("update_user_settings", { [field]: value }, currentUser.id);
    onUserUpdate({ ...currentUser, [field]: value } as User);
  };

  const Toggle = ({ label, sub, value, onChange, icon, color }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; icon: string; color: string }) => (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <Icon name={icon} size={20} className={color} />
      <div className="flex-1">
        <div className="font-semibold text-sm">{label}</div>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition ${value ? "bg-violet-500" : "bg-white/10"}`}
      >
        <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[260] bg-background flex flex-col animate-fade-in">
      <div className="flex items-center gap-2 px-3 py-2 glass-strong border-b border-white/5" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="font-bold flex-1">{t("nav.notifications")}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {pushPerm !== "unsupported" && (
          <div className={`glass rounded-2xl p-4 flex items-center gap-3 ${pushPerm === "granted" ? "" : "border border-violet-400/30"}`}>
            <Icon name={pushPerm === "granted" ? "BellRing" : "BellOff"} size={20} className={pushPerm === "granted" ? "text-emerald-400" : "text-violet-400"} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Push-уведомления</div>
              <p className="text-[11px] text-muted-foreground">
                {pushPerm === "granted"
                  ? "Уведомления включены на этом устройстве"
                  : pushPerm === "denied"
                    ? "Разрешение отклонено. Включите его в настройках браузера"
                    : "Получайте сообщения, даже когда приложение закрыто"}
              </p>
            </div>
            {pushPerm === "granted" ? (
              <button onClick={enablePush} disabled={pushBusy} className="px-3 py-1.5 rounded-xl glass text-xs font-semibold text-muted-foreground disabled:opacity-50">
                {pushBusy ? "..." : "Обновить"}
              </button>
            ) : pushPerm === "default" ? (
              <button onClick={enablePush} disabled={pushBusy} className="px-3 py-1.5 rounded-xl grad-primary text-white text-xs font-bold disabled:opacity-50">
                {pushBusy ? "..." : "Включить"}
              </button>
            ) : null}
          </div>
        )}
        <Toggle label="Личные сообщения" icon="MessageCircle" color="text-violet-400" value={msg} onChange={v => { setMsg(v); update("notify_messages", v); }} />
        <Toggle label="Группы и каналы" icon="Users" color="text-cyan-400" value={grp} onChange={v => { setGrp(v); update("notify_groups", v); }} />
        <Toggle label="Звонки" icon="Phone" color="text-emerald-400" value={calls} onChange={v => { setCalls(v); update("notify_calls", v); }} />
        <Toggle label="Вибрация" icon="Vibrate" color="text-amber-400" value={vibr} onChange={v => { setVibr(v); update("notify_vibration", v); }} />

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Music" size={20} className="text-pink-400" />
            <div className="font-semibold text-sm flex-1">Звук</div>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(["default", "soft", "loud", "none"] as const).map(s => (
              <button
                key={s}
                onClick={() => { setSound(s); update("notify_sound", s); }}
                className={`py-2 rounded-xl text-xs font-semibold ${sound === s ? "grad-primary text-white" : "glass text-muted-foreground"}`}
              >
                {s === "default" ? "Стандарт" : s === "soft" ? "Тихий" : s === "loud" ? "Громкий" : "Без звука"}
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Icon name="Moon" size={20} className="text-indigo-400" />
            <div className="flex-1">
              <div className="font-semibold text-sm">Тихие часы</div>
              <p className="text-[11px] text-muted-foreground">Не беспокоить ночью или на работе</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={23} placeholder="С"
              value={qFrom ?? ""}
              onChange={e => setQFrom(e.target.value === "" ? null : parseInt(e.target.value, 10))}
              onBlur={() => update("quiet_hours_from", qFrom)}
              className="w-20 glass rounded-xl px-3 py-2 text-sm text-center"
            />
            <span className="text-muted-foreground text-sm">—</span>
            <input
              type="number" min={0} max={23} placeholder="До"
              value={qTo ?? ""}
              onChange={e => setQTo(e.target.value === "" ? null : parseInt(e.target.value, 10))}
              onBlur={() => update("quiet_hours_to", qTo)}
              className="w-20 glass rounded-xl px-3 py-2 text-sm text-center"
            />
            <span className="text-xs text-muted-foreground">час</span>
          </div>
        </div>
      </div>
    </div>
  );
}