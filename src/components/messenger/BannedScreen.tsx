import Icon from "@/components/ui/icon";

export interface BanInfo {
  banned_until: number | null;
  banned_reason: string;
  forever?: boolean;
}

function formatUntil(ts: number | null, forever?: boolean) {
  if (!ts) return "";
  if (forever) return "бессрочно";
  const d = new Date(ts * 1000);
  return d.toLocaleString("ru", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeLeft(ts: number | null) {
  if (!ts) return "";
  const sec = ts - Math.floor(Date.now() / 1000);
  if (sec <= 0) return "";
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  if (days > 0) return `${days} дн. ${hours} ч.`;
  const mins = Math.floor((sec % 3600) / 60);
  return `${hours} ч. ${mins} мин.`;
}

export default function BannedScreen({
  info, onLogout, onSupport,
}: {
  info: BanInfo;
  onLogout: () => void;
  onSupport?: () => void;
}) {
  const forever = info.forever || (info.banned_until
    ? info.banned_until - Math.floor(Date.now() / 1000) > 86400 * 3000
    : false);

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 rounded-3xl bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-5">
          <Icon name="ShieldX" size={40} className="text-red-400" />
        </div>

        <h1 className="text-2xl font-bold mb-2">Аккаунт заблокирован</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Доступ к Nova ограничен за нарушение правил сервиса.
        </p>

        <div className="glass rounded-2xl p-4 text-left space-y-3 mb-5">
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Причина</div>
            <div className="text-sm font-medium">
              {info.banned_reason || "Нарушение правил сервиса"}
            </div>
          </div>

          <div className="border-t border-white/8 pt-3">
            <div className="text-[11px] text-muted-foreground mb-1">Срок блокировки</div>
            <div className="text-sm font-medium">
              {forever ? "Бессрочно" : `До ${formatUntil(info.banned_until)}`}
            </div>
            {!forever && timeLeft(info.banned_until) && (
              <div className="text-xs text-amber-400 mt-1">
                Осталось: {timeLeft(info.banned_until)}
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
          Если считаете блокировку ошибочной, напишите в поддержку — команда
          пересмотрит решение.
        </p>

        <div className="space-y-2">
          {onSupport && (
            <button
              onClick={onSupport}
              className="w-full py-3.5 grad-primary rounded-2xl text-white font-bold glow-primary hover:opacity-90 transition"
            >
              Обжаловать блокировку
            </button>
          )}
          <button
            onClick={onLogout}
            className="w-full py-3.5 glass rounded-2xl font-semibold text-muted-foreground hover:bg-white/5 transition"
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}
