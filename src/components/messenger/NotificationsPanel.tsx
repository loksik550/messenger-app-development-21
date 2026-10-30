import { useState, useEffect } from "react";
import { api, subscribeToPush, type User } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { useSettingsSounds } from "@/components/messenger/settings/useSettingsSounds";
import { SoundsSection } from "@/components/messenger/settings/SoundsSection";
import { SettingsGroup, SettingsHeader, SettingsRow, SettingsToggleRow } from "@/components/messenger/settings/SettingsUI";

export default function NotificationsPanel({
  currentUser, onClose, onUserUpdate,
}: {
  currentUser: User; onClose: () => void; onUserUpdate: (u: User) => void;
}) {
  useEdgeSwipeBack(onClose);
  const [msg, setMsg] = useState<boolean>(currentUser.notify_messages ?? true);
  const [grp, setGrp] = useState<boolean>(currentUser.notify_groups ?? true);
  const [preview, setPreview] = useState<boolean>(currentUser.notify_preview ?? true);
  const sounds = useSettingsSounds();

  const [pushPerm, setPushPerm] = useState<NotificationPermission | "unsupported">("default");
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    setPushPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
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
    onUserUpdate({ ...currentUser, [field]: value } as User);
    await api("update_user_settings", { [field]: value }, currentUser.id).catch(() => null);
  };

  return (
    <div className="fixed inset-0 z-[260] bg-background flex flex-col animate-fade-in">
      <SettingsHeader title="Уведомления" sub="Что и как сообщать" onBack={onClose} />

      <div className="flex-1 overflow-y-auto px-4 space-y-5" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
        {pushPerm !== "unsupported" && (
          <SettingsGroup
            footer={pushPerm === "denied" ? "Разрешение отклонено. Включите уведомления для Nova в настройках телефона или браузера." : undefined}
          >
            <SettingsRow
              icon={pushPerm === "granted" ? "BellRing" : "BellOff"}
              color={pushPerm === "granted" ? "#22c55e" : "#8b5cf6"}
              label="Push-уведомления"
              sub={pushPerm === "granted" ? "Включены на этом устройстве" : "Сообщения, даже когда Nova закрыт"}
              right={
                pushPerm === "default" ? (
                  <button onClick={enablePush} disabled={pushBusy} className="px-3 py-1.5 rounded-xl grad-primary text-white text-xs font-bold disabled:opacity-50 flex-shrink-0">
                    {pushBusy ? "..." : "Включить"}
                  </button>
                ) : pushPerm === "granted" ? (
                  <span className="text-xs font-semibold text-emerald-400 flex-shrink-0">Вкл</span>
                ) : (
                  <span className="text-xs font-semibold text-red-400 flex-shrink-0">Выкл</span>
                )
              }
            />
          </SettingsGroup>
        )}

        <SettingsGroup title="Сообщения">
          <SettingsToggleRow icon="MessageCircle" color="#8b5cf6" label="Личные чаты" sub="Новые сообщения от людей" on={msg} onToggle={() => { const v = !msg; setMsg(v); update("notify_messages", v); }} />
          <SettingsToggleRow icon="Users" color="#06b6d4" label="Группы и каналы" sub="Новые сообщения и публикации" on={grp} onToggle={() => { const v = !grp; setGrp(v); update("notify_groups", v); }} />
          <SettingsToggleRow icon="Eye" color="#3b82f6" label="Показывать текст" sub={preview ? "Текст сообщения виден в уведомлении" : "Только «Новое сообщение»"} on={preview} onToggle={() => { const v = !preview; setPreview(v); update("notify_preview", v); }} />
        </SettingsGroup>

        <SoundsSection sounds={sounds} />

        <p className="text-[11px] text-muted-foreground px-3 leading-relaxed">
          Отключить уведомления от отдельного чата можно в самом чате: смахните его влево в списке и нажмите «Убрать звук».
        </p>
      </div>
    </div>
  );
}
