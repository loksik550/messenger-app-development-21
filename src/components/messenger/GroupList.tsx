import { useState } from "react";
import Icon from "@/components/ui/icon";
import { getDraft } from "@/lib/drafts";
import { api, type Group, type User } from "@/lib/api";
import SwipeRow, { swipeActions } from "@/components/messenger/SwipeRow";

export default function GroupList({
  groups, currentUser, selectedId, showArchived, onSelect, setGroups, onSelectedRemoved,
}: {
  groups: Group[];
  currentUser: User;
  selectedId?: number;
  showArchived: boolean;
  onSelect: (g: Group) => void;
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  onSelectedRemoved: (id: number) => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [target, setTarget] = useState<Group | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const visible = groups.filter(g => !!g.archived === showArchived);
  if (!visible.length) return null;

  const patch = (id: number, p: Partial<Group>) => setGroups(prev => prev.map(g => g.id === id ? { ...g, ...p } : g));

  const toggleMute = async (g: Group) => {
    const next = !g.muted;
    patch(g.id, { muted: next });
    const r = await api("set_group_mute", { group_id: g.id, muted: next }, currentUser.id).catch(() => null);
    if (!r || r.error) patch(g.id, { muted: !next });
  };

  const toggleArchive = async (g: Group) => {
    const next = !g.archived;
    patch(g.id, { archived: next });
    const r = await api("archive_group", { group_id: g.id, archived: next }, currentUser.id).catch(() => null);
    if (!r || r.error) patch(g.id, { archived: !next });
  };

  const isOwner = (g: Group) => Number(g.owner_id) === Number(currentUser.id);
  const kind = (g: Group) => g.is_channel ? "канал" : "группу";

  const confirmDelete = async () => {
    if (!target) return;
    setBusy(true);
    setError("");
    const r = await api(isOwner(target) ? "delete_group" : "leave_group", { group_id: target.id }, currentUser.id).catch(() => null);
    setBusy(false);
    if (!r || r.error) { setError(r?.error || "Не удалось, попробуйте ещё раз"); return; }
    setGroups(prev => prev.filter(x => x.id !== target.id));
    onSelectedRemoved(target.id);
    setTarget(null);
  };

  return (
    <div className="px-2 pt-2 pb-1">
      <div className="flex items-center justify-between mb-1 px-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Группы и каналы</span>
      </div>
      <div className="space-y-0.5 -mx-2">
        {visible.map(g => (
          <SwipeRow
            key={g.id}
            open={openId === g.id}
            onOpenChange={(o) => setOpenId(o ? g.id : (openId === g.id ? null : openId))}
            onTap={() => onSelect(g)}
            actions={swipeActions({
              muted: g.muted,
              archived: g.archived,
              onMute: () => toggleMute(g),
              onDelete: () => { setError(""); setTarget(g); },
              onArchive: () => toggleArchive(g),
            })}
            className={`px-3 py-2.5 ${selectedId === g.id ? "bg-white/8 glass" : "bg-[hsl(var(--background))] hover:bg-white/4"}`}
          >
            {g.avatar_url
              ? <img src={g.avatar_url} className="w-11 h-11 rounded-2xl object-cover flex-shrink-0" />
              : <div className="w-11 h-11 rounded-2xl grad-primary flex items-center justify-center flex-shrink-0">
                  <Icon name={g.is_channel ? "Radio" : "Users"} size={18} className="text-white" />
                </div>
            }
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-sm truncate">{g.name}</span>
                  {g.muted && <Icon name="BellOff" size={11} className="text-muted-foreground flex-shrink-0" />}
                </span>
                {g.last_message_at ? (
                  <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">
                    {new Date(g.last_message_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {getDraft(`g${g.id}`) && selectedId !== g.id
                    ? <><span className="text-red-400">Черновик: </span>{getDraft(`g${g.id}`)}</>
                    : (g.last_message || `${g.members_count ?? 0} участников`)}
                </div>
                {g.unread_count ? (
                  <span className={`flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${g.muted ? "bg-white/15" : "grad-primary"}`}>
                    {g.unread_count > 99 ? "99+" : g.unread_count}
                  </span>
                ) : null}
              </div>
            </div>
          </SwipeRow>
        ))}
      </div>

      {target && (
        <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 animate-fade-in" onClick={() => !busy && setTarget(null)}>
          <div className="w-full max-w-sm glass-strong rounded-3xl p-5 animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-1 truncate">
              {isOwner(target) ? `Удалить ${kind(target)} «${target.name}»?` : `Выйти из «${target.name}»?`}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isOwner(target)
                ? `Вы владелец — ${kind(target)} будет удалён(а) у всех участников вместе с сообщениями. Это нельзя отменить.`
                : `${target.is_channel ? "Канал" : "Группа"} исчезнет из вашего списка. Вернуться можно по ссылке-приглашению.`}
            </p>
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDelete}
                disabled={busy}
                className="w-full rounded-xl py-3 text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50"
              >
                {busy ? "..." : isOwner(target) ? `Удалить ${kind(target)}` : "Выйти и удалить из списка"}
              </button>
              <button onClick={() => setTarget(null)} disabled={busy} className="w-full rounded-xl py-3 text-sm font-semibold glass">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
