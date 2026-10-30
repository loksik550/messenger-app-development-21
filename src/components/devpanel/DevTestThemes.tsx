import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";
import { SKINS } from "@/lib/skins";

interface Row { id: number; name: string | null; phone: string | null; created_at: number; admin_name: string | null }
interface FoundUser { id: number; name: string; phone: string }

/** Кому показывать тестовые темы мессенджера: у этих людей в профиле появится пункт «Тестовые темы». */
export default function DevTestThemes({ can }: { can: (p: string) => boolean }) {
  const editable = can("settings");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<FoundUser[]>([]);
  const [busy, setBusy] = useState(0);

  const load = async () => {
    try { const r = await devApi<{ users: Row[] }>("test_themes_list"); setRows(r.users || []); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(async () => {
      try { const r = await devApi<{ users: FoundUser[] }>("users", { query: q.trim(), limit: 6 }); setFound(r.users || []); }
      catch { setFound([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const grant = async (u: FoundUser) => {
    setBusy(u.id);
    try { await devApi("test_themes_grant", { user_id: u.id }); setQ(""); setFound([]); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : "Ошибка"); }
    setBusy(0);
  };
  const revoke = async (id: number) => {
    setBusy(id);
    try { await devApi("test_themes_revoke", { user_id: id }); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : "Ошибка"); }
    setBusy(0);
  };

  if (error) return <ErrorBox text={error} />;
  if (!rows) return <Loading />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold">Тестовые темы</h2>
        <p className="text-sm text-slate-500">Новые оформления мессенджера. Видят только люди из списка — у них в профиле появится пункт «Тестовые темы».</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {SKINS.map((s) => (
          <div key={s.id} className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
            <img src={s.preview} alt="" className="w-full aspect-[9/12] object-cover" />
            <div className="p-2.5"><div className="text-sm font-semibold">{s.name}</div><div className="text-[11px] text-slate-500">{s.desc}</div></div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
        <h3 className="font-bold mb-3">Кому показывать</h3>
        {editable ? (
          <div className="relative max-w-md mb-4">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Добавить: имя, телефон или ID"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50" />
            {found.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-xl bg-[#14121f] border border-white/10 overflow-hidden">
                {found.map((u) => (
                  <button key={u.id} onClick={() => grant(u)} disabled={busy === u.id} className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm">
                    {u.name} <span className="text-slate-500">· ID {u.id} · {u.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : <p className="text-xs text-amber-300 mb-3">Менять список может администратор с правом на настройки</p>}

        {rows.length === 0 ? <p className="text-sm text-slate-500">Пока никому не открыто — добавьте себя, чтобы посмотреть темы на телефоне</p> : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2.5">
                <Icon name="Smartphone" size={16} className="text-violet-300" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{r.name || "—"} <span className="text-slate-500 font-normal text-xs">ID {r.id}</span></div>
                  <div className="text-[11px] text-slate-500">{r.phone} · открыл {r.admin_name || "—"} · {new Date(r.created_at * 1000).toLocaleDateString("ru")}</div>
                </div>
                {editable && (
                  <button onClick={() => revoke(r.id)} disabled={busy === r.id} className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 text-xs font-semibold disabled:opacity-50">Убрать</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
