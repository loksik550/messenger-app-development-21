import type { User, Group, GroupMember } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatAtoms";

interface Props {
  info: Group;
  currentUser: User;
  isOwner: boolean;
  adminsList: GroupMember[];
  setRole: (userId: number, role: "admin" | "member") => void;
}

export function GroupAdminsTab({ info, currentUser, isOwner, adminsList, setRole }: Props) {
  return (
          <div className="px-4 py-4 space-y-2 animate-fade-in">
            <p className="text-xs text-muted-foreground px-1">
              Администраторы могут редактировать {info.is_channel ? "канал" : "группу"}, добавлять и удалять участников.
            </p>
            {adminsList.map(m => (
              <div key={m.id} className="flex items-center gap-3 glass rounded-2xl px-3 py-2.5">
                <Avatar label={m.name[0]?.toUpperCase() || "?"} id={m.id} src={m.avatar_url} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.name}</div>
                  <div className="text-[11px]">
                    {m.role === "owner"
                      ? <span className="text-amber-400 font-semibold">👑 Владелец</span>
                      : <span className="text-violet-400 font-semibold">⚡ Администратор</span>}
                  </div>
                </div>
                {isOwner && m.id !== currentUser.id && m.role === "admin" && (
                  <button
                    onClick={() => setRole(m.id, "member")}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/8 hover:bg-white/15"
                  >
                    Снять
                  </button>
                )}
              </div>
            ))}
          </div>
  );
}

export default GroupAdminsTab;
