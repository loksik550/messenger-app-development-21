import { useEffect, useState } from "react";
import { devApi } from "@/lib/devApi";
import { RARITY, badgeSrc, BADGE_TITLES, BADGE_DESC, BADGE_RARITY } from "@/lib/badges";

interface UB { code: string; serial: number; title: string; note: string | null; method: string; created_at: number }

const ALL = Object.keys(BADGE_TITLES);
const QUICK_REASONS = ["За тестирование", "За помощь с ошибками", "За активность", "Подарок от команды Nova", "За победу в конкурсе"];

/** Вкладка карточки пользователя: какие значки есть, выдать с причиной, забрать. */
export default function DevUserBadges({ userId, canEdit }: { userId: number; canEdit: boolean }) {
  const [list, setList] = useState<UB[] | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = async () => {
    try {
      const r = await devApi<{ badges: UB[] }>("user_shop_badges", { user_id: userId });
      setList(r.badges || []);
    } catch { setList([]); }
  };
  useEffect(() => { load(); }, [userId]);

  const flash = (ok: boolean, t: string) => { setMsg({ ok, t }); setTimeout(() => setMsg(null), 3500); };

  const grant = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      const r = await devApi<{ serial: number }>("badge_grant", { user_id: userId, code: pick, note: note.trim() });
      flash(true, `Выдан «${BADGE_TITLES[pick]}» №${r.serial}`);
      setPick(null); setNote("");
      await load();
    } catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
    setBusy(false);
  };

  const revoke = async (code: string) => {
    if (!confirm(`Забрать значок «${BADGE_TITLES[code]}»?`)) return;
    setBusy(true);
    try { await devApi("badge_revoke", { user_id: userId, code }); flash(true, "Значок забран"); await load(); }
    catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
    setBusy(false);
  };

  if (!list) return <div className="text-sm text-slate-500 py-6 text-center">Загрузка...</div>;
  const has = new Set(list.map((b) => b.code));

  return (
    <div className="space-y-4">
      {msg && <div className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{msg.t}</div>}

      <div>
        <div className="text-xs text-slate-500 mb-2">Значки пользователя</div>
        {list.length === 0 ? <p className="text-sm text-slate-500">Пока нет значков</p> : (
          <div className="space-y-2">
            {list.map((b) => (
              <div key={b.code} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/10 p-2.5">
                <img src={badgeSrc(b.code)} alt="" className="w-10 h-10" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{b.title} <span className="text-slate-500 font-normal">№{b.serial}</span></div>
                  <div className="text-[11px] text-slate-400 truncate">{b.note || BADGE_DESC[b.code]}</div>
                  <div className="text-[10px] text-slate-600">{b.method === "admin" ? "выдан вручную" : "куплен"} · {new Date(b.created_at * 1000).toLocaleDateString("ru")}</div>
                </div>
                {canEdit && (
                  <button onClick={() => revoke(b.code)} disabled={busy} className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 text-xs font-semibold disabled:opacity-50">Забрать</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {canEdit ? (
        <div>
          <div className="text-xs text-slate-500 mb-2">Выдать значок — выберите и укажите, за что</div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {ALL.map((c) => {
              const r = RARITY[BADGE_RARITY[c] || "common"];
              const own = has.has(c);
              return (
                <button
                  key={c}
                  disabled={own}
                  onClick={() => setPick(pick === c ? null : c)}
                  className={`rounded-xl p-1.5 text-center border transition ${own ? "opacity-30 cursor-not-allowed border-white/5" : pick === c ? "bg-violet-500/20" : "border-white/10 hover:bg-white/5"}`}
                  style={pick === c ? { borderColor: r.glow } : undefined}
                  title={own ? "Уже есть" : BADGE_DESC[c]}
                >
                  <img src={badgeSrc(c)} alt="" className="w-9 h-9 mx-auto" />
                  <div className="text-[9px] mt-0.5 truncate">{BADGE_TITLES[c]}</div>
                </button>
              );
            })}
          </div>
          {pick && (
            <div className="mt-3 rounded-xl border border-violet-500/30 bg-violet-500/[0.06] p-3">
              <div className="text-sm font-semibold mb-2">«{BADGE_TITLES[pick]}» — за что выдаём?</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_REASONS.map((q) => (
                  <button key={q} onClick={() => setNote(q)} className={`px-2.5 py-1 rounded-full text-[11px] ${note === q ? "bg-violet-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>{q}</button>
                ))}
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 120))}
                placeholder={BADGE_DESC[pick]}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50"
              />
              <p className="text-[10px] text-slate-500 mt-1">Это увидят все, кто нажмёт на значок. Пусто — покажется стандартное описание.</p>
              <button onClick={grant} disabled={busy} className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50">
                {busy ? "Выдаём..." : "Выдать значок"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-amber-300">Выдавать значки может администратор с правом на настройки</p>
      )}
    </div>
  );
}
