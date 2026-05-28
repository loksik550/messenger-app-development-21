import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { api, type User, type IconName } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import {
  RINGTONES, NOTIFY_SOUNDS,
  getRingtoneId, setRingtoneId,
  getNotifyId, setNotifyId,
  getVolume, setVolume,
  previewRingtone, previewNotifySound, stopRingtone,
  saveCustomRingtone, getCustomRingtoneMeta, clearCustomRingtone,
  type RingtoneId, type NotifyId,
} from "@/lib/sounds";

const MAX_RINGTONE_SIZE = 10 * 1024 * 1024;

export function SettingsPanel({
  onLogout,
  onBack,
  currentUser,
  onDeleteAccount,
  onOpenPrivacyPolicy,
}: {
  onLogout: () => void;
  onBack?: () => void;
  currentUser?: User;
  onDeleteAccount?: () => void;
  onOpenPrivacyPolicy?: () => void;
}) {
  useEdgeSwipeBack(onBack);
  const readBool = (k: string, def: boolean) => {
    const v = localStorage.getItem(k);
    return v == null ? def : v === "1";
  };
  const writeBool = (k: string, v: boolean) => localStorage.setItem(k, v ? "1" : "0");

  const [e2e, setE2e] = useState(() => readBool("nova_sec_e2e", true));
  const [twofa, setTwofa] = useState(() => Boolean(localStorage.getItem("nova_sec_pin")));
  const [biometric, setBiometric] = useState(() => readBool("nova_sec_biometric", true));
  const [notifications, setNotifications] = useState(() => readBool("nova_sec_notifications", true));
  const [msgPreview, setMsgPreview] = useState(() => readBool("nova_sec_msg_preview", false));

  const [ringtone, setRingtone] = useState<RingtoneId>(() => getRingtoneId());
  const [notifySnd, setNotifySnd] = useState<NotifyId>(() => getNotifyId());
  const [volume, setVolumeS] = useState<number>(() => getVolume());
  const [customMeta, setCustomMeta] = useState<{ name: string; size: number; type: string } | null>(null);
  const ringFileRef = useRef<HTMLInputElement | null>(null);
  const [pushPerm, setPushPerm] = useState<NotificationPermission>(() => (typeof Notification !== "undefined" ? Notification.permission : "default"));
  const [soundError, setSoundError] = useState<string>("");

  useEffect(() => { getCustomRingtoneMeta().then(setCustomMeta); }, []);
  useEffect(() => {
    if (!soundError) return;
    const t = setTimeout(() => setSoundError(""), 3500);
    return () => clearTimeout(t);
  }, [soundError]);

  const onPickRingFile = () => ringFileRef.current?.click();
  const onRingFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("audio/")) { setSoundError("Можно загрузить только аудио"); return; }
    if (f.size > MAX_RINGTONE_SIZE) { setSoundError("Файл слишком большой (макс 10 МБ)"); return; }
    try {
      const meta = await saveCustomRingtone(f);
      setCustomMeta({ name: meta.name, size: meta.size, type: f.type });
      setRingtoneId("custom");
      setRingtone("custom");
    } catch {
      setSoundError("Не удалось сохранить файл");
    }
  };

  const requestPushPerm = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPushPerm(p);
  };

  const [pinFlow, setPinFlow] = useState<null | { step: "set" | "confirm" | "verify"; first?: string; value: string; error?: string }>(null);

  useEffect(() => { writeBool("nova_sec_e2e", e2e); }, [e2e]);
  useEffect(() => { writeBool("nova_sec_biometric", biometric); }, [biometric]);
  useEffect(() => { writeBool("nova_sec_notifications", notifications); }, [notifications]);
  useEffect(() => { writeBool("nova_sec_msg_preview", msgPreview); }, [msgPreview]);

  const toggle2FA = () => {
    if (twofa) setPinFlow({ step: "verify", value: "" });
    else setPinFlow({ step: "set", value: "" });
  };

  const submitPin = () => {
    if (!pinFlow) return;
    const v = pinFlow.value;
    if (pinFlow.step === "set") {
      if (v.length < 4) { setPinFlow({ ...pinFlow, error: "Минимум 4 цифры" }); return; }
      setPinFlow({ step: "confirm", first: v, value: "", error: undefined });
      return;
    }
    if (pinFlow.step === "confirm") {
      if (v !== pinFlow.first) { setPinFlow({ ...pinFlow, value: "", error: "Коды не совпадают" }); return; }
      localStorage.setItem("nova_sec_pin", v);
      setTwofa(true);
      setPinFlow(null);
      return;
    }
    if (pinFlow.step === "verify") {
      const saved = localStorage.getItem("nova_sec_pin");
      if (v !== saved) { setPinFlow({ ...pinFlow, value: "", error: "Неверный код" }); return; }
      localStorage.removeItem("nova_sec_pin");
      setTwofa(false);
      setPinFlow(null);
    }
  };

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} className={`w-12 h-6 rounded-full transition-all duration-300 relative ${on ? "grad-primary" : "bg-white/10"}`}>
      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300" style={{ left: on ? "calc(100% - 22px)" : "2px" }} />
    </button>
  );

  const exportBackup = async () => {
    if (!currentUser) return;
    try {
      const chats = await api("get_chats", {}, currentUser.id);
      const out: { exported_at: string; user: { id: number; name: string; phone: string }; chats: unknown[] } = {
        exported_at: new Date().toISOString(),
        user: { id: currentUser.id, name: currentUser.name, phone: currentUser.phone },
        chats: [],
      };
      for (const ch of (chats.chats || [])) {
        const msgs = await api("get_messages", { chat_id: ch.id, since: 0 }, currentUser.id);
        out.chats.push({ chat: ch, messages: msgs.messages || [] });
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nova_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in overflow-y-auto">
      <div className="px-4 pt-4 pb-4 flex items-start gap-2" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
        {onBack && (
          <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-xl hover:bg-white/8 transition-colors flex-shrink-0">
            <Icon name="ChevronLeft" size={20} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold mb-1">Безопасность</h2>
          <p className="text-sm text-muted-foreground">Управление защитой аккаунта</p>
        </div>
      </div>

      <div className="mx-4 mb-4 glass rounded-2xl p-4 border border-violet-500/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl grad-primary flex items-center justify-center">
            <Icon name="ShieldCheck" size={20} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm">Защита активна</div>
            <div className="text-xs text-violet-400">Все данные зашифрованы</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground leading-relaxed">
          Nova использует сквозное шифрование (E2E). Ваши сообщения не могут быть прочитаны третьими лицами.
        </div>
      </div>

      <div className="px-4 space-y-2 pb-6">
        {[
          { icon: "Lock", label: "Сквозное шифрование", sub: "E2E для всех чатов", state: e2e, toggle: () => setE2e(v => !v), badge: "Signal" },
          { icon: "KeyRound", label: "Двухфакторная аутентификация", sub: twofa ? "PIN установлен" : "Код при входе", state: twofa, toggle: toggle2FA },
          { icon: "Fingerprint", label: "Биометрия", sub: "Вход по Face ID / Touch ID", state: biometric, toggle: () => setBiometric(v => !v) },
          { icon: "Bell", label: "Уведомления", sub: "Показывать оповещения", state: notifications, toggle: () => setNotifications(v => !v) },
          { icon: "Eye", label: "Предпросмотр сообщений", sub: "Текст в уведомлениях", state: msgPreview, toggle: () => setMsgPreview(v => !v) },
        ].map((item, i) => (
          <div key={item.icon} className={`flex items-center gap-3 px-4 py-3 glass rounded-2xl animate-fade-in stagger-${Math.min(i + 1, 5)}`}>
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
              <Icon name={item.icon as IconName} size={18} className="text-violet-400" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{item.label}</span>
                {item.badge && <span className="text-[9px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">{item.badge}</span>}
              </div>
              <div className="text-xs text-muted-foreground truncate">{item.sub}</div>
            </div>
            <Toggle on={item.state} onToggle={item.toggle} />
          </div>
        ))}

        <div className="px-4 py-3 glass rounded-2xl mt-1">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Пример уведомления</div>
          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5">
            <div className="w-9 h-9 rounded-full grad-primary flex items-center justify-center text-white font-bold text-sm">N</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Nova {notifications ? "" : "(выкл.)"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {!notifications ? "Уведомления отключены" : msgPreview ? "Алексей: Привет! Как дела?" : "Новое сообщение"}
              </div>
            </div>
          </div>
        </div>

        {pushPerm !== "granted" && (
          <div className="px-4 py-3 glass rounded-2xl mt-1 flex items-center gap-3 border border-amber-500/30">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              <Icon name="BellRing" size={18} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">
                {pushPerm === "denied" ? "Уведомления заблокированы" : "Включи уведомления"}
              </div>
              <div className="text-xs text-muted-foreground">
                {pushPerm === "denied"
                  ? "Разреши в настройках браузера, чтобы видеть звонки и сообщения при заблокированном экране"
                  : "Чтобы получать звонки и сообщения, когда телефон заблокирован"}
              </div>
            </div>
            {pushPerm !== "denied" && (
              <button onClick={requestPushPerm} className="px-3 py-1.5 grad-primary text-white rounded-xl text-xs font-semibold flex-shrink-0">
                Включить
              </button>
            )}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mt-4 mb-1 px-1">Звуки</div>
        {soundError && (
          <div className="px-4 py-2 glass rounded-xl border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <Icon name="AlertCircle" size={14} />
            <span>{soundError}</span>
          </div>
        )}

        <div className="px-4 py-3 glass rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Volume2" size={16} className="text-violet-400" />
            <span className="text-sm font-medium">Громкость</span>
            <span className="ml-auto text-xs text-muted-foreground">{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range" min={0} max={100} step={5}
            value={Math.round(volume * 100)}
            onChange={(e) => { const v = Number(e.target.value) / 100; setVolumeS(v); setVolume(v); }}
            className="w-full accent-violet-500"
          />
        </div>

        <div className="px-4 py-3 glass rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Phone" size={16} className="text-violet-400" />
            <span className="text-sm font-medium">Мелодия звонка</span>
          </div>
          <div className="space-y-1.5">
            {RINGTONES.map((r) => (
              <div key={r.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${ringtone === r.id ? "border-violet-500 bg-violet-500/10" : "border-white/5 hover:bg-white/5"}`}>
                <button
                  onClick={() => { setRingtone(r.id); setRingtoneId(r.id); }}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className={`w-5 h-5 rounded-full border-2 ${ringtone === r.id ? "border-violet-500" : "border-white/20"} flex items-center justify-center flex-shrink-0`}>
                    {ringtone === r.id && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{r.name}</div>
                    {r.id === "custom" && customMeta && <div className="text-[11px] text-muted-foreground truncate">{customMeta.name}</div>}
                    {r.id === "custom" && !customMeta && <div className="text-[11px] text-muted-foreground">Файл не загружен</div>}
                  </div>
                </button>
                {r.id === "custom" ? (
                  <>
                    <button onClick={onPickRingFile} className="p-1.5 rounded-lg hover:bg-white/8" title="Загрузить">
                      <Icon name="Upload" size={14} className="text-violet-400" />
                    </button>
                    {customMeta && (
                      <>
                        <button onClick={() => previewRingtone("custom")} className="p-1.5 rounded-lg hover:bg-white/8" title="Прослушать">
                          <Icon name="Play" size={14} />
                        </button>
                        <button onClick={async () => { await clearCustomRingtone(); setCustomMeta(null); if (ringtone === "custom") { setRingtone("nova"); setRingtoneId("nova"); } }} className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-400" title="Удалить">
                          <Icon name="Trash2" size={14} />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => previewRingtone(r.id)} className="p-1.5 rounded-lg hover:bg-white/8" title="Прослушать">
                      <Icon name="Play" size={14} />
                    </button>
                    <button onClick={() => stopRingtone()} className="p-1.5 rounded-lg hover:bg-white/8" title="Остановить">
                      <Icon name="Square" size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <input ref={ringFileRef} type="file" accept="audio/*" className="hidden" onChange={onRingFile} />
          <p className="text-[11px] text-muted-foreground mt-2">Загрузи MP3, WAV или другой аудиофайл — он будет играть как в Telegram при входящем звонке.</p>
        </div>

        <div className="px-4 py-3 glass rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Bell" size={16} className="text-violet-400" />
            <span className="text-sm font-medium">Звук уведомлений</span>
          </div>
          <div className="space-y-1.5">
            {NOTIFY_SOUNDS.map((s) => (
              <div key={s.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${notifySnd === s.id ? "border-violet-500 bg-violet-500/10" : "border-white/5 hover:bg-white/5"}`}>
                <button
                  onClick={() => { setNotifySnd(s.id); setNotifyId(s.id); previewNotifySound(s.id); }}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div className={`w-5 h-5 rounded-full border-2 ${notifySnd === s.id ? "border-violet-500" : "border-white/20"} flex items-center justify-center flex-shrink-0`}>
                    {notifySnd === s.id && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                  </div>
                  <span className="text-sm">{s.name}</span>
                </button>
                <button onClick={() => previewNotifySound(s.id)} className="p-1.5 rounded-lg hover:bg-white/8">
                  <Icon name="Play" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={exportBackup}
          className="w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl hover:bg-white/5 transition-all mt-2"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Icon name="Download" size={18} className="text-emerald-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium">Резервная копия</div>
            <div className="text-xs text-muted-foreground">Скачать все чаты в файл JSON</div>
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground ml-auto" />
        </button>

        {onOpenPrivacyPolicy && (
          <button onClick={onOpenPrivacyPolicy} className="w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl hover:bg-white/8 transition-all mt-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Icon name="FileText" size={18} className="text-violet-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Политика конфиденциальности</div>
              <div className="text-xs text-muted-foreground">Как мы храним и защищаем ваши данные</div>
            </div>
            <Icon name="ChevronRight" size={16} className="text-muted-foreground ml-auto" />
          </button>
        )}

        <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl hover:bg-red-500/10 transition-all mt-2">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
            <Icon name="LogOut" size={18} className="text-red-400" />
          </div>
          <span className="text-sm font-medium text-red-400">Выйти из аккаунта</span>
          <Icon name="ChevronRight" size={16} className="text-red-400/50 ml-auto" />
        </button>

        {onDeleteAccount && (
          <button onClick={onDeleteAccount} className="w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl hover:bg-red-500/15 transition-all mt-2 border border-red-500/20">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center">
              <Icon name="Trash2" size={18} className="text-red-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-red-400">Удалить аккаунт</div>
              <div className="text-xs text-red-300/70">Полное и безвозвратное удаление всех данных</div>
            </div>
            <Icon name="ChevronRight" size={16} className="text-red-400/50 ml-auto" />
          </button>
        )}
      </div>

      {pinFlow && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setPinFlow(null)}>
          <div className="glass-strong rounded-2xl p-5 w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl grad-primary flex items-center justify-center">
                <Icon name="KeyRound" size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">
                  {pinFlow.step === "set" && "Придумайте PIN-код"}
                  {pinFlow.step === "confirm" && "Повторите PIN-код"}
                  {pinFlow.step === "verify" && "Введите PIN-код"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {pinFlow.step === "verify" ? "Чтобы отключить 2FA" : "От 4 до 6 цифр"}
                </div>
              </div>
            </div>
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pinFlow.value}
              onChange={(e) => setPinFlow({ ...pinFlow, value: e.target.value.replace(/\D/g, ""), error: undefined })}
              onKeyDown={(e) => { if (e.key === "Enter") submitPin(); }}
              className="w-full text-center text-2xl tracking-[0.5em] font-bold bg-white/5 rounded-xl py-3 outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="••••"
            />
            {pinFlow.error && <p className="text-red-400 text-xs mt-2 text-center">{pinFlow.error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setPinFlow(null)} className="flex-1 px-4 py-2.5 rounded-xl hover:bg-white/8 text-sm">Отмена</button>
              <button onClick={submitPin} className="flex-1 grad-primary text-white rounded-xl py-2.5 text-sm font-semibold">
                {pinFlow.step === "verify" ? "Отключить" : pinFlow.step === "set" ? "Далее" : "Готово"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPanel;