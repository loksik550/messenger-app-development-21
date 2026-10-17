import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi } from "@/lib/devApi";

const ROLE_HINT: Record<string, string> = {
  admin: "Почти всё: пользователи, деньги, команда",
  moderator: "Жалобы, переписка, поддержка, каналы",
  analyst: "Только просмотр статистики",
  developer: "Логи, серверы, публикация",
};

const ROLE_DOT: Record<string, string> = {
  admin: "bg-rose-400",
  moderator: "bg-amber-400",
  analyst: "bg-cyan-400",
  developer: "bg-emerald-400",
};

export default function DevRolePopover({
  userId,
  userName,
  anchor,
  onClose,
  onOpenUser,
}: {
  userId: number;
  userName: string;
  anchor: { x: number; y: number };
  onClose: () => void;
  onOpenUser?: () => void;
}) {
  const [roles, setRoles] = useState<{ key: string; label: string }[]>([]);
  const [current, setCurrent] = useState("");
  const [canGrant, setCanGrant] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    devApi<{ role: string; roles: { key: string; label: string }[]; can_grant: boolean }>("user_panel_role", { user_id: userId })
      .then((r) => { setRoles(r.roles); setCurrent(r.role); setCanGrant(r.can_grant); })
      .catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : "Не удалось загрузить" }));
  }, [userId]);

  useEffect(() => {
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", close);
      document.addEventListener("touchstart", close);
    }, 0);
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const grant = async (role: string) => {
    setBusy(role || "none");
    setMsg(null);
    try {
      const r = await devApi<{ role: string; has_vk?: boolean }>("grant_role", { user_id: userId, role });
      setCurrent(r.role);
      const label = roles.find((x) => x.key === r.role)?.label;
      setMsg({
        ok: true,
        text: r.role
          ? `Выдана роль «${label}».${r.has_vk ? " Войти в панель можно через ВКонтакте." : " Чтобы войти в панель, человеку нужно привязать ВК в приложении."}`
          : "Роль снята, доступ в панель закрыт",
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Не удалось" });
    } finally {
      setBusy("");
    }
  };

  const W = 288;
  const left = Math.max(8, Math.min(anchor.x - W / 2, window.innerWidth - W - 8));
  const below = anchor.y + 340 < window.innerHeight;
  const top = below ? anchor.y + 8 : Math.max(8, anchor.y - 348);

  return (
    <div
      ref={ref}
      className="fixed z-[80] rounded-2xl bg-[#15151f] border border-white/12 shadow-2xl shadow-black/60 p-3 animate-in fade-in zoom-in-95"
      style={{ left, top, width: W }}
    >
      <div className="flex items-center gap-2 px-1 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-slate-500">Роль в панели</div>
          <div className="text-sm font-semibold truncate">{userName}</div>
        </div>
        <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300">
          <Icon name="X" size={15} />
        </button>
      </div>

      {!canGrant && roles.length > 0 ? (
        <div className="text-xs text-slate-400 px-1 py-2">Выдавать роли может только основатель или администратор.</div>
      ) : (
        <div className="space-y-1">
          {roles.map((r) => (
            <button
              key={r.key}
              disabled={!!busy}
              onClick={() => grant(r.key)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition ${
                current === r.key ? "bg-violet-500/15 border border-violet-500/40" : "hover:bg-white/5 border border-transparent"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${ROLE_DOT[r.key] || "bg-slate-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-[11px] text-slate-500 truncate">{ROLE_HINT[r.key] || ""}</div>
              </div>
              {busy === r.key ? (
                <Icon name="Loader2" size={14} className="animate-spin text-slate-400" />
              ) : current === r.key ? (
                <Icon name="Check" size={15} className="text-violet-400" />
              ) : null}
            </button>
          ))}
          {current && (
            <button
              disabled={!!busy}
              onClick={() => grant("")}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-red-500/10 text-red-300 text-sm"
            >
              <Icon name={busy === "none" ? "Loader2" : "UserX"} size={14} className={busy === "none" ? "animate-spin" : ""} />
              Снять роль
            </button>
          )}
        </div>
      )}

      {msg && (
        <div className={`mt-2 text-[11px] px-2 py-1.5 rounded-lg ${msg.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
          {msg.text}
        </div>
      )}

      {onOpenUser && (
        <button onClick={onOpenUser} className="w-full mt-2 pt-2 border-t border-white/8 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5">
          <Icon name="UserRound" size={13} /> Открыть карточку пользователя
        </button>
      )}
    </div>
  );
}
