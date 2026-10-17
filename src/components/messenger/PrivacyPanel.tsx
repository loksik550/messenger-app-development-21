import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { useT } from "@/hooks/useT";
import { VkLinkRow } from "@/components/messenger/settings/VkLinkRow";

type Vis = "everyone" | "contacts" | "nobody";

const VIS_LABELS: Record<Vis, string> = {
  everyone: "Все",
  contacts: "Только контакты",
  nobody: "Никто",
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
  const { t } = useT();

  const [readReceipts, setReadReceipts] = useState<boolean>(currentUser.read_receipts_enabled ?? true);
  const [lastSeen, setLastSeen] = useState<Vis>((currentUser.last_seen_visibility as Vis) || "everyone");
  const [photoVis, setPhotoVis] = useState<Vis>((currentUser.profile_photo_visibility as Vis) || "everyone");
  const [phoneVis, setPhoneVis] = useState<Vis>((currentUser.phone_visibility as Vis) || "contacts");

  // App lock
  const [lockEnabled, setLockEnabled] = useState<boolean>(currentUser.app_lock_enabled ?? false);
  const [pinDialog, setPinDialog] = useState<"set" | "off" | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<{ id: number; device_name: string; device_info: string; ip_addr: string; last_active_at: number; revoked: boolean }[]>([]);

  const update = async (field: string, value: unknown) => {
    await api("update_user_settings", { [field]: value }, currentUser.id);
    onUserUpdate({ ...currentUser, [field]: value } as User);
  };

  useEffect(() => {
    api("sessions_list", {}, currentUser.id).then(d => {
      if (Array.isArray(d?.sessions)) setSessions(d.sessions);
    });
  }, [currentUser.id]);

  const setupPin = async () => {
    if (pin.length < 4 || pin !== pin2) { alert("PIN должен быть 4-8 цифр и совпадать"); return; }
    setBusy(true);
    const r = await api("set_app_lock", { pin, enabled: true }, currentUser.id);
    setBusy(false);
    if (r?.error) { alert(r.error); return; }
    setLockEnabled(true);
    onUserUpdate({ ...currentUser, app_lock_enabled: true } as User);
    setPinDialog(null); setPin(""); setPin2("");
    alert("Защита кодом включена");
  };

  const turnOffLock = async () => {
    setBusy(true);
    await api("set_app_lock", { enabled: false }, currentUser.id);
    setBusy(false);
    setLockEnabled(false);
    onUserUpdate({ ...currentUser, app_lock_enabled: false } as User);
    setPinDialog(null);
  };

  const revokeAll = async () => {
    if (!confirm("Выйти со всех устройств кроме этого?")) return;
    await api("sessions_revoke_all", {}, currentUser.id);
    const r = await api("sessions_list", {}, currentUser.id);
    if (Array.isArray(r?.sessions)) setSessions(r.sessions);
  };

  const VisRow = ({ label, sub, value, onChange }: { label: string; sub?: string; value: Vis; onChange: (v: Vis) => void }) => (
    <div className="glass rounded-2xl p-3">
      <div className="font-semibold text-sm">{label}</div>
      {sub && <p className="text-[11px] text-muted-foreground mb-2">{sub}</p>}
      <div className="grid grid-cols-3 gap-1">
        {(["everyone", "contacts", "nobody"] as Vis[]).map(v => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`py-1.5 rounded-xl text-xs font-semibold ${value === v ? "grad-primary text-white" : "glass text-muted-foreground"}`}
          >
            {VIS_LABELS[v]}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[260] bg-background flex flex-col animate-fade-in">
      <div className="flex items-center gap-2 px-3 py-2 glass-strong border-b border-white/5" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="font-bold flex-1">{t("nav.privacy")}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <Icon name="Eye" size={20} className="text-violet-400" />
          <div className="flex-1">
            <div className="font-semibold text-sm">Отчёты о прочтении</div>
            <p className="text-[11px] text-muted-foreground">Показывать собеседнику что вы прочитали</p>
          </div>
          <button
            onClick={() => { const v = !readReceipts; setReadReceipts(v); update("read_receipts_enabled", v); }}
            className={`w-11 h-6 rounded-full transition ${readReceipts ? "bg-violet-500" : "bg-white/10"}`}
          >
            <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${readReceipts ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        <VisRow label="Кому видно «был в сети»" value={lastSeen} onChange={(v) => { setLastSeen(v); update("last_seen_visibility", v); }} />
        <VisRow label="Кому видно фото профиля" value={photoVis} onChange={(v) => { setPhotoVis(v); update("profile_photo_visibility", v); }} />
        <VisRow label="Кому виден номер телефона" sub="«Только контакты» — самый рекомендуемый вариант" value={phoneVis} onChange={(v) => { setPhoneVis(v); update("phone_visibility", v); }} />

        <VkLinkRow userId={currentUser.id} />

        {/* App Lock */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Icon name="Lock" size={20} className="text-amber-400" />
            <div className="flex-1">
              <div className="font-semibold text-sm">Код-пароль</div>
              <p className="text-[11px] text-muted-foreground">PIN на вход в приложение</p>
            </div>
            <span className={`text-xs font-bold ${lockEnabled ? "text-emerald-400" : "text-muted-foreground"}`}>
              {lockEnabled ? "Вкл" : "Выкл"}
            </span>
          </div>
          {lockEnabled ? (
            <button onClick={turnOffLock} disabled={busy} className="w-full py-2 rounded-xl bg-red-500/15 text-red-300 text-sm font-semibold">Отключить защиту</button>
          ) : (
            <button onClick={() => setPinDialog("set")} className="w-full py-2 rounded-xl grad-primary text-white text-sm font-semibold">Установить PIN</button>
          )}
        </div>

        {/* Sessions */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Icon name="Smartphone" size={20} className="text-cyan-400" />
            <div className="flex-1">
              <div className="font-semibold text-sm">Активные сессии</div>
              <p className="text-[11px] text-muted-foreground">Устройства, на которых вы вошли</p>
            </div>
          </div>
          {sessions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Нет данных о других устройствах</p>
          ) : (
            <div className="space-y-1">
              {sessions.filter(s => !s.revoked).map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="truncate">{s.device_name || s.device_info || `Сессия #${s.id}`}</span>
                  <button
                    onClick={async () => { await api("sessions_revoke", { session_id: s.id }, currentUser.id); setSessions(prev => prev.filter(x => x.id !== s.id)); }}
                    className="text-red-400 text-[10px] font-semibold"
                  >Отключить</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={revokeAll} className="w-full mt-2 py-2 rounded-xl bg-red-500/10 text-red-300 text-xs font-semibold">
            Выйти со всех устройств
          </button>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Ban" size={20} className="text-red-400" />
            <div className="font-semibold text-sm">Заблокированные</div>
          </div>
          <p className="text-[11px] text-muted-foreground">Чтобы заблокировать пользователя, откройте чат с ним → меню → Заблокировать.</p>
        </div>
      </div>

      {pinDialog === "set" && (
        <div className="fixed inset-0 z-[270] bg-black/60 backdrop-blur flex items-center justify-center p-4" onClick={() => setPinDialog(null)}>
          <div className="glass-strong rounded-3xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-3">Новый PIN</h3>
            <input
              type="password" inputMode="numeric" maxLength={8}
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="4-8 цифр"
              className="w-full glass rounded-xl px-4 py-3 text-center text-lg tracking-widest mb-2"
              autoFocus
            />
            <input
              type="password" inputMode="numeric" maxLength={8}
              value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ""))}
              placeholder="Повторите"
              className="w-full glass rounded-xl px-4 py-3 text-center text-lg tracking-widest mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => setPinDialog(null)} className="flex-1 glass rounded-xl py-2 text-sm">Отмена</button>
              <button onClick={setupPin} disabled={busy || pin.length < 4 || pin !== pin2} className="flex-1 grad-primary text-white rounded-xl py-2 text-sm font-bold disabled:opacity-50">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}