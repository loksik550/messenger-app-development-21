import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";

export interface ResetTicket { request_id: number; poll_key: string; route: "device" | "admin" }

const STORE = "nova_reset_ticket";

export function saveResetTicket(t: ResetTicket | null) {
  try {
    if (t) localStorage.setItem(STORE, JSON.stringify(t));
    else localStorage.removeItem(STORE);
  } catch { /* ignore */ }
}

export function loadResetTicket(): ResetTicket | null {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as ResetTicket) : null;
  } catch {
    return null;
  }
}

export default function ResetWaiting({
  ticket, onDone, onCancel,
}: {
  ticket: ResetTicket;
  onDone: (user: User, token?: string) => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<string>("pending");
  const doneRef = useRef(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (doneRef.current) return;
      try {
        const r = await api("reset_status", { request_id: ticket.request_id, poll_key: ticket.poll_key });
        if (!alive) return;
        if (r?.user) {
          doneRef.current = true;
          saveResetTicket(null);
          onDone(r.user, r.token);
          return;
        }
        if (r?.status) setStatus(r.status);
        if (r?.status && r.status !== "pending") saveResetTicket(null);
      } catch { /* сеть */ }
    };
    check();
    const t = setInterval(check, ticket.route === "device" ? 4000 : 15000);
    return () => { alive = false; clearInterval(t); };
  }, [ticket, onDone]);

  const byDevice = ticket.route === "device";
  const finished = status === "rejected" || status === "expired" || status === "replaced";

  return (
    <div className="animate-fade-in space-y-4 text-center">
      <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center ${finished ? "bg-red-500/15 text-red-400" : "bg-violet-500/15 text-violet-300"}`}>
        <Icon name={finished ? "ShieldX" : byDevice ? "Smartphone" : "UserCheck"} size={30} />
      </div>
      {!finished ? (
        <>
          <h2 className="text-xl font-bold">{byDevice ? "Подтвердите на другом устройстве" : "Заявка отправлена"}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {byDevice
              ? "Откройте Nova на телефоне или компьютере, где вы уже вошли, и подтвердите смену пароля в Настройках → Безопасность. Запрос действует 15 минут."
              : "Устройств, где вы вошли, не найдено. Администратор проверит заявку — обычно в течение дня. Этот экран можно закрыть: при следующем открытии вход выполнится сам."}
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            Ждём подтверждения…
          </div>
        </>
      ) : (
        <>
          <h2 className="text-xl font-bold">
            {status === "rejected" ? "Запрос отклонён" : "Запрос больше не действует"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {status === "rejected"
              ? "Смену пароля отклонили. Если это были вы — попробуйте ещё раз или напишите в поддержку."
              : "Время ожидания вышло. Отправьте запрос заново."}
          </p>
        </>
      )}
      <button
        onClick={() => { saveResetTicket(null); onCancel(); }}
        className="w-full py-3 glass rounded-2xl text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        {finished ? "Назад" : "Отменить"}
      </button>
    </div>
  );
}
