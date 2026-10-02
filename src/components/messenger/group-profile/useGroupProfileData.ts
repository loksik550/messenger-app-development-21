import { useEffect, useState } from "react";
import { api, type User, type Group } from "@/lib/api";
import { groupMuteLabel } from "@/components/messenger/groupProfileUtils";

export interface VerifState {
  verified: boolean;
  request: { status: string; note: string } | null;
}

/**
 * Данные профиля группы/канала: актуальная инфа, верификация, ссылка-приглашение,
 * режим «только админы», настройки уведомлений (mute).
 */
export function useGroupProfileData(group: Group, currentUser: User) {
  const [verifState, setVerifState] = useState<VerifState>({ verified: false, request: null });
  const [verifBusy, setVerifBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api("channel_verification_status", { group_id: group.id }, currentUser.id).then(r => {
      if (!alive || !r || r.error) return;
      setVerifState({ verified: !!r.verified, request: r.request || null });
    });
    return () => { alive = false; };
  }, [group.id, currentUser.id]);

  const applyVerification = async () => {
    setVerifBusy(true);
    try {
      const r = await api("channel_verification_apply", { group_id: group.id }, currentUser.id);
      if (r?.error) {
        alert(r.error);
        return;
      }
      setVerifState(prev => ({ ...prev, request: { status: "pending", note: "" } }));
    } finally {
      setVerifBusy(false);
    }
  };

  const [info, setInfo] = useState<Group>(group);
  const [inviteLink, setInviteLink] = useState<string>(group.invite_link || "");
  const [copyState, setCopyState] = useState<"idle" | "ok">("idle");
  const [regenBusy, setRegenBusy] = useState(false);
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

  return {
    verifState, verifBusy, applyVerification,
    info, setInfo,
    fullInviteUrl, copyState, copyInvite, regenBusy, regenerateInvite,
    onlyAdmins, toggleOnlyAdmins,
    muted, muteLabel, muteMenuOpen, setMuteMenuOpen, applyMute,
  };
}
