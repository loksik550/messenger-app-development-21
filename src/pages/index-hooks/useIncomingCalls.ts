import { useEffect, type Dispatch, type SetStateAction } from "react";
import { api, type User } from "@/lib/api";
import { native } from "@/lib/native";
import { toast } from "@/hooks/use-toast";

export type ActiveCall = { userId: number; name: string; callId: string; incoming: boolean; autoAccept?: boolean };

/** Входящие звонки: поллинг, открытие по пушу (?call_id=) и сообщения от Service Worker. */
export function useIncomingCalls({
  currentUser,
  activeCall,
  setActiveCall,
  pendingCallId,
  setPendingCallId,
}: {
  currentUser: User | null;
  activeCall: ActiveCall | null;
  setActiveCall: Dispatch<SetStateAction<ActiveCall | null>>;
  pendingCallId: string | null;
  setPendingCallId: Dispatch<SetStateAction<string | null>>;
}) {
  // Polling входящих звонков. Работает и в фоне — если вкладка не активна,
  // показываем локальное уведомление о звонке (резерв к Web Push).
  useEffect(() => {
    if (!currentUser) return;
    const since = { val: Math.floor(Date.now() / 1000) - 5 };
    const interval = setInterval(async () => {
      if (activeCall) return;
      const data = await api("poll_incoming_call", { since: since.val }, currentUser.id);
      if (data.call) {
        since.val = data.call.created_at;
        if (document.visibilityState === "visible") {
          setActiveCall({ userId: data.call.from_user_id, name: data.call.from_name, callId: data.call.call_id, incoming: true });
        } else {
          // Приложение свёрнуто — уведомляем звонком-уведомлением
          // (на Android с Firebase звонок уже показан полноэкранно/уведомлением)
          if (!(native.isNative && native.push.enabled)) {
            native.localNotify.show(`📞 ${data.call.from_name}`, "Входящий звонок");
          }
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentUser, activeCall]);

  // Приложение открыто по пушу звонка (?call_id=...) — открываем экран вызова.
  useEffect(() => {
    if (!currentUser || !pendingCallId || activeCall) return;
    let alive = true;
    api("poll_incoming_call", { since: Math.floor(Date.now() / 1000) - 90 }, currentUser.id)
      .then((data) => {
        if (!alive) return;
        if (data.call && data.call.call_id === pendingCallId) {
          setActiveCall({ userId: data.call.from_user_id, name: data.call.from_name, callId: data.call.call_id, incoming: true });
        }
        setPendingCallId(null);
      })
      .catch(() => { if (alive) setPendingCallId(null); });
    return () => { alive = false; };
  }, [currentUser, pendingCallId, activeCall]);

  // Сообщения от Service Worker: клик по пушу звонка (с заблокированного экрана)
  // сразу открывает экран входящего вызова, не дожидаясь поллинга.
  useEffect(() => {
    if (!currentUser) return;
    if (!("serviceWorker" in navigator)) return;
    const onSwMessage = (e: MessageEvent) => {
      const d = e.data || {};
      if (d.type === "incoming_call" && d.call_id) {
        if (activeCall) return;
        // Подтягиваем данные звонка с бэкенда и открываем экран вызова
        api("poll_incoming_call", { since: Math.floor(Date.now() / 1000) - 60 }, currentUser.id)
          .then((data) => {
            if (data.call && data.call.call_id === d.call_id) {
              setActiveCall({ userId: data.call.from_user_id, name: data.call.from_name, callId: data.call.call_id, incoming: true });
            }
          })
          .catch(() => { /* ignore */ });
      }
      // Входящее сообщение/рассылка пока приложение открыто — показываем тост
      if (d.type === "in_app_message" && d.body) {
        toast({ title: d.title || "Nova", description: d.body, duration: 6000 });
      }
    };
    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onSwMessage);
  }, [currentUser, activeCall]);
}
