import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/api";
import { useGroupCall } from "./useGroupCall";

export interface GroupCallTarget { id: number; name: string; avatar_url?: string | null }

export function startGroupCall(group: GroupCallTarget) {
  window.dispatchEvent(new CustomEvent("nova:gcall-join", { detail: group }));
}

export default function GroupCallHost({ currentUser }: { currentUser: User }) {
  const [group, setGroup] = useState<GroupCallTarget | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      const g = (e as CustomEvent<GroupCallTarget>).detail;
      setGroup((cur) => cur || g);
    };
    window.addEventListener("nova:gcall-join", on);
    return () => window.removeEventListener("nova:gcall-join", on);
  }, []);
  if (!group) return null;
  return <GroupCallScreen key={group.id} group={group} me={currentUser} onClosed={() => setGroup(null)} />;
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function GroupCallScreen({ group, me, onClosed }: { group: GroupCallTarget; me: User; onClosed: () => void }) {
  const c = useGroupCall(group.id, me, onClosed);
  const [mini, setMini] = useState(false);

  if (c.state === "error") {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 animate-fade-in">
        <div className="glass-strong rounded-3xl p-6 max-w-sm w-full text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 flex items-center justify-center mb-3">
            <Icon name="PhoneOff" size={26} className="text-red-400" />
          </div>
          <h3 className="font-bold text-lg mb-1">Не получилось подключиться</h3>
          <p className="text-sm text-muted-foreground mb-5">{c.error}</p>
          <button onClick={onClosed} className="w-full py-3 rounded-2xl glass font-semibold">Закрыть</button>
        </div>
      </div>
    );
  }

  if (mini) {
    return (
      <button
        onClick={() => setMini(false)}
        className="fixed left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-900/40 animate-fade-in"
        style={{ top: "calc(0.5rem + env(safe-area-inset-top))" }}
      >
        <Icon name="Phone" size={16} />
        <span className="text-sm font-semibold max-w-[160px] truncate">{group.name}</span>
        <span className="text-xs opacity-80">{c.participants.length} · {fmt(c.duration)}</span>
      </button>
    );
  }

  const others = c.participants.filter((p) => p.user_id !== me.id);
  const meP = { user_id: me.id, name: "Вы", avatar_url: me.avatar_url, muted: c.muted };
  const tiles = [meP, ...others];

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-gradient-to-b from-[#1a1033] to-[#0a0814] animate-fade-in" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setMini(true)} className="p-2 -ml-2 rounded-xl hover:bg-white/8" aria-label="Свернуть">
          <Icon name="ChevronDown" size={22} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <div className="font-bold truncate">{group.name}</div>
          <div className="text-xs text-muted-foreground">
            {c.state === "joining" ? "Подключаемся..." : `Групповой звонок · ${fmt(c.duration)}`}
          </div>
        </div>
        <div className="w-9 text-xs text-muted-foreground text-right">{tiles.length}/8</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className={`grid gap-4 max-w-md mx-auto ${tiles.length <= 2 ? "grid-cols-2" : tiles.length <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
          {tiles.map((p) => {
            const isMe = p.user_id === me.id;
            const talking = !p.muted && (isMe ? false : c.speaking.has(p.user_id));
            const linking = !isMe && !c.connected.has(p.user_id);
            return (
              <div key={p.user_id} className="flex flex-col items-center gap-2">
                <div className={`relative rounded-full p-1 transition-all ${talking ? "ring-4 ring-emerald-400/80" : "ring-2 ring-white/10"}`}>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className={`w-20 h-20 rounded-full object-cover ${linking ? "opacity-50" : ""}`} />
                  ) : (
                    <div className={`w-20 h-20 rounded-full grad-primary flex items-center justify-center text-2xl font-bold text-white ${linking ? "opacity-50" : ""}`}>
                      {(isMe ? me.name : p.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  {p.muted && (
                    <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center border-2 border-[#120b24]">
                      <Icon name="MicOff" size={13} className="text-white" />
                    </span>
                  )}
                </div>
                <div className="text-xs font-semibold text-center truncate max-w-[96px]">{isMe ? "Вы" : p.name}</div>
                {linking && <div className="text-[10px] text-muted-foreground -mt-1.5">соединяем...</div>}
              </div>
            );
          })}
        </div>
        {others.length === 0 && c.state === "active" && (
          <p className="text-center text-sm text-muted-foreground mt-8">Ждём участников — мы уже сообщили группе о звонке</p>
        )}
      </div>

      <div className="flex items-center justify-center gap-8 pb-8 pt-4">
        <button onClick={c.toggleMute} className="flex flex-col items-center gap-1.5">
          <span className={`w-16 h-16 rounded-full flex items-center justify-center ${c.muted ? "bg-white text-[#120b24]" : "bg-white/12 text-white"}`}>
            <Icon name={c.muted ? "MicOff" : "Mic"} size={26} />
          </span>
          <span className="text-xs text-muted-foreground">{c.muted ? "Включить" : "Микрофон"}</span>
        </button>
        <button onClick={c.leave} className="flex flex-col items-center gap-1.5">
          <span className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-900/40">
            <Icon name="PhoneOff" size={26} />
          </span>
          <span className="text-xs text-muted-foreground">Выйти</span>
        </button>
      </div>
    </div>
  );
}
