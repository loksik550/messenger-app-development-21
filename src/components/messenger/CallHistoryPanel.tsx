import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatAtoms";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { formatDateLabel } from "@/components/messenger/dateGroup";
import { track } from "@/lib/track";

type Kind = "incoming" | "outgoing" | "missed" | "declined" | "declined_by_me" | "cancelled";

interface CallItem {
  call_id: string;
  kind: Kind;
  outgoing: boolean;
  is_video: boolean;
  started_at: number;
  duration: number;
  partner: { id: number; name: string; avatar_url?: string | null };
}

const KIND_META: Record<Kind, { label: string; icon: string; color: string }> = {
  incoming: { label: "Входящий", icon: "PhoneIncoming", color: "text-emerald-400" },
  outgoing: { label: "Исходящий", icon: "PhoneOutgoing", color: "text-sky-400" },
  missed: { label: "Пропущенный", icon: "PhoneMissed", color: "text-red-400" },
  declined_by_me: { label: "Отклонён", icon: "PhoneOff", color: "text-red-400" },
  declined: { label: "Не принят", icon: "PhoneOff", color: "text-amber-400" },
  cancelled: { label: "Отменён", icon: "PhoneOutgoing", color: "text-muted-foreground" },
};

type Filter = "all" | "missed";

function fmtDuration(s: number) {
  if (s <= 0) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h} ч ${m} мин`;
  if (m) return `${m} мин ${sec} с`;
  return `${sec} с`;
}

function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}

export default function CallHistoryPanel({
  currentUser, onClose, onCall, onVideoCall, onOpenChat,
}: {
  currentUser: User;
  onClose: () => void;
  onCall: (userId: number, name: string) => void;
  onVideoCall: (userId: number, name: string) => void;
  onOpenChat: (userId: number) => void;
}) {
  useEdgeSwipeBack(onClose);
  const [items, setItems] = useState<CallItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmClear, setConfirmClear] = useState(false);

  const load = () => {
    api("call_history", {}, currentUser.id)
      .then(r => setItems(Array.isArray(r?.calls) ? r.calls : []))
      .catch(() => setItems(prev => prev ?? []));
  };

  useEffect(() => { load(); track("call_history_open"); }, [currentUser.id]);

  const clear = async () => {
    setConfirmClear(false);
    setItems([]);
    await api("call_history_clear", {}, currentUser.id).catch(() => null);
  };

  const list = (items || []).filter(i => filter === "all" || i.kind === "missed");
  let prevDay = "";

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0f0c1d] animate-fade-in">
      <div className="px-4 pb-3 flex items-center gap-2 border-b border-white/5" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8 transition-colors" aria-label="Назад">
          <Icon name="ChevronLeft" size={22} />
        </button>
        <h2 className="text-xl font-bold flex-1">Звонки</h2>
        {(items?.length || 0) > 0 && (
          <button onClick={() => setConfirmClear(true)} className="p-2 rounded-xl hover:bg-white/8 text-muted-foreground" aria-label="Очистить журнал">
            <Icon name="Trash2" size={18} />
          </button>
        )}
      </div>

      <div className="px-4 py-3 flex gap-2">
        {([["all", "Все"], ["missed", "Пропущенные"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${filter === k ? "grad-primary text-white" : "glass text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
        {items === null ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-6 text-muted-foreground">
            <div className="w-16 h-16 rounded-full glass flex items-center justify-center mb-4">
              <Icon name="Phone" size={26} />
            </div>
            <div className="font-semibold text-foreground mb-1">{filter === "missed" ? "Пропущенных нет" : "Звонков пока нет"}</div>
            <div className="text-sm">Здесь появятся все входящие, исходящие и пропущенные звонки</div>
          </div>
        ) : list.map(it => {
          const meta = KIND_META[it.kind] || KIND_META.outgoing;
          const day = formatDateLabel(it.started_at);
          const showDay = day !== prevDay;
          prevDay = day;
          const dur = fmtDuration(it.duration);
          return (
            <div key={it.call_id}>
              {showDay && <div className="px-2 pt-4 pb-1.5 text-[11px] uppercase tracking-widest text-muted-foreground font-semibold capitalize">{day}</div>}
              <div className="flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-white/5 transition-colors">
                <button onClick={() => onOpenChat(it.partner.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <Avatar label={(it.partner.name || "?")[0].toUpperCase()} id={it.partner.id} src={it.partner.avatar_url || undefined} />
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold truncate ${it.kind === "missed" ? "text-red-400" : ""}`}>{it.partner.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon name={meta.icon} size={13} className={meta.color} />
                      <span>{meta.label}{it.is_video ? " видео" : ""}</span>
                      <span>· {fmtTime(it.started_at)}</span>
                      {dur && <span>· {dur}</span>}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => (it.is_video ? onVideoCall : onCall)(it.partner.id, it.partner.name)}
                  className="p-2.5 rounded-full hover:bg-white/8 text-violet-400"
                  aria-label="Перезвонить"
                >
                  <Icon name={it.is_video ? "Video" : "Phone"} size={19} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {confirmClear && (
        <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-6" onClick={() => setConfirmClear(false)}>
          <div className="glass-strong rounded-2xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="font-bold mb-1">Очистить журнал звонков?</div>
            <div className="text-sm text-muted-foreground mb-4">Журнал очистится только у вас.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmClear(false)} className="px-4 py-2 rounded-xl hover:bg-white/8 text-sm">Отмена</button>
              <button onClick={clear} className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold">Очистить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
