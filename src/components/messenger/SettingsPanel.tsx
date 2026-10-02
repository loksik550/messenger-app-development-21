import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { api, type User, type IconName } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { useSettingsSounds } from "@/components/messenger/settings/useSettingsSounds";
import { SoundsSection } from "@/components/messenger/settings/SoundsSection";
import { PinDialog, type PinFlow } from "@/components/messenger/settings/PinDialog";
import { LoginEventsList, type LoginEvent } from "@/components/messenger/settings/LoginEventsList";
import { NotificationsInfo } from "@/components/messenger/settings/NotificationsInfo";
import { SettingsActions } from "@/components/messenger/settings/SettingsActions";

/** Переключатель. Вынесен наружу, чтобы не пересоздавался при обновлениях. */
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-12 h-6 rounded-full transition-all duration-300 relative flex-shrink-0 ${on ? "grad-primary" : "bg-white/10"}`}
    >
      <div
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300"
        style={{ left: on ? "calc(100% - 22px)" : "2px" }}
      />
    </button>
  );
}

export function SettingsPanel({
  onLogout,
  onBack,
  currentUser,
  onDeleteAccount,
  onOpenPrivacyPolicy,
  onOpenTerms,
  onOpenHelp,
}: {
  onLogout: () => void;
  onBack?: () => void;
  currentUser?: User;
  onDeleteAccount?: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenTerms?: () => void;
  onOpenHelp?: () => void;
}) {
  useEdgeSwipeBack(onBack);
  const readBool = (k: string, def: boolean) => {
    const v = localStorage.getItem(k);
    return v == null ? def : v === "1";
  };
  const writeBool = (k: string, v: boolean) => localStorage.setItem(k, v ? "1" : "0");

  const [e2e, setE2e] = useState(() => readBool("nova_sec_e2e", true));
  const [twofa, setTwofa] = useState(() => Boolean(localStorage.getItem("nova_sec_pin")));
  const [biometric, setBiometric] = useState(() => Boolean(localStorage.getItem("nova_sec_bio_cred")));
  const [notifications, setNotifications] = useState(() => readBool("nova_sec_notifications", true));
  const [msgPreview, setMsgPreview] = useState(() => readBool("nova_sec_msg_preview", false));

  // Оповещения о входе с нового устройства — хранятся на сервере
  const [loginAlerts, setLoginAlerts] = useState(() => readBool("nova_sec_login_alerts", true));
  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [devicesCount, setDevicesCount] = useState(0);
  const [showLogins, setShowLogins] = useState(false);

  // Выбор пользователя главнее ответа сервера: если человек уже трогал
  // переключатель, ответ с сервера его больше не перебивает.
  const touchedAlerts = useRef(false);
  const userId = currentUser?.id;

  useEffect(() => {
    if (!userId) return;
    api("login_alerts_get", {}, userId)
      .then((d) => {
        if (Array.isArray(d.events)) setLoginEvents(d.events);
        if (typeof d.devices_count === "number") setDevicesCount(d.devices_count);
        if (touchedAlerts.current) return;
        if (typeof d.enabled === "boolean") {
          setLoginAlerts(d.enabled);
          writeBool("nova_sec_login_alerts", d.enabled);
        }
      })
      .catch(() => { /* ignore */ });
  }, [userId]);

  const toggleLoginAlerts = () => {
    touchedAlerts.current = true;
    setLoginAlerts((prev) => {
      const next = !prev;
      writeBool("nova_sec_login_alerts", next);
      if (userId) {
        api("login_alerts_set", { enabled: next }, userId).catch(() => { /* ignore */ });
      }
      return next;
    });
  };

  const sounds = useSettingsSounds();
  const { pushPerm, requestPushPerm } = sounds;

  const [pinFlow, setPinFlow] = useState<null | PinFlow>(null);


  useEffect(() => { writeBool("nova_sec_e2e", e2e); }, [e2e]);
  useEffect(() => { writeBool("nova_sec_biometric", biometric && Boolean(localStorage.getItem("nova_sec_bio_cred"))); }, [biometric]);
  useEffect(() => { writeBool("nova_sec_notifications", notifications); }, [notifications]);
  useEffect(() => { writeBool("nova_sec_msg_preview", msgPreview); }, [msgPreview]);

  const toggle2FA = () => {
    if (twofa) setPinFlow({ step: "verify", value: "" });
    else setPinFlow({ step: "set", value: "" });
  };

  const [bioError, setBioError] = useState("");
  const toggleBiometric = async () => {
    if (biometric) {
      // Выключаем
      localStorage.removeItem("nova_sec_bio_cred");
      setBiometric(false);
      return;
    }
    // Включаем — требуем PIN как запасной способ
    if (!localStorage.getItem("nova_sec_pin")) {
      setBioError("Сначала включите PIN-код — он нужен как запасной вход");
      setTimeout(() => setBioError(""), 4000);
      return;
    }
    try {
      if (typeof window === "undefined" || !window.PublicKeyCredential) {
        setBioError("Устройство не поддерживает биометрию");
        setTimeout(() => setBioError(""), 4000);
        return;
      }
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Nova" },
          user: {
            id: userId,
            name: currentUser?.phone || "user",
            displayName: currentUser?.name || "Nova",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;
      if (cred) {
        const raw = new Uint8Array(cred.rawId);
        const b64 = btoa(String.fromCharCode(...raw));
        localStorage.setItem("nova_sec_bio_cred", b64);
        setBiometric(true);
      } else {
        setBioError("Не удалось включить биометрию");
        setTimeout(() => setBioError(""), 4000);
      }
    } catch {
      setBioError("Биометрия недоступна или отклонена");
      setTimeout(() => setBioError(""), 4000);
    }
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
          { icon: "Fingerprint", label: "Биометрия", sub: biometric ? "Включена — вход по Face ID / Touch ID" : "Вход по Face ID / Touch ID", state: biometric, toggle: toggleBiometric },
          { icon: "Bell", label: "Уведомления", sub: "Показывать оповещения", state: notifications, toggle: () => setNotifications(v => !v) },
          { icon: "Eye", label: "Предпросмотр сообщений", sub: "Текст в уведомлениях", state: msgPreview, toggle: () => setMsgPreview(v => !v) },
          { icon: "ShieldAlert", label: "Оповещать о входах", sub: devicesCount > 1 ? `Ваших устройств: ${devicesCount}` : "Новое устройство в аккаунте", state: loginAlerts, toggle: toggleLoginAlerts },
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

        {loginEvents.length > 0 && (
          <LoginEventsList loginEvents={loginEvents} showLogins={showLogins} setShowLogins={setShowLogins} />
        )}

        {bioError && (
          <div className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-400 animate-fade-in flex items-center gap-2">
            <Icon name="TriangleAlert" size={16} className="flex-shrink-0" />
            {bioError}
          </div>
        )}

        <NotificationsInfo notifications={notifications} msgPreview={msgPreview} pushPerm={pushPerm} requestPushPerm={requestPushPerm} />

        <SoundsSection sounds={sounds} />

        <SettingsActions
          exportBackup={exportBackup}
          onLogout={onLogout}
          onDeleteAccount={onDeleteAccount}
          onOpenPrivacyPolicy={onOpenPrivacyPolicy}
          onOpenTerms={onOpenTerms}
          onOpenHelp={onOpenHelp}
        />
      </div>

      {pinFlow && (
        <PinDialog pinFlow={pinFlow} setPinFlow={setPinFlow} submitPin={submitPin} />
      )}
    </div>
  );
}

export default SettingsPanel;
