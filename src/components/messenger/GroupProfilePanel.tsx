import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, uploadMedia, type User, type Group, type GroupMember } from "@/lib/api";
import { ConfirmDialog } from "@/components/messenger/ConfirmDialog";
import { AddMemberModal } from "@/components/messenger/AddMemberModal";
import { useGroupProfileData } from "@/components/messenger/group-profile/useGroupProfileData";
import { useGroupMemberActions } from "@/components/messenger/group-profile/useGroupMemberActions";
import { GroupInfoTab } from "@/components/messenger/group-profile/GroupInfoTab";
import { GroupMembersTab } from "@/components/messenger/group-profile/GroupMembersTab";
import { GroupAdminsTab } from "@/components/messenger/group-profile/GroupAdminsTab";

type Tab = "info" | "members" | "admins";

interface Props {
  group: Group;
  members: GroupMember[];
  currentUser: User;
  myRole?: string;
  onClose: () => void;
  onGroupUpdated: (g: Group) => void;
  onMembersChanged: () => void;
  onGroupDeleted?: () => void;
  onHistoryCleared?: () => void;
}

export function GroupProfilePanel({
  group, members, currentUser, myRole,
  onClose, onGroupUpdated, onMembersChanged, onGroupDeleted, onHistoryCleared,
}: Props) {
  const isOwner = myRole === "owner";
  const data = useGroupProfileData(group, currentUser);
  const { info, setInfo } = data;
  const isAdmin = isOwner || myRole === "admin";

  const [tab, setTab] = useState<Tab>("info");
  const [editName, setEditName] = useState(group.name);
  const [editDesc, setEditDesc] = useState(group.description || "");
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [savingField, setSavingField] = useState<"name" | "desc" | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const m = useGroupMemberActions({
    group, members, currentUser,
    onClose, onMembersChanged, onGroupDeleted, onHistoryCleared,
  });
  const {
    adminsList, showAddMember, setShowAddMember, contacts, filteredContacts,
    contactSearch, setContactSearch, addingId, addMember,
    confirmKick, setConfirmKick, confirmLeave, setConfirmLeave,
    confirmDelete, setConfirmDelete, confirmClear, setConfirmClear,
    busy, kick, leave, deleteGroup, clearHistory,
  } = m;

  const saveName = async () => {
    const v = editName.trim();
    if (!v || v === info.name) { setEditingName(false); return; }
    setSavingField("name");
    const r = await api("update_group", { group_id: group.id, name: v }, currentUser.id);
    setSavingField(null);
    setEditingName(false);
    if (r?.error) { alert(r.error); return; }
    setInfo({ ...info, name: v });
    onGroupUpdated({ ...group, name: v });
  };

  const saveDesc = async () => {
    const v = editDesc.trim();
    if (v === (info.description || "")) { setEditingDesc(false); return; }
    setSavingField("desc");
    const r = await api("update_group", { group_id: group.id, description: v }, currentUser.id);
    setSavingField(null);
    setEditingDesc(false);
    if (r?.error) { alert(r.error); return; }
    setInfo({ ...info, description: v });
    onGroupUpdated({ ...group, description: v });
  };

  const pickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setUploadingAvatar(true);
    try {
      const upload = await uploadMedia(f, currentUser.id);
      await api("update_group", { group_id: group.id, avatar_url: upload.url }, currentUser.id);
      setInfo({ ...info, avatar_url: upload.url });
      onGroupUpdated({ ...group, avatar_url: upload.url });
    } catch {
      alert("Не удалось загрузить аватар");
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-[hsl(var(--background))] animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 glass-strong border-b border-white/5 flex-shrink-0"
        style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 -ml-1 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="font-bold flex-1 truncate">{info.is_channel ? "Информация о канале" : "Информация о группе"}</h2>
        {savingField && <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />}
      </div>

      <input type="file" ref={fileRef} accept="image/*" hidden onChange={pickAvatar} />

      <div className="flex-1 overflow-y-auto">
        {/* Avatar + name */}
        <div className="flex flex-col items-center py-6 px-4 text-center">
          <button
            onClick={() => isAdmin && fileRef.current?.click()}
            disabled={!isAdmin || uploadingAvatar}
            className="relative group"
          >
            {info.avatar_url ? (
              <img src={info.avatar_url} className="w-24 h-24 rounded-3xl object-cover" alt={info.name} />
            ) : (
              <div className="w-24 h-24 rounded-3xl grad-primary flex items-center justify-center">
                <Icon name={info.is_channel ? "Radio" : "Users"} size={40} className="text-white" />
              </div>
            )}
            {isAdmin && (
              <div className="absolute inset-0 bg-black/50 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                {uploadingAvatar
                  ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Icon name="Camera" size={22} className="text-white" />}
              </div>
            )}
          </button>

          {editingName ? (
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditName(info.name); setEditingName(false); } }}
              className="mt-3 text-xl font-bold bg-transparent border-b-2 border-violet-500 text-center outline-none pb-0.5 w-full max-w-xs"
            />
          ) : (
            <button
              onClick={() => isAdmin && setEditingName(true)}
              disabled={!isAdmin}
              className={`mt-3 text-xl font-bold flex items-center gap-2 ${isAdmin ? "hover:text-violet-300" : ""}`}
            >
              {info.is_channel && <Icon name="Radio" size={16} className="text-sky-400" />}
              <span>{info.name}</span>
              {isAdmin && <Icon name="Pencil" size={14} className="text-muted-foreground" />}
            </button>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {info.is_channel ? "Канал" : "Группа"} · {info.members_count ?? members.length} {(info.members_count ?? members.length) === 1 ? "участник" : "участников"}
          </p>
        </div>

        {/* Tabs */}
        <div className="px-4">
          <div className="glass rounded-2xl p-1 flex">
            <button
              onClick={() => setTab("info")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${tab === "info" ? "grad-primary text-white" : "text-muted-foreground"}`}
            >
              Описание
            </button>
            <button
              onClick={() => setTab("members")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${tab === "members" ? "grad-primary text-white" : "text-muted-foreground"}`}
            >
              Участники · {members.length}
            </button>
            <button
              onClick={() => setTab("admins")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${tab === "admins" ? "grad-primary text-white" : "text-muted-foreground"}`}
            >
              Админы · {adminsList.length}
            </button>
          </div>
        </div>

        {/* TAB: INFO */}
        {tab === "info" && (
          <GroupInfoTab
            info={info}
            isAdmin={isAdmin}
            isOwner={isOwner}
            editingDesc={editingDesc}
            setEditingDesc={setEditingDesc}
            editDesc={editDesc}
            setEditDesc={setEditDesc}
            saveDesc={saveDesc}
            fullInviteUrl={data.fullInviteUrl}
            copyState={data.copyState}
            copyInvite={data.copyInvite}
            regenBusy={data.regenBusy}
            regenerateInvite={data.regenerateInvite}
            verifState={data.verifState}
            verifBusy={data.verifBusy}
            applyVerification={data.applyVerification}
            onlyAdmins={data.onlyAdmins}
            toggleOnlyAdmins={data.toggleOnlyAdmins}
            muted={data.muted}
            muteLabel={data.muteLabel}
            muteMenuOpen={data.muteMenuOpen}
            setMuteMenuOpen={data.setMuteMenuOpen}
            applyMute={data.applyMute}
            setConfirmClear={setConfirmClear}
            setConfirmLeave={setConfirmLeave}
            setConfirmDelete={setConfirmDelete}
          />
        )}

        {/* TAB: MEMBERS */}
        {tab === "members" && (
          <GroupMembersTab
            currentUser={currentUser}
            isAdmin={isAdmin}
            isOwner={isOwner}
            visibleMembers={m.visibleMembers}
            memberSearch={m.memberSearch}
            setMemberSearch={m.setMemberSearch}
            setShowAddMember={setShowAddMember}
            setRole={m.setRole}
            setConfirmKick={setConfirmKick}
          />
        )}

        {/* TAB: ADMINS */}
        {tab === "admins" && (
          <GroupAdminsTab
            info={info}
            currentUser={currentUser}
            isOwner={isOwner}
            adminsList={adminsList}
            setRole={m.setRole}
          />
        )}
      </div>

      <AddMemberModal
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        contacts={contacts}
        filteredContacts={filteredContacts}
        contactSearch={contactSearch}
        setContactSearch={setContactSearch}
        addingId={addingId}
        onAdd={addMember}
      />

      {/* === Confirms === */}
      {confirmKick && (
        <ConfirmDialog
          title="Исключить участника?"
          text={`${confirmKick.name} больше не сможет писать в ${info.is_channel ? "канал" : "группу"}.`}
          danger
          loading={busy}
          onCancel={() => setConfirmKick(null)}
          onConfirm={kick}
        />
      )}
      {confirmLeave && (
        <ConfirmDialog
          title={`Покинуть ${info.is_channel ? "канал" : "группу"}?`}
          text="Вы перестанете получать новые сообщения. Вернуться можно по приглашению."
          danger
          loading={busy}
          onCancel={() => setConfirmLeave(false)}
          onConfirm={leave}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={`Удалить ${info.is_channel ? "канал" : "группу"}?`}
          text="Все сообщения и участники будут удалены навсегда. Это действие нельзя отменить."
          danger
          loading={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={deleteGroup}
        />
      )}
      {confirmClear && (
        <ConfirmDialog
          title="Очистить переписку?"
          text="Все сообщения скроются только у вас. Остальные участники продолжат видеть их."
          danger
          loading={busy}
          onCancel={() => setConfirmClear(false)}
          onConfirm={clearHistory}
        />
      )}
    </div>
  );
}

export default GroupProfilePanel;