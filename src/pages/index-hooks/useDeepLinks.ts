import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { api, type Chat, type User, type Group } from "@/lib/api";
import { track } from "@/lib/track";
import { native } from "@/lib/native";
import type { useOverlays } from "@/hooks/useOverlays";

/** Обработка входных ссылок (?fund=, ?join=, ?ref=, ?call_id=) и открытия приложения по ссылке. */
export function useDeepLinks({
  currentUser,
  setCurrentUser,
  setFundraiserView,
}: {
  currentUser: User | null;
  setCurrentUser: Dispatch<SetStateAction<User | null>>;
  setFundraiserView: ReturnType<typeof useOverlays>["setFundraiserView"];
}) {
  // Открытие сбора по ссылке ?fund=ID
  useEffect(() => {
    const url = new URL(window.location.href);
    const fid = url.searchParams.get("fund");
    if (fid) {
      const id = parseInt(fid, 10);
      if (!isNaN(id) && id > 0) {
        setFundraiserView({ mode: "view", id });
        url.searchParams.delete("fund");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, []);

  // Автоматический вход в группу/канал по ссылке ?join=CODE
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("join");
    if (code) {
      setPendingJoin(code);
      url.searchParams.delete("join");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Ссылка-приглашение ?ref=CODE — запоминаем до входа
  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = (url.searchParams.get("ref") || "").trim();
    if (ref && /^[A-Za-z0-9_-]{3,32}$/.test(ref)) {
      try { localStorage.setItem("nova_ref", ref.toUpperCase()); } catch { /* ignore */ }
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);
  const [refToast, setRefToast] = useState("");
  const [deepLinkTick, setDeepLinkTick] = useState(0);
  useEffect(() => native.app.onUrlOpen((raw) => {
    try {
      const u = new URL(raw);
      const ref = (u.searchParams.get("ref") || "").trim();
      if (ref && /^[A-Za-z0-9_-]{3,32}$/.test(ref)) {
        localStorage.setItem("nova_ref", ref.toUpperCase());
        setDeepLinkTick(t => t + 1);
      }
      const join = u.searchParams.get("join");
      if (join) setPendingJoin(join);
    } catch { /* ignore */ }
  }), []);
  useEffect(() => {
    if (!currentUser) return;
    let code = "";
    try { code = localStorage.getItem("nova_ref") || ""; } catch { /* ignore */ }
    if (!code) return;
    try { localStorage.removeItem("nova_ref"); } catch { /* ignore */ }
    api("referral_apply", { code, auto: true }, currentUser.id)
      .then(r => {
        if (r?.success) {
          track("invite_applied");
          setRefToast(`Подарок от друга: Premium на ${r.granted_days} дн.`);
          setTimeout(() => setRefToast(""), 5000);
          api("refresh_me", {}, currentUser.id).then(me => {
            if (me?.user) setCurrentUser(prev => prev ? { ...prev, ...me.user } : prev);
          }).catch(() => null);
        }
      })
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, deepLinkTick]);

  // Открытие по пушу звонка с заблокированного экрана: ?call_id=...
  const [pendingCallId, setPendingCallId] = useState<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const cid = url.searchParams.get("call_id");
    if (cid) {
      setPendingCallId(cid);
      url.searchParams.delete("call_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  return { pendingJoin, setPendingJoin, refToast, pendingCallId, setPendingCallId };
}

/** Вход в группу/канал по отложенному коду ?join= после авторизации. */
export function useJoinByInvite({
  currentUser,
  pendingJoin,
  setPendingJoin,
  setGroups,
  setSelectedGroup,
  setSelectedChat,
  setShowSidebar,
}: {
  currentUser: User | null;
  pendingJoin: string | null;
  setPendingJoin: Dispatch<SetStateAction<string | null>>;
  setGroups: Dispatch<SetStateAction<Group[]>>;
  setSelectedGroup: Dispatch<SetStateAction<Group | null>>;
  setSelectedChat: Dispatch<SetStateAction<Chat | null>>;
  setShowSidebar: Dispatch<SetStateAction<boolean>>;
}) {
  // Обработка ?join=CODE после авторизации
  useEffect(() => {
    if (!currentUser || !pendingJoin) return;
    const code = pendingJoin;
    setPendingJoin(null);
    api("join_by_invite", { invite_link: code }, currentUser.id).then(r => {
      if (r?.error) { alert("Не удалось войти: " + r.error); return; }
      if (r?.group_id) {
        const g: Group = { id: r.group_id, name: r.name || "Группа", owner_id: 0, is_channel: !!r.is_channel };
        setGroups(prev => prev.some(x => x.id === g.id) ? prev : [g, ...prev]);
        setSelectedGroup(g);
        setSelectedChat(null);
        setShowSidebar(false);
        // Подгрузим актуальный список
        api("get_groups", {}, currentUser.id).then(d => { if (d.groups) setGroups(d.groups); });
      }
    });
  }, [currentUser, pendingJoin]);
}
