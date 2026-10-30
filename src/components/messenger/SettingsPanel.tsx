import { useState, useEffect, useRef } from "react";
import { myDeviceFingerprint } from "@/lib/e2e";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { PinDialog, type PinFlow } from "@/components/messenger/settings/PinDialog";
import { LoginEventsList, type LoginEvent } from "@/components/messenger/settings/LoginEventsList";
import { VkLinkRow } from "@/components/messenger/settings/VkLinkRow";
import { saveFile } from "@/lib/saveFile";
import { SettingsGroup, SettingsRow, SettingsToggleRow } from "@/components/messenger/settings/SettingsUI";

export function SettingsPanel({
  onBack,
  currentUser,
}: {
  onBack?: () => void;
  currentUser?: User;
}) {
  useEdgeSwipeBack(onBack);
  const readBool = (k: string, def: boolean) => {
    const v = localStorage.getItem(k);
    return v == null ? def : v === "1";
  };
  const writeBool = (k: string, v: boolean) => localStorage.setItem(k, v ? "1" : "0");

  const [twofa, setTwofa] = useState(() => Boolean(localStorage.getItem("nova_sec_pin")));
  const [biometric, setBiometric] = useState(() => Boolean(localStorage.getItem("nova_sec_bio_cred")));
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

  const [e2eFp, setE2eFp] = useState<string | null>(null);
  useEffect(() => {
    if (userId) myDeviceFingerprint(userId).then(setE2eFp).catch(() => { /* ignore */ });
  }, [userId]);

  const [pinFlow, setPinFlow] = useState<null | PinFlow>(null);


  useEffect(() => { writeBool("nova_sec_biometric", biometric && Boolean(localStorage.getItem("nova_sec_bio_cred"))); }, [biometric]);

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

  const [backupBusy, setBackupBusy] = useState(false);
  const [backupProgress, setBackupProgress] = useState("");
  const exportBackup = async () => {
    if (!currentUser || backupBusy) return;
    setBackupBusy(true);
    setBackupProgress("Собираю чаты...");
    try {
      const chats = await api("get_chats", {}, currentUser.id);
      if (chats?.error) throw new Error(chats.error);
      const list: { id: number }[] = chats.chats || [];
      const out: { exported_at: string; user: { id: number; name: string; phone: string; nova_id?: string | null }; chats: unknown[] } = {
        exported_at: new Date().toISOString(),
        user: { id: currentUser.id, name: currentUser.name, phone: currentUser.phone, nova_id: currentUser.nova_id },
        chats: [],
      };
      let done = 0;
      const results: unknown[] = new Array(list.length);
      const queue = list.map((ch, i) => ({ ch, i }));
      const worker = async () => {
        while (queue.length) {
          const job = queue.shift();
          if (!job) break;
          const msgs = await api("get_messages", { chat_id: job.ch.id, since: 0 }, currentUser.id).catch(() => ({ messages: [] }));
          results[job.i] = { chat: job.ch, messages: msgs?.messages || [] };
          done += 1;
          setBackupProgress(`Чаты: ${done} из ${list.length}`);
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, list.length || 1) }, worker));
      out.chats = results.filter(Boolean);
      setBackupProgress("Сохраняю файл...");
      await saveFile(`nova_backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 2), "application/json");
      setBackupProgress("Готово");
      setTimeout(() => setBackupProgress(""), 2500);
    } catch (e) {
      setBackupProgress("");
      alert("Не удалось сохранить копию: " + (e instanceof Error ? e.message : "попробуйте ещё раз"));
    } finally {
      setBackupBusy(false);
    }
  };

  const [showE2e, setShowE2e] = useState(false);

  const Group = SettingsGroup;
  const ToggleRow = ({ on, onToggle, ...r }: { icon: string; color: string; label: string; sub: string; on: boolean; onToggle: () => void }) => (
    <SettingsToggleRow {...r} on={on} onToggle={onToggle} />
  );
  const LinkRow = SettingsRow;

  return (
    <div className="flex flex-col h-full animate-fade-in overflow-y-auto">
      <div className="px-4 pb-4 flex items-center gap-2" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
        {onBack && (
          <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-white/8 transition-colors flex-shrink-0" aria-label="Назад">
            <Icon name="ChevronLeft" size={20} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold">Безопасность</h2>
          <p className="text-sm text-muted-foreground">Защита аккаунта и входа</p>
        </div>
      </div>

      <div className="px-4 space-y-5" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom) + 80px)" }}>
        <div className="glass rounded-2xl p-4 border border-emerald-500/25">
          <button type="button" onClick={() => setShowE2e(v => !v)} className="w-full flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Icon name="Lock" size={20} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm flex items-center gap-2">
                Сквозное шифрование
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">ВКЛ</span>
              </div>
              <div className="text-xs text-emerald-400">Личные чаты защищены всегда</div>
            </div>
            <Icon name={showE2e ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground flex-shrink-0" />
          </button>
          {showE2e && (
            <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5 mt-3">
              <p>Текст личных сообщений шифруется на вашем устройстве и читается только у вас и собеседника. Сервер Nova хранит лишь шифр — прочитать его не может никто.</p>
              <p>Сверить ключи с собеседником можно в чате: нажмите «Зашифровано» под именем.</p>
              <p className="text-muted-foreground/70">Не шифруются сквозным шифрованием: группы и каналы, фото и файлы. Звонки защищены при передаче.</p>
              {e2eFp && (
                <p className="pt-2 border-t border-white/5 text-[11px]">
                  Отпечаток ключа этого устройства: <span className="font-mono text-foreground/80">{e2eFp}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <Group title="Вход в приложение">
          <ToggleRow icon="KeyRound" color="#f59e0b" label="PIN-код" sub={twofa ? "Спросим при открытии приложения" : "Код при открытии приложения"} on={twofa} onToggle={toggle2FA} />
          <ToggleRow icon="Fingerprint" color="#22c55e" label="Биометрия" sub={biometric ? "Вход по отпечатку или лицу" : "Нужен включённый PIN-код"} on={biometric} onToggle={toggleBiometric} />
        </Group>

        {bioError && (
          <div className="px-4 py-3 -mt-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-400 animate-fade-in flex items-center gap-2">
            <Icon name="TriangleAlert" size={16} className="flex-shrink-0" />
            {bioError}
          </div>
        )}

        <Group title="Защита аккаунта">
          <ToggleRow icon="ShieldAlert" color="#ef4444" label="Оповещать о входах" sub={devicesCount > 1 ? `Ваших устройств: ${devicesCount}` : "Если войдут с нового устройства"} on={loginAlerts} onToggle={toggleLoginAlerts} />
        </Group>

        {loginEvents.length > 0 && (
          <div className="-mt-2">
            <LoginEventsList loginEvents={loginEvents} showLogins={showLogins} setShowLogins={setShowLogins} />
          </div>
        )}

        {currentUser && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5">Способы входа</div>
            <VkLinkRow userId={currentUser.id} />
          </div>
        )}

        <Group title="Данные">
          <LinkRow
            icon={backupProgress === "Готово" ? "Check" : "Download"}
            color="#10b981"
            label="Резервная копия чатов"
            sub={backupProgress || "Сохранить переписку в файл"}
            onClick={exportBackup}
            right={backupBusy ? <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> : undefined}
          />
        </Group>
      </div>

      {pinFlow && (
        <PinDialog pinFlow={pinFlow} setPinFlow={setPinFlow} submitPin={submitPin} />
      )}
    </div>
  );
}

export default SettingsPanel;
