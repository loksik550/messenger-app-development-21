import Icon from "@/components/ui/icon";
import type { User, GroupMember } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatAtoms";

interface Props {
  currentUser: User;
  isAdmin: boolean;
  isOwner: boolean;
  visibleMembers: GroupMember[];
  memberSearch: string;
  setMemberSearch: (v: string) => void;
  setShowAddMember: (v: boolean) => void;
  setRole: (userId: number, role: "admin" | "member") => void;
  setConfirmKick: (v: { id: number; name: string } | null) => void;
}

export function GroupMembersTab({
  currentUser, isAdmin, isOwner, visibleMembers,
  memberSearch, setMemberSearch, setShowAddMember, setRole, setConfirmKick,
}: Props) {
  return (
          <div className="px-4 py-4 space-y-2 animate-fade-in">
            {isAdmin && (
              <button
                onClick={() => setShowAddMember(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl glass hover:bg-white/8 transition"
              >
                <div className="w-10 h-10 rounded-2xl bg-violet-500/15 flex items-center justify-center">
                  <Icon name="UserPlus" size={18} className="text-violet-400" />
                </div>
                <span className="text-sm font-semibold text-violet-300">Добавить участника</span>
              </button>
            )}

            <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
              <Icon name="Search" size={14} className="text-muted-foreground" />
              <input
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Поиск по участникам"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>

            <div className="space-y-0.5">
              {visibleMembers.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/5">
                  <Avatar label={m.name[0]?.toUpperCase() || "?"} id={m.id} src={m.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-1.5 truncate">
                      <span className="truncate">{m.name}</span>
                      {m.id === currentUser.id && <span className="text-[10px] text-muted-foreground flex-shrink-0">(вы)</span>}
                    </div>
                    <div className="text-[11px] flex items-center gap-1">
                      {m.role === "owner" && <span className="text-amber-400 font-semibold">👑 Владелец</span>}
                      {m.role === "admin" && <span className="text-violet-400 font-semibold">⚡ Администратор</span>}
                      {m.role === "member" && <span className="text-muted-foreground">Участник</span>}
                    </div>
                  </div>
                  {isAdmin && m.id !== currentUser.id && m.role !== "owner" && (
                    <div className="flex gap-1 flex-shrink-0">
                      {isOwner && (
                        <button
                          onClick={() => setRole(m.id, m.role === "admin" ? "member" : "admin")}
                          className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground"
                          title={m.role === "admin" ? "Понизить" : "Сделать админом"}
                        >
                          <Icon name={m.role === "admin" ? "ShieldOff" : "ShieldCheck"} size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmKick({ id: m.id, name: m.name })}
                        className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-400" title="Исключить"
                      >
                        <Icon name="UserMinus" size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {visibleMembers.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Никого не нашли</p>
              )}
            </div>
          </div>
  );
}

export default GroupMembersTab;
