import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs, timeAgo } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface Member {
  id: number;
  email: string;
  name: string;
  role: string;
  title: string;
  role_label: string;
  created_at: number;
  last_login: number | null;
  disabled: boolean;
}

interface Role {
  key: string;
  label: string;
}

const ROLE_COLOR: Record<string, string> = {
  owner: "bg-amber-500/20 text-amber-400 border-amber-500/25",
  admin: "bg-violet-500/20 text-violet-400 border-violet-500/25",
  moderator: "bg-cyan-500/20 text-cyan-400 border-cyan-500/25",
  analyst: "bg-emerald-500/20 text-emerald-400 border-emerald-500/25",
  developer: "bg-slate-500/20 text-slate-300 border-slate-500/25",
};

export default function DevTeam({ myId, can }: { myId: number; can: (p: string) => boolean }) {
  const [team, setTeam] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Member | null>(null);
  const [role, setRole] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await devApi<{ team: Member[]; roles: Role[] }>("team");
      setTeam(res.team);
      setRoles(res.roles);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (m: Member) => {
    setEdit(m);
    setRole(m.role);
    setTitle(m.title || "");
  };

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await devApi("team_update", {
        admin_id: edit.id,
        role: edit.id === myId ? "" : role,
        title,
      });
      setEdit(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const disable = async (m: Member) => {
    if (!confirm(`Отключить доступ для ${m.email}?`)) return;
    setBusy(true);
    try {
      await devApi("team_remove", { admin_id: m.id });
      setEdit(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl divide-y divide-white/5">
        {team.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-sm font-bold shrink-0">
              {(m.name || m.email).slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{m.name || "Без имени"}</span>
                {m.title && <span className="text-xs text-slate-500">· {m.title}</span>}
                {m.disabled && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
                    отключён
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 truncate">{m.email}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">
                Вход: {m.last_login ? timeAgo(m.last_login) : "не входил"} · с {formatTs(m.created_at)}
              </div>
            </div>
            <span
              className={`text-[10px] px-2 py-1 rounded-full border shrink-0 ${
                ROLE_COLOR[m.role] || ROLE_COLOR.developer
              }`}
            >
              {m.role_label}
            </span>
            {can("team") && (
              <button
                onClick={() => openEdit(m)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition shrink-0"
              >
                Изменить
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
        <h3 className="font-semibold mb-3 text-sm">Что могут роли</h3>
        <div className="space-y-2 text-xs text-slate-400">
          <RoleRow role="owner" label="Основатель" text="Полный доступ, включая удаление и настройки панели" />
          <RoleRow role="admin" label="Администратор" text="Всё, кроме смены владельца: пользователи, кошелёк, каналы, команда" />
          <RoleRow role="moderator" label="Модератор" text="Пользователи, переписка, файлы, жалобы, поддержка, каналы" />
          <RoleRow role="analyst" label="Аналитик" text="Только просмотр: дашборд, список пользователей, логи, каналы" />
          <RoleRow role="developer" label="Разработчик" text="Дашборд, логи, состояние серверов и доступы" />
        </div>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-[#12131f] border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold truncate">{edit.name || edit.email}</h3>
              <button onClick={() => setEdit(null)} className="text-slate-500 hover:text-slate-300">
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Приписка после имени</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Основатель"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50 placeholder-slate-600"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Роль</label>
                {edit.id === myId ? (
                  <p className="text-xs text-slate-600 bg-white/[0.03] rounded-xl px-3 py-2.5">
                    Собственную роль изменить нельзя
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {roles.map((r) => (
                      <button
                        key={r.key}
                        onClick={() => setRole(r.key)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition ${
                          role === r.key
                            ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                            : "bg-white/[0.03] border-white/8 text-slate-400 hover:bg-white/[0.06]"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50"
              >
                Сохранить
              </button>
              {edit.id !== myId && !edit.disabled && (
                <button
                  onClick={() => disable(edit)}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm hover:bg-red-500/25 disabled:opacity-50"
                >
                  Отключить
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleRow({ role, label, text }: { role: string; label: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${ROLE_COLOR[role]}`}>{label}</span>
      <span className="flex-1">{text}</span>
    </div>
  );
}
