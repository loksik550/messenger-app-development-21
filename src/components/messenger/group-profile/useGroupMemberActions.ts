import { useEffect, useState } from "react";
import { api, type User, type Group, type GroupMember, type Contact } from "@/lib/api";

interface Params {
  group: Group;
  members: GroupMember[];
  currentUser: User;
  onClose: () => void;
  onMembersChanged: () => void;
  onGroupDeleted?: () => void;
  onHistoryCleared?: () => void;
}

/**
 * Управление участниками и опасные действия (исключить, выйти, удалить, очистить),
 * а также добавление участников из контактов.
 */
export function useGroupMemberActions({
  group, members, currentUser,
  onClose, onMembersChanged, onGroupDeleted, onHistoryCleared,
}: Params) {
  const [memberSearch, setMemberSearch] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [addingId, setAddingId] = useState<number | null>(null);

  const [confirmKick, setConfirmKick] = useState<{ id: number; name: string } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const clearHistory = async () => {
    setBusy(true);
    const r = await api("clear_group_history", { group_id: group.id }, currentUser.id);
    setBusy(false);
    setConfirmClear(false);
    if (r?.error) { alert(r.error); return; }
    onHistoryCleared?.();
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

  return {
    memberSearch, setMemberSearch, visibleMembers, adminsList,
    showAddMember, setShowAddMember, contacts, filteredContacts, contactSearch, setContactSearch, addingId, addMember,
    confirmKick, setConfirmKick, confirmLeave, setConfirmLeave,
    confirmDelete, setConfirmDelete, confirmClear, setConfirmClear,
    busy, setRole, kick, leave, deleteGroup, clearHistory,
  };
}
