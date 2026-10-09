import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs } from "@/lib/devApi";

interface ResetItem {
  id: number; user_id: number; name: string; phone: string; status: string;
  device: string; ip: string; created_at: number; last_login: number | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Ждёт решения", cls: "bg-amber-500/15 text-amber-300" },
  approved: { label: "Одобрено", cls: "bg-emerald-500/15 text-emerald-300" },
  used: { label: "Вошёл", cls: "bg-emerald-500/15 text-emerald-300" },
  rejected: { label: "Отклонено", cls: "bg-red-500/15 text-red-300" },
  expired: { label: "Истекло", cls: "bg-white/5 text-slate-400" },
  replaced: { label: "Заменено новой", cls: "bg-white/5 text-slate-400" },
};

export default function DevPasswordResets() {
  const [items, setItems] = useState<ResetItem[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const load = () => devApi<{ items: ResetItem[] }>("resets_list").then((r) => setItems(r.items)).catch(() => {});
  useEffect(() => { load(); }, []);

  const decide = async (id: number, approve: boolean) => {
    if (!confirm(approve
      ? "Одобрить смену пароля? Убедитесь, что это владелец аккаунта (например, он написал с этого номера в поддержку)."
      : "Отклонить заявку?")) return;
    setBusy(id);
    try {
      await devApi("reset_decide", { id, approve });
      setMsg(approve ? "Пароль изменён — человек войдёт автоматически" : "Заявка отклонена");
      setTimeout(() => setMsg(""), 3000);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  };

  if (!items.length) return null;
  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="KeyRound" size={16} className="text-amber-400" />
        <h3 className="font-semibold text-sm">Восстановление пароля</h3>
        {pending > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">{pending} ждут</span>}
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Заявки от людей, у которых нет другого устройства со входом. Одобряйте, только если уверены, что это владелец.
      </p>
      {msg && <div className="text-xs text-emerald-300 mb-2">{msg}</div>}
      <div className="space-y-2">
        {items.slice(0, 10).map((r) => {
          const st = STATUS[r.status] || STATUS.expired;
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-black/20 border border-white/5 px-3 py-2.5">
              <div className="flex-1 min-w-[180px]">
                <div className="text-sm font-medium">{r.name} <span className="text-slate-500">· ID {r.user_id}</span></div>
                <div className="text-[11px] text-slate-500">
                  {r.phone} · {r.device || "устройство не известно"} · {formatTs(r.created_at)}
                  {r.last_login ? ` · последний вход ${formatTs(r.last_login)}` : ""}
                </div>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
              {r.status === "pending" && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => decide(r.id, false)}
                    disabled={busy === r.id}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-50"
                  >Отклонить</button>
                  <button
                    onClick={() => decide(r.id, true)}
                    disabled={busy === r.id}
                    className="px-3 py-1.5 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                  >Одобрить</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
