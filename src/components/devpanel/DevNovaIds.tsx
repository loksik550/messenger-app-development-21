import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";
import DevToggle from "./DevToggle";

interface Item {
  id: number; user_id: number; user_name: string | null; phone: string | null;
  nova_id: string; old_nova_id: string | null; method: "lightning" | "rub" | "admin";
  price_lightning: number; price_rub: number; note: string | null; created_at: number;
  admin_name: string | null; still_owned: boolean;
}
interface Price { lightning: number; rub: number }
interface Settings { enabled: boolean; prices: Record<string, Price>; beauty_mult: number; reserved: string }
interface ListRes { items: Item[]; totals: { count: number; lightning: number; rub: number; granted: number }; settings: Settings }
interface FoundUser { id: number; name: string; phone: string; nova_id: string | null }

const METHOD: Record<Item["method"], { label: string; cls: string }> = {
  lightning: { label: "Молнии", cls: "bg-amber-500/15 text-amber-300" },
  rub: { label: "Рубли", cls: "bg-emerald-500/15 text-emerald-300" },
  admin: { label: "Выдан", cls: "bg-violet-500/15 text-violet-300" },
};

const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleString("ru", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function DevNovaIds({ can }: { can: (p: string) => boolean }) {
  const editable = can("settings");
  const [data, setData] = useState<ListRes | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingSet, setSavingSet] = useState(false);
  const [setMsg, setSetMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const [userQ, setUserQ] = useState("");
  const [found, setFound] = useState<FoundUser[]>([]);
  const [target, setTarget] = useState<FoundUser | null>(null);
  const [grantId, setGrantId] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [grantCheck, setGrantCheck] = useState<{ available: boolean; reason?: string } | null>(null);
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = async (query = q) => {
    try {
      const r = await devApi<ListRes>("nova_ids_list", { q: query });
      setData(r);
      setSettings((s) => s || r.settings);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  };

  useEffect(() => { load(""); }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (userQ.trim().length < 2) { setFound([]); return; }
      try {
        const r = await devApi<{ users: FoundUser[] }>("users", { query: userQ.trim(), limit: 6 });
        setFound(r.users);
      } catch { setFound([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [userQ]);

  useEffect(() => {
    setGrantCheck(null);
    const v = grantId.replace(/\D/g, "");
    if (v.length < 3) return;
    const t = setTimeout(async () => {
      try {
        const r = await devApi<{ available: boolean; reason?: string }>("nova_id_check_admin", { nova_id: v });
        setGrantCheck(r);
      } catch { /* ignore */ }
    }, 350);
    return () => clearTimeout(t);
  }, [grantId]);

  const grant = async () => {
    if (!target) return;
    setGranting(true);
    setGrantMsg(null);
    try {
      const r = await devApi<{ nova_id: string }>("nova_id_grant", { user_id: target.id, nova_id: grantId, note: grantNote });
      setGrantMsg({ ok: true, t: `ID ${r.nova_id} выдан пользователю ${target.name}` });
      setGrantId(""); setGrantNote(""); setTarget(null); setUserQ("");
      load();
    } catch (e) {
      setGrantMsg({ ok: false, t: e instanceof Error ? e.message : "Не удалось выдать" });
    } finally {
      setGranting(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSet(true);
    setSetMsg(null);
    try {
      await devApi("nova_ids_settings_save", { ...settings });
      setSetMsg({ ok: true, t: "Сохранено — цены уже действуют в приложении" });
      load();
    } catch (e) {
      setSetMsg({ ok: false, t: e instanceof Error ? e.message : "Не удалось сохранить" });
    } finally {
      setSavingSet(false);
    }
  };

  if (error && !data) return <ErrorBox text={error} onRetry={() => load()} />;
  if (!data || !settings) return <Loading />;

  const inp = "w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 placeholder-slate-600 disabled:opacity-60";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {[
          { v: formatNum(data.totals.count), l: "всего ID продано и выдано" },
          { v: `⚡ ${formatNum(data.totals.lightning)}`, l: "получено Молний" },
          { v: `${formatNum(data.totals.rub)} ₽`, l: "получено рублями" },
          { v: formatNum(data.totals.granted), l: "выдано вручную" },
        ].map((c) => (
          <div key={c.l} className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3">
            <div className="text-xl font-bold">{c.v}</div>
            <div className="text-xs text-slate-500">{c.l}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {editable && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
            <h3 className="font-bold flex items-center gap-2"><Icon name="Gift" size={16} className="text-violet-400" />Выдать ID пользователю</h3>
            {target ? (
              <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{target.name} <span className="text-slate-500">#{target.id}</span></div>
                  <div className="text-xs text-slate-500">Сейчас ID {target.nova_id || "—"} · {target.phone}</div>
                </div>
                <button onClick={() => setTarget(null)} className="p-1.5 rounded-lg hover:bg-white/10"><Icon name="X" size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <input value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="Найти: имя, телефон или текущий ID" className={inp} />
                {found.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[#14131c] overflow-hidden">
                    {found.map((u) => (
                      <button key={u.id} onClick={() => { setTarget(u); setFound([]); }} className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm">
                        {u.name} <span className="text-slate-500">· ID {u.nova_id || "—"} · {u.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input value={grantId} onChange={(e) => setGrantId(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Новый ID, напр. 666" inputMode="numeric" className={`${inp} font-mono`} />
              <input value={grantNote} onChange={(e) => setGrantNote(e.target.value)} placeholder="Причина (необязательно)" className={inp} />
            </div>
            {grantCheck && (
              <div className={`text-xs ${grantCheck.available ? "text-emerald-400" : "text-red-400"}`}>
                {grantCheck.available ? "Свободен — можно выдать" : grantCheck.reason}
              </div>
            )}
            <button
              onClick={grant}
              disabled={!target || !grantCheck?.available || granting}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-40"
            >
              {granting ? "Выдаём..." : "Выдать бесплатно"}
            </button>
            {grantMsg && <p className={`text-xs ${grantMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{grantMsg.t}</p>}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold flex items-center gap-2 flex-1"><Icon name="Tags" size={16} className="text-amber-400" />Цены красивых ID</h3>
            <button onClick={() => editable && setSettings({ ...settings, enabled: !settings.enabled })} className="flex items-center gap-2 text-xs" disabled={!editable}>
              <DevToggle on={settings.enabled} size="sm" />
              <span className="text-slate-400">{settings.enabled ? "Продажа включена" : "Продажа выключена"}</span>
            </button>
          </div>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center text-sm">
            <span className="text-xs text-slate-500">Длина</span>
            <span className="text-xs text-slate-500">Молнии ⚡</span>
            <span className="text-xs text-slate-500">Рубли ₽</span>
            {Object.entries(settings.prices).map(([len, p]) => (
              <div key={len} className="contents">
                <span className="font-mono text-slate-300 pr-2">{len} цифр{Number(len) < 5 ? "ы" : ""}</span>
                <input disabled={!editable} value={String(p.lightning)} inputMode="numeric"
                  onChange={(e) => setSettings({ ...settings, prices: { ...settings.prices, [len]: { ...p, lightning: Number(e.target.value.replace(/\D/g, "")) || 0 } } })}
                  className={inp} />
                <input disabled={!editable} value={String(p.rub)} inputMode="decimal"
                  onChange={(e) => setSettings({ ...settings, prices: { ...settings.prices, [len]: { ...p, rub: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } } })}
                  className={inp} />
              </div>
            ))}
          </div>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">Наценка на красивые (666, 1234, 7777, 1000, зеркальные) — во сколько раз дороже</span>
            <input disabled={!editable} value={String(settings.beauty_mult)} inputMode="decimal"
              onChange={(e) => setSettings({ ...settings, beauty_mult: Number(e.target.value.replace(/[^\d.]/g, "")) || 1 })}
              className={`${inp} max-w-[120px]`} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">Не продавать (через запятую) — их можно только выдать вручную</span>
            <textarea disabled={!editable} value={settings.reserved} rows={2}
              onChange={(e) => setSettings({ ...settings, reserved: e.target.value })}
              placeholder="100, 777, 1000" className={`${inp} resize-none font-mono`} />
          </label>
          {editable && (
            <button onClick={saveSettings} disabled={savingSet} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-40">
              {savingSet ? "Сохраняем..." : "Сохранить цены"}
            </button>
          )}
          {setMsg && <p className={`text-xs ${setMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{setMsg.t}</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-white/10">
          <h3 className="font-bold flex-1">Кто купил и кому выдан</h3>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="ID, имя или телефон" className={`${inp} max-w-[240px]`} />
          <button onClick={() => load()} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10"><Icon name="Search" size={16} className="text-slate-400" /></button>
        </div>
        {data.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Пока никто не покупал красивый ID</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium">ID</th>
                  <th className="px-4 py-2 font-medium">Пользователь</th>
                  <th className="px-4 py-2 font-medium">Как</th>
                  <th className="px-4 py-2 font-medium">Цена</th>
                  <th className="px-4 py-2 font-medium">Был ID</th>
                  <th className="px-4 py-2 font-medium">Когда</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-t border-white/5">
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-bold">{it.nova_id}</span>
                      {!it.still_owned && <span className="ml-1.5 text-[10px] text-slate-500">(сменён)</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div>{it.user_name || "—"} <span className="text-slate-500">#{it.user_id}</span></div>
                      <div className="text-xs text-slate-500">{it.phone}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${METHOD[it.method]?.cls || ""}`}>{METHOD[it.method]?.label || it.method}</span>
                      {it.admin_name && <div className="text-[11px] text-slate-500 mt-0.5">{it.admin_name}</div>}
                      {it.note && <div className="text-[11px] text-slate-500 mt-0.5 max-w-[200px] truncate" title={it.note}>{it.note}</div>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {it.method === "lightning" ? `⚡ ${formatNum(it.price_lightning)}` : it.method === "rub" ? `${formatNum(it.price_rub)} ₽` : "бесплатно"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{it.old_nova_id || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(it.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
