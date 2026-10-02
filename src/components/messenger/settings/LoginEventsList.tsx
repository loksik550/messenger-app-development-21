import Icon from "@/components/ui/icon";

export type LoginEvent = { device: string; ip: string; is_new: boolean; ts: number };

export function LoginEventsList({
  loginEvents,
  showLogins,
  setShowLogins,
}: {
  loginEvents: LoginEvent[];
  showLogins: boolean;
  setShowLogins: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
          <div className="glass rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowLogins(v => !v)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                <Icon name="History" size={18} className="text-violet-400" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium">Последние входы</div>
                <div className="text-xs text-muted-foreground truncate">
                  Проверьте, всё ли это ваши устройства
                </div>
              </div>
              <Icon name={showLogins ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground flex-shrink-0" />
            </button>

            {showLogins && (
              <div className="border-t border-white/5">
                {loginEvents.map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ev.is_new ? "bg-amber-500/15" : "bg-white/5"}`}>
                      <Icon
                        name={ev.is_new ? "ShieldAlert" : "Smartphone"}
                        size={15}
                        className={ev.is_new ? "text-amber-400" : "text-muted-foreground"}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">
                        {ev.device}
                        {ev.is_new && <span className="text-[10px] text-amber-400 ml-1.5">новое</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(ev.ts * 1000).toLocaleString("ru", {
                          day: "numeric", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                  Не узнаёте устройство? Смените PIN-код и завершите чужие сеансы
                  в разделе «Безопасность и приватность».
                </div>
              </div>
            )}
          </div>
  );
}

export default LoginEventsList;
