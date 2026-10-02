import Icon from "@/components/ui/icon";

export function NotificationsInfo({
  notifications,
  msgPreview,
  pushPerm,
  requestPushPerm,
}: {
  notifications: boolean;
  msgPreview: boolean;
  pushPerm: NotificationPermission;
  requestPushPerm: () => void;
}) {
  return (
    <>
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
    </>
  );
}

export default NotificationsInfo;
