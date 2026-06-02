import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, uploadMedia, type User, type Group, type GroupMember, type Contact } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatAtoms";
import { ConfirmDialog } from "@/components/messenger/ConfirmDialog";
import { AddMemberModal } from "@/components/messenger/AddMemberModal";
import { groupMuteLabel } from "@/components/messenger/groupProfileUtils";

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
}

export function GroupProfilePanel({
  group, members, currentUser, myRole,
  onClose, onGroupUpdated, onMembersChanged, onGroupDeleted,
}: Props) {
  const isOwner = myRole === "owner";
  const isAdmin = isOwner || myRole === "admin";

  const [tab, setTab] = useState<Tab>("info");
  const [editName, setEditName] = useState(group.name);
  const [editDesc, setEditDesc] = useState(group.description || "");
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [savingField, setSavingField] = useState<"name" | "desc" | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [info, setInfo] = useState<Group>(group);
  const [inviteLink, setInviteLink] = useState<string>(group.invite_link || "");
  const [copyState, setCopyState] = useState<"idle" | "ok">("idle");
  const [regenBusy, setRegenBusy] = useState(false);

  const [memberSearch, setMemberSearch] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [addingId, setAddingId] = useState<number | null>(null);

  const [confirmKick, setConfirmKick] = useState<{ id: number; name: string } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [onlyAdmins, setOnlyAdmins] = useState<boolean>(false);

  // mute
  const [muted, setMuted] = useState(false);
  const [mutedUntil, setMutedUntil] = useState(0);
  const [muteMenuOpen, setMuteMenuOpen] = useState(false);

  // Подгружаем актуальную инфу
  useEffect(() => {
    api("get_group_info", { group_id: group.id }, currentUser.id).then(d => {
      if (d?.group) {
        setInfo(d.group);
        if (d.group.invite_link) setInviteLink(d.group.invite_link);
        setOnlyAdmins(!!d.group.only_admins_post);
      }
    });
    // подтягиваем mute-статус
    api("get_mute_settings", {}, currentUser.id).then(d => {
      const entry = (d?.muted_groups || []).find((g: { group_id: number; muted_until: number }) => g.group_id === group.id);
      if (entry) {
        setMuted(true);
        setMutedUntil(entry.muted_until || 0);
      } else {
        setMuted(false);
        setMutedUntil(0);
      }
    });
  }, [group.id, currentUser.id]);

  const applyMute = async (mute: boolean, hours?: number) => {
    setMuteMenuOpen(false);
    const prev = { muted, mutedUntil };
    setMuted(mute);
    setMutedUntil(mute && hours ? Math.floor(Date.now() / 1000) + hours * 3600 : 0);
    const r = await api(
      "set_group_mute",
      { group_id: group.id, muted: mute, ...(hours ? { hours } : {}) },
      currentUser.id,
    );
    if (r?.error) {
      setMuted(prev.muted);
      setMutedUntil(prev.mutedUntil);
      alert(r.error);
    }
  };

  const muteLabel = groupMuteLabel(muted, mutedUntil);

  const toggleOnlyAdmins = async () => {
    const next = !onlyAdmins;
    setOnlyAdmins(next);
    const r = await api("set_group_only_admins", { group_id: group.id, only_admins_post: next }, currentUser.id);
    if (r?.error) { setOnlyAdmins(!next); alert(r.error); }
  };

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

  const fullInviteUrl = inviteLink ? `${window.location.origin}/?join=${inviteLink}` : "";

  const copyInvite = async () => {
    if (!fullInviteUrl) return;
    try {
      await navigator.clipboard.writeText(fullInviteUrl);
      setCopyState("ok");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      alert("Не получилось скопировать. Скопируй вручную: " + fullInviteUrl);
    }
  };

  const regenerateInvite = async () => {
    if (!confirm("Старая ссылка перестанет работать. Продолжить?")) return;
    setRegenBusy(true);
    const r = await api("regenerate_group_invite", { group_id: group.id }, currentUser.id);
    setRegenBusy(false);
    if (r?.invite_link) {
      setInviteLink(r.invite_link);
    } else if (r?.error) {
      alert(r.error);
    }
  };

  const setRole = async (userId: number, role: "admin" | "member") => {
    const r = await api("set_member_role", { group_id: group.id, target_user_id: userId, role }, currentUser.id);
    if (r?.error) { alert(r.error); return; }
    onMembersChanged();
  };

  const kick = async () => {
    if (!confirmKick) return;
    setBusy(true);
    const r = await api("remove_group_member", { group_id: group.id, kick_user_id: confirmKick.id }, currentUser.id);
    setBusy(false);
    setConfirmKick(null);
    if (r?.error) { alert(r.error); return; }
    onMembersChanged();
  };

  const leave = async () => {
    setBusy(true);
    const r = await api("leave_group", { group_id: group.id }, currentUser.id);
    setBusy(false);
    setConfirmLeave(false);
    if (r?.error) { alert(r.error); return; }
    onGroupDeleted?.();
    onClose();
  };

  const deleteGroup = async () => {
    setBusy(true);
    const r = await api("delete_group", { group_id: group.id }, currentUser.id);
    setBusy(false);
    setConfirmDelete(false);
    if (r?.error) { alert(r.error); return; }
    onGroupDeleted?.();
    onClose();
  };

  // Контакты для добавления
  useEffect(() => {
    if (!showAddMember) return;
    api("get_contacts", {}, currentUser.id).then(d => {
      if (Array.isArray(d?.contacts)) setContacts(d.contacts);
    });
  }, [showAddMember, currentUser.id]);

  const addMember = async (uid: number) => {
    setAddingId(uid);
    const r = await api("add_group_member", { group_id: group.id, new_user_id: uid }, currentUser.id);
    setAddingId(null);
    if (r?.error) { alert(r.error); return; }
    onMembersChanged();
  };

  const visibleMembers = members.filter(m =>
    !memberSearch.trim() || m.name.toLowerCase().includes(memberSearch.trim().toLowerCase())
  );

  const memberIds = new Set(members.map(m => m.id));
  const filteredContacts = contacts.filter(c =>
    !memberIds.has(c.id) &&
    (!contactSearch.trim() || c.name.toLowerCase().includes(contactSearch.trim().toLowerCase()) || c.phone.includes(contactSearch.trim()))
  );

  const adminsList = members.filter(m => m.role === "owner" || m.role === "admin");
  const fmtDate = (ts: number) => ts ? new Date(ts * 1000).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" }) : "";

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
          <div className="px-4 py-4 space-y-3 animate-fade-in">
            {/* Описание */}
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Описание</span>
                {isAdmin && !editingDesc && (
                  <button onClick={() => setEditingDesc(true)} className="text-xs text-violet-400 font-medium">
                    {info.description ? "Изменить" : "Добавить"}
                  </button>
                )}
              </div>
              {editingDesc ? (
                <>
                  <textarea
                    autoFocus
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    placeholder="Расскажите о группе..."
                    rows={4}
                    className="w-full glass rounded-xl px-3 py-2 text-sm outline-none resize-none mb-2"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveDesc} className="flex-1 grad-primary rounded-xl py-2 text-white text-xs font-bold">Сохранить</button>
                    <button onClick={() => { setEditDesc(info.description || ""); setEditingDesc(false); }} className="flex-1 glass rounded-xl py-2 text-xs">Отмена</button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                  {info.description || <span className="text-muted-foreground italic">Описания пока нет</span>}
                </p>
              )}
            </div>

            {/* Invite link */}
            {isAdmin && (
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Ссылка-приглашение</span>
                  <Icon name="Link" size={14} className="text-violet-400" />
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Поделись ссылкой, чтобы кто угодно мог присоединиться к {info.is_channel ? "каналу" : "группе"}.
                </p>
                <div className="flex items-center gap-2 glass rounded-xl px-3 py-2 mb-2">
                  <Icon name="Globe" size={14} className="text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-xs truncate font-mono">{fullInviteUrl || "—"}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyInvite}
                    disabled={!fullInviteUrl}
                    className="flex-1 grad-primary text-white rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {copyState === "ok"
                      ? <><Icon name="Check" size={12} /> Скопировано</>
                      : <><Icon name="Copy" size={12} /> Копировать</>}
                  </button>
                  <button
                    onClick={regenerateInvite}
                    disabled={regenBusy}
                    className="flex-1 glass rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    {regenBusy
                      ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Icon name="RefreshCw" size={12} /> Обновить</>}
                  </button>
                </div>
              </div>
            )}

            {/* Только админы могут писать (для каналов и групп) */}
            {isOwner && (
              <div className="glass rounded-2xl p-4 flex items-center gap-3">
                <Icon name="ShieldCheck" size={20} className="text-violet-400" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">Писать могут только админы</div>
                  <p className="text-[11px] text-muted-foreground">
                    {info.is_channel ? "Стандартное поведение каналов" : "Превратит группу в анонс-канал"}
                  </p>
                </div>
                <button
                  onClick={toggleOnlyAdmins}
                  className={`w-11 h-6 rounded-full transition ${onlyAdmins ? "bg-violet-500" : "bg-white/10"}`}
                >
                  <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${onlyAdmins ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            )}

            {/* Уведомления (mute) */}
            <div className="glass rounded-2xl overflow-hidden relative">
              <button
                onClick={() => (muted ? applyMute(false) : setMuteMenuOpen(v => !v))}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left"
              >
                <Icon
                  name={muted ? "BellOff" : "Bell"}
                  size={18}
                  className={muted ? "text-amber-400" : "text-violet-400"}
                />
                <div className="flex-1">
                  <div className="font-semibold text-sm">
                    {muted ? "Уведомления отключены" : "Уведомления"}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{muteLabel}</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition ${muted ? "bg-amber-500/70" : "bg-white/10"}`}>
                  <span
                    className={`block w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${
                      muted ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </button>
              {muteMenuOpen && !muted && (
                <div className="border-t border-white/10 divide-y divide-white/5">
                  {[
                    { h: 1, label: "На 1 час" },
                    { h: 8, label: "На 8 часов" },
                    { h: 24 * 7, label: "На неделю" },
                    { h: 0, label: "Навсегда" },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => applyMute(true, opt.h || undefined)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Дата создания */}
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <Icon name="Calendar" size={16} className="text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Создано</div>
                  <div className="text-sm font-medium">{fmtDate(info.created_at as number) || "—"}</div>
                </div>
              </div>
            </div>

            {/* Действия */}
            <div className="glass rounded-2xl overflow-hidden">
              {!isOwner && (
                <button
                  onClick={() => setConfirmLeave(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition text-left"
                >
                  <Icon name="LogOut" size={18} className="text-red-400" />
                  <span className="text-sm font-medium text-red-400">
                    Покинуть {info.is_channel ? "канал" : "группу"}
                  </span>
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition text-left"
                >
                  <Icon name="Trash2" size={18} className="text-red-400" />
                  <span className="text-sm font-medium text-red-400">
                    Удалить {info.is_channel ? "канал" : "группу"}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB: MEMBERS */}
        {tab === "members" && (
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
        )}

        {/* TAB: ADMINS */}
        {tab === "admins" && (
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
    </div>
  );
}

export default GroupProfilePanel;