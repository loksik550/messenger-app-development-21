import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";
import { RARITY, badgeSrc, type Rarity } from "@/lib/badges";

interface Badge { code: string; title: string; description: string; rarity: Rarity; price: number | null; supply: number | null; issued: number; on_sale: boolean }
interface Item { id: number; user_id: number; user_name: string | null; phone: string | null; code: string; serial: number; method: string; price: number; created_at: number; revoked_at: number | null; admin_name: string | null }
interface EffectRow { code: string; title: string; price: number; duration_days: number | null; on_sale: boolean; buyers: number }
interface Res { badges: Badge[]; items: Item[]; totals: { lightning: number; sold: number }; effects: EffectRow[] }
interface FoundUser { id: number; name: string; phone: string }
interface UserBadge { code: string; serial: number; title: string; rarity: Rarity }

const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function DevBadges({ can }: { can: (p: string) => boolean }) {
  const editable = can("settings");
  const [data, setData] = useState<Res | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const [userQ, setUserQ] = useState("");
  const [found, setFound] = useState<FoundUser[]>([]);
  const [target, setTarget] = useState<FoundUser | null>(null);
  const [targetBadges, setTargetBadges] = useState<UserBadge[]>([]);
  const [busy, setBusy] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [edit, setEdit] = useState<Badge | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editSupply, setEditSupply] = useState("");
  const [editSale, setEditSale] = useState(false);

  const load = async () => {
    try { setData(await devApi<Res>("badges_admin")); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка загрузки"); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (userQ.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await devApi<{ users: FoundUser[] }>("users", { query: userQ.trim(), limit: 6 });
        setFound(r.users || []);
      } catch { setFound([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [userQ]);

  const loadTarget = async (u: FoundUser) => {
    setTarget(u); setFound([]); setUserQ("");
    try {
      const r = await devApi<{ badges: UserBadge[] }>("user_shop_badges", { user_id: u.id });
      setTargetBadges(r.badges || []);
    } catch { setTargetBadges([]); }
  };

  const flash = (ok: boolean, t: string) => { setMsg({ ok, t }); setTimeout(() => setMsg(null), 3500); };

  const grant = async (code: string) => {
    if (!target) return;
    setBusy(code);
    try {
      const r = await devApi<{ serial: number }>("badge_grant", { user_id: target.id, code, note: grantNote.trim() });
      flash(true, `Выдан №${r.serial}`);
      await Promise.all([loadTarget(target), load()]);
    } catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
    setBusy("");
  };

  const revoke = async (code: string) => {
    if (!target) return;
    setBusy(code);
    try {
      await devApi("badge_revoke", { user_id: target.id, code });
      flash(true, "Значок забран");
      await Promise.all([loadTarget(target), load()]);
    } catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
    setBusy("");
  };

  const saveEdit = async () => {
    if (!edit) return;
    setBusy("edit");
    try {
      await devApi("badge_update", { code: edit.code, price: editPrice, supply: editSupply, on_sale: editSale });
      setEdit(null);
      flash(true, "Сохранено");
      load();
    } catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
    setBusy("");
  };

  if (error) return <ErrorBox text={error} />;
  if (!data) return <Loading />;
  const has = new Set(targetBadges.map((b) => b.code));
  const titleOf = (c: string) => data.badges.find((b) => b.code === c)?.title || c;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Значки и эффекты имени</h2>
          <p className="text-sm text-slate-500">Продажи в магазине за Молнии, выдача и отзыв вручную</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2"><div className="text-[11px] text-slate-500">Продано значков</div><div className="font-bold">{formatNum(data.totals.sold)}</div></div>
          <div className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2"><div className="text-[11px] text-slate-500">Получено Молний</div><div className="font-bold text-amber-300">⚡ {formatNum(data.totals.lightning)}</div></div>
        </div>
      </div>

      {msg && <div className={`rounded-xl px-4 py-2.5 text-sm ${msg.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{msg.t}</div>}

      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
        <h3 className="font-bold mb-1">Выдать или забрать значок</h3>
        <p className="text-xs text-slate-500 mb-3">Найдите пользователя по имени, телефону или ID</p>
        {!editable && <p className="text-xs text-amber-300 mb-3">Выдавать значки может только администратор с правом на настройки</p>}
        <div className="relative max-w-md">
          <input
            value={userQ}
            onChange={(e) => setUserQ(e.target.value)}
            placeholder="Имя, телефон или ID"
            disabled={!editable}
            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 disabled:opacity-60"
          />
          {found.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl bg-[#14121f] border border-white/10 overflow-hidden">
              {found.map((u) => (
                <button key={u.id} onClick={() => loadTarget(u)} className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm">
                  {u.name} <span className="text-slate-500">· ID {u.id} · {u.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {target && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-semibold">{target.name}</span>
              <span className="text-xs text-slate-500">ID {target.id}</span>
              <button onClick={() => { setTarget(null); setTargetBadges([]); }} className="ml-auto text-xs text-slate-400 hover:text-white">Сбросить</button>
            </div>
            <input
              value={grantNote}
              onChange={(e) => setGrantNote(e.target.value.slice(0, 120))}
              placeholder="За что выдаём (например: За тестирование) — увидят все при нажатии на значок"
              className="w-full max-w-xl mb-3 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
              {data.badges.map((b) => {
                const own = has.has(b.code);
                const ub = targetBadges.find((x) => x.code === b.code);
                return (
                  <button
                    key={b.code}
                    onClick={() => (own ? revoke(b.code) : grant(b.code))}
                    disabled={!!busy}
                    title={own ? "Нажмите, чтобы забрать" : "Нажмите, чтобы выдать"}
                    className={`relative rounded-xl p-2 text-center border transition disabled:opacity-50 ${own ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}
                  >
                    <img src={badgeSrc(b.code)} alt="" className={`w-10 h-10 mx-auto ${own ? "" : "opacity-60 grayscale-[40%]"}`} />
                    <div className="text-[10px] font-semibold mt-1 truncate">{b.title}</div>
                    <div className={`text-[10px] font-bold ${own ? "text-red-300" : "text-emerald-300"}`}>{busy === b.code ? "..." : own ? `№${ub?.serial} · забрать` : "выдать"}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 p-5">
        <h3 className="font-bold mb-3">Каталог значков</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {data.badges.map((b) => {
            const r = RARITY[b.rarity] || RARITY.common;
            return (
              <div key={b.code} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2.5">
                <img src={badgeSrc(b.code)} alt="" className="w-11 h-11" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{b.title}</div>
                  <div className="text-[11px]" style={{ color: r.color }}>{r.label}</div>
                  <div className="text-[11px] text-slate-500">
                    {b.on_sale && b.price ? <span className="text-amber-300">⚡ {b.price}</span> : <span>не продаётся</span>}
                    {" · "}выдано {b.issued}{b.supply ? ` из ${b.supply}` : ""}
                  </div>
                </div>
                {editable && (
                  <button
                    onClick={() => { setEdit(b); setEditPrice(b.price ? String(b.price) : ""); setEditSupply(b.supply ? String(b.supply) : ""); setEditSale(b.on_sale); }}
                    className="p-2 rounded-lg hover:bg-white/8 text-slate-400"
                    aria-label="Изменить"
                  >
                    <Icon name="Pencil" size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 p-5">
        <h3 className="font-bold mb-3">Эффекты имени</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {data.effects.map((e) => (
            <div key={e.code} className="rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2.5">
              <div className="text-sm font-semibold">{e.title}</div>
              <div className="text-[11px] text-slate-500">⚡ {e.price}{e.duration_days ? ` / ${e.duration_days} дней` : " навсегда"} · купили {formatNum(e.buyers)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 p-5">
        <h3 className="font-bold mb-3">Последние выдачи и покупки</h3>
        {data.items.length === 0 ? <p className="text-sm text-slate-500">Пока пусто</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-slate-500 text-left">
                <tr><th className="py-2 pr-3">Когда</th><th className="pr-3">Пользователь</th><th className="pr-3">Значок</th><th className="pr-3">Как</th><th>Статус</th></tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-t border-white/5">
                    <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{fmtDate(it.created_at)}</td>
                    <td className="pr-3">{it.user_name || "—"} <span className="text-slate-500 text-xs">ID {it.user_id}</span></td>
                    <td className="pr-3 whitespace-nowrap"><img src={badgeSrc(it.code)} alt="" className="w-5 h-5 inline mr-1.5 -mt-0.5" />{titleOf(it.code)} №{it.serial}</td>
                    <td className="pr-3 whitespace-nowrap">{it.method === "admin" ? <span className="text-violet-300">выдан{it.admin_name ? ` · ${it.admin_name}` : ""}</span> : <span className="text-amber-300">⚡ {it.price}</span>}</td>
                    <td>{it.revoked_at ? <span className="text-red-300">забран</span> : <span className="text-emerald-300">активен</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEdit(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#14121f] border border-white/10 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <img src={badgeSrc(edit.code)} alt="" className="w-12 h-12" />
              <div><div className="font-bold">{edit.title}</div><div className="text-xs text-slate-500">выдано {edit.issued}</div></div>
            </div>
            <label className="block mb-3">
              <span className="text-xs text-slate-500 mb-1 block">Цена, Молний</span>
              <input value={editPrice} onChange={(e) => setEditPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </label>
            <label className="block mb-3">
              <span className="text-xs text-slate-500 mb-1 block">Тираж (пусто — без ограничений)</span>
              <input value={editSupply} onChange={(e) => setEditSupply(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </label>
            <label className="flex items-center gap-2 mb-4 text-sm">
              <input type="checkbox" checked={editSale} onChange={(e) => setEditSale(e.target.checked)} />
              Продаётся в магазине
            </label>
            <div className="flex gap-2">
              <button onClick={() => setEdit(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-sm">Отмена</button>
              <button onClick={saveEdit} disabled={busy === "edit"} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
