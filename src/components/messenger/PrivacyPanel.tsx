import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import {
  SettingsChoiceRow, SettingsGroup, SettingsHeader, SettingsIcon, SettingsRow, SettingsToggleRow,
} from "@/components/messenger/settings/SettingsUI";

type Vis = "everyone" | "contacts" | "nobody";
type Session = { id: number; device_name: string; device_info: string; ip_addr: string; last_active_at: number; revoked: boolean };

const VIS_OPTIONS: { id: Vis; label: string }[] = [
  { id: "everyone", label: "Все" },
  { id: "contacts", label: "Контакты" },
  { id: "nobody", label: "Никто" },
];

const timeAgo = (ts: number) => {
  if (!ts) return "";
  const d = Math.floor(Date.now() / 1000 - ts);
  if (d < 300) return "сейчас в сети";
  if (d < 3600) return `${Math.floor(d / 60)} мин назад`;
  if (d < 86400) return `${Math.floor(d / 3600)} ч назад`;
  return new Date(ts * 1000).toLocaleDateString("ru", { day: "numeric", month: "short" });
};

export default function PrivacyPanel({
  currentUser,
  onClose,
  onUserUpdate,
}: {
  currentUser: User;
  onClose: () => void;
  onUserUpdate: (u: User) => void;
}) {
  useEdgeSwipeBack(onClose);

  const [readReceipts, setReadReceipts] = useState<boolean>(currentUser.read_receipts_enabled ?? true);
  const [lastSeen, setLastSeen] = useState<Vis>((currentUser.last_seen_visibility as Vis) || "everyone");
  const [photoVis, setPhotoVis] = useState<Vis>((currentUser.profile_photo_visibility as Vis) || "everyone");
  const [phoneVis, setPhoneVis] = useState<Vis>((currentUser.phone_visibility as Vis) || "contacts");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSessions, setShowSessions] = useState(false);

  const update = async (field: string, value: unknown) => {
    onUserUpdate({ ...currentUser, [field]: value } as User);
    await api("update_user_settings", { [field]: value }, currentUser.id).catch(() => null);
  };

  useEffect(() => {
    api("sessions_list", {}, currentUser.id).then(d => {
      if (Array.isArray(d?.sessions)) setSessions(d.sessions);
    });
  }, [currentUser.id]);

  const active = sessions.filter(s => !s.revoked);

  const revokeOne = async (id: number) => {
    await api("sessions_revoke", { session_id: id }, currentUser.id);
    setSessions(prev => prev.filter(x => x.id !== id));
  };

  const revokeAll = async () => {
    if (!confirm("Выйти со всех устройств, кроме этого?")) return;
    await api("sessions_revoke_all", {}, currentUser.id);
    const r = await api("sessions_list", {}, currentUser.id);
    if (Array.isArray(r?.sessions)) setSessions(r.sessions);
  };

  return (
    <div className="fixed inset-0 z-[260] bg-background flex flex-col animate-fade-in">
      <SettingsHeader title="Приватность" sub="Кто видит ваши данные" onBack={onClose} />

      <div className="flex-1 overflow-y-auto px-4 space-y-5" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
        <SettingsGroup title="Кто видит" footer="Для номера телефона рекомендуем «Контакты».">
          <SettingsChoiceRow icon="Phone" color="#22c55e" label="Номер телефона" value={phoneVis} options={VIS_OPTIONS}
            onChange={(v) => { setPhoneVis(v); update("phone_visibility", v); }} />
          <SettingsChoiceRow icon="Image" color="#ec4899" label="Фото профиля" value={photoVis} options={VIS_OPTIONS}
            onChange={(v) => { setPhotoVis(v); update("profile_photo_visibility", v); }} />
          <SettingsChoiceRow icon="Clock" color="#3b82f6" label="Был(а) в сети" value={lastSeen} options={VIS_OPTIONS}
            onChange={(v) => { setLastSeen(v); update("last_seen_visibility", v); }} />
        </SettingsGroup>

        <SettingsGroup title="Сообщения">
          <SettingsToggleRow icon="CheckCheck" color="#8b5cf6" label="Отчёты о прочтении" sub="Собеседник видит, что вы прочитали"
            on={readReceipts} onToggle={() => { const v = !readReceipts; setReadReceipts(v); update("read_receipts_enabled", v); }} />
        </SettingsGroup>

        <SettingsGroup title="Устройства">
          <div>
            <button type="button" onClick={() => setShowSessions(v => !v)} className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-white/5 transition text-left">
              <SettingsIcon icon="Smartphone" color="#06b6d4" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">Активные сеансы</div>
                <div className="text-xs text-muted-foreground truncate">
                  {active.length ? `Устройств: ${active.length}` : "Где выполнен вход в аккаунт"}
                </div>
              </div>
              <Icon name={showSessions ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground flex-shrink-0" />
            </button>
            {showSessions && (
              <div className="px-3 pb-2">
                {active.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-2">Нет данных о других устройствах</p>
                ) : active.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-1 py-2">
                    <Icon name="MonitorSmartphone" fallback="Smartphone" size={16} className="text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{s.device_name || s.device_info || `Сеанс #${s.id}`}</div>
                      {s.last_active_at ? <div className="text-[11px] text-muted-foreground">{timeAgo(s.last_active_at)}</div> : null}
                    </div>
                    <button onClick={() => revokeOne(s.id)} className="text-red-400 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-500/10 flex-shrink-0">
                      Завершить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <SettingsRow icon="LogOut" color="#ef4444" label="Выйти со всех устройств" sub="Кроме этого" onClick={revokeAll} danger right={null} />
        </SettingsGroup>

        <SettingsGroup title="Блокировка">
          <SettingsRow icon="Ban" color="#64748b" label="Заблокированные" sub="Откройте чат → меню → «Заблокировать»" />
        </SettingsGroup>
      </div>
    </div>
  );
}
