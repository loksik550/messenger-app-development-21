import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { RARITY, badgeSrc, type Rarity } from "@/lib/badges";
import ProName from "@/components/messenger/ProName";

interface ShopBadge { code: string; title: string; description: string; rarity: Rarity; price: number; supply: number | null; issued: number }
interface MyBadge { code: string; serial: number; shown: boolean; title: string; rarity: Rarity; supply: number | null }
interface Effect { code: string; title: string; description: string; price: number; duration_days: number | null; owned: boolean; expires_at: number | null }
interface Catalog { badges: ShopBadge[]; my_badges: MyBadge[]; effects: Effect[]; balance: number; name_effect: string | null }

interface Props {
  onBack?: () => void;
  currentUser?: User | null;
  onUserUpdate?: (u: User) => void;
  onOpenLightning?: () => void;
}

type Tab = "badges" | "names" | "mine";

const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleDateString("ru", { day: "numeric", month: "long" });

export function ShopPanel({ onBack, currentUser, onUserUpdate, onOpenLightning }: Props) {
  const [tab, setTab] = useState<Tab>("badges");
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [buyBadge, setBuyBadge] = useState<ShopBadge | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!currentUser) return;
    const r = await api("shop_catalog", {}, currentUser.id).catch(() => null);
    if (!r || r.error) { setError(r?.error || "Не удалось загрузить магазин"); return; }
    setError("");
    setData(r as Catalog);
  }, [currentUser?.id]);

  useEffect(() => { load(); }, [load]);

  const flash = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 2800);
  };

  const refreshMe = async () => {
    if (!currentUser) return;
    const r = await api("refresh_me", {}, currentUser.id).catch(() => null);
    if (r?.user) {
      onUserUpdate?.(r.user);
      try { localStorage.setItem("nova_user", JSON.stringify(r.user)); } catch { /* ignore */ }
    }
  };

  const doBuyBadge = async (b: ShopBadge) => {
    if (!currentUser) return;
    setBusy(b.code);
    const r = await api("badge_buy", { code: b.code }, currentUser.id).catch(() => null);
    setBusy("");
    setBuyBadge(null);
    if (!r || r.error) { flash(false, r?.error || "Нет связи"); return; }
    flash(true, `Значок «${b.title}» №${r.serial} теперь ваш`);
    await Promise.all([load(), refreshMe()]);
  };

  const doBuyEffect = async (e: Effect) => {
    if (!currentUser) return;
    setBusy(e.code);
    const r = await api("effect_buy", { code: e.code }, currentUser.id).catch(() => null);
    setBusy("");
    if (!r || r.error) { flash(false, r?.error || "Нет связи"); return; }
    flash(true, `Эффект «${e.title}» включён`);
    await Promise.all([load(), refreshMe()]);
  };

  const setEffect = async (code: string | null) => {
    if (!currentUser) return;
    setBusy(code || "off");
    const r = await api("effect_set", { code }, currentUser.id).catch(() => null);
    setBusy("");
    if (!r || r.error) { flash(false, r?.error || "Нет связи"); return; }
    await Promise.all([load(), refreshMe()]);
  };

  const toggleShown = async (b: MyBadge) => {
    if (!currentUser) return;
    setBusy(b.code);
    await api("badge_show", { code: b.code, shown: !b.shown }, currentUser.id).catch(() => null);
    setBusy("");
    await Promise.all([load(), refreshMe()]);
  };

  const owned = new Set((data?.my_badges || []).map((b) => b.code));
  const name = currentUser?.name || "Ваше имя";

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="px-4 pb-3" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-xl hover:bg-white/8 transition-colors" aria-label="Назад">
              <Icon name="ChevronLeft" size={20} />
            </button>
          )}
          <h2 className="text-xl font-bold flex-1">Магазин</h2>
          <button onClick={onOpenLightning} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-300 text-sm font-bold">
            <Icon name="Zap" size={14} />
            {data ? data.balance.toLocaleString("ru") : "…"}
            <Icon name="Plus" size={13} className="opacity-70" />
          </button>
        </div>
        <div className="flex gap-1.5 mt-3">
          {([["badges", "Значки", "Award"], ["names", "Эффекты имени", "Sparkles"], ["mine", "Моё", "Package"]] as const).map(([k, l, ic]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${tab === k ? "grad-primary text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}
            >
              <Icon name={ic} fallback="Circle" size={13} />
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
        {!currentUser && <p className="text-sm text-muted-foreground text-center py-10">Войдите, чтобы открыть магазин</p>}
        {error && <div className="text-sm text-red-400 text-center py-6">{error}</div>}
        {currentUser && !data && !error && (
          <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" /></div>
        )}

        {data && tab === "badges" && (
          <>
            <p className="text-xs text-muted-foreground mb-3">Значок виден рядом с вашим именем в профиле и в чатах. У редких — ограниченный тираж и номер экземпляра.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {data.badges.map((b) => {
                const r = RARITY[b.rarity] || RARITY.common;
                const left = b.supply ? Math.max(0, b.supply - b.issued) : null;
                const soldOut = left === 0;
                const mine = owned.has(b.code);
                return (
                  <button
                    key={b.code}
                    onClick={() => !mine && !soldOut && setBuyBadge(b)}
                    className="relative overflow-hidden rounded-3xl p-3 pt-4 text-center bg-gradient-to-b from-white/[0.06] to-white/[0.02] border"
                    style={{ borderColor: `${r.glow}55` }}
                  >
                    <div className="absolute -top-10 inset-x-0 h-24 blur-2xl opacity-40" style={{ background: r.glow }} />
                    <img src={badgeSrc(b.code)} alt="" className="relative w-16 h-16 mx-auto drop-shadow-[0_8px_14px_rgba(0,0,0,0.6)]" />
                    <div className="relative text-sm font-bold mt-2 truncate">{b.title}</div>
                    <div className="relative text-[10px] font-extrabold uppercase tracking-wider mt-0.5" style={{ color: r.color }}>{r.label}</div>
                    <div className="relative text-[10px] text-muted-foreground mt-0.5 h-3.5">
                      {b.supply ? (soldOut ? "Тираж раскуплен" : `Осталось ${left} из ${b.supply}`) : "Без ограничений"}
                    </div>
                    <div className="relative mt-2">
                      {mine ? (
                        <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold">Ваш</span>
                      ) : soldOut ? (
                        <span className="inline-block px-3 py-1 rounded-full bg-white/8 text-muted-foreground text-xs font-bold">Нет в наличии</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-amber-300 bg-amber-500/15">
                          <Icon name="Zap" size={11} /> {b.price}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {data && tab === "names" && (
          <>
            <p className="text-xs text-muted-foreground mb-3">Эффект видят все собеседники — в чатах, группах и в профиле.</p>
            <div className="space-y-3">
              {data.effects.map((e) => {
                const active = data.name_effect === e.code;
                return (
                  <div key={e.code} className={`rounded-3xl p-4 border ${active ? "border-violet-500/60 bg-violet-500/10" : "border-white/10 bg-white/[0.04]"}`}>
                    <div className="text-xl font-extrabold min-w-0">
                      <ProName name={name} effect={e.code} badgeSize={18} />
                    </div>
                    <div className="text-sm font-semibold mt-1.5">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.description}
                      {e.owned && e.expires_at ? ` · до ${fmtDate(e.expires_at)}` : ""}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {e.owned ? (
                        <>
                          <button
                            onClick={() => setEffect(active ? null : e.code)}
                            disabled={!!busy}
                            className={`flex-1 py-2 rounded-2xl text-sm font-bold disabled:opacity-50 ${active ? "glass" : "grad-primary text-white"}`}
                          >
                            {active ? "Снять" : "Надеть"}
                          </button>
                          {e.duration_days && (
                            <button onClick={() => doBuyEffect(e)} disabled={!!busy} className="px-4 py-2 rounded-2xl text-sm font-bold bg-amber-500/15 text-amber-300 disabled:opacity-50">
                              Продлить · ⚡ {e.price}
                            </button>
                          )}
                        </>
                      ) : (
                        <button onClick={() => doBuyEffect(e)} disabled={!!busy} className="flex-1 py-2 rounded-2xl text-sm font-bold grad-primary text-white disabled:opacity-50">
                          {busy === e.code ? "Покупаем..." : `Купить · ⚡ ${e.price}${e.duration_days ? ` / ${e.duration_days} дней` : " навсегда"}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {data && tab === "mine" && (
          <>
            {data.my_badges.length === 0 && !data.effects.some((e) => e.owned) && (
              <div className="text-center py-12">
                <Icon name="Package" size={36} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Здесь появятся ваши значки и эффекты</p>
              </div>
            )}
            {data.my_badges.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground mb-2">Мои значки — выключите, чтобы скрыть у имени</div>
                <div className="space-y-2 mb-5">
                  {data.my_badges.map((b) => {
                    const r = RARITY[b.rarity] || RARITY.common;
                    return (
                      <div key={b.code} className="flex items-center gap-3 rounded-2xl p-3 bg-white/[0.04] border border-white/10">
                        <img src={badgeSrc(b.code)} alt="" className="w-11 h-11" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate">{b.title}</div>
                          <div className="text-[11px]" style={{ color: r.color }}>
                            {r.label} · №{b.serial}{b.supply ? ` из ${b.supply}` : ""}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleShown(b)}
                          disabled={busy === b.code}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0 ${b.shown ? "bg-violet-500" : "bg-white/15"}`}
                          aria-label={b.shown ? "Скрыть значок" : "Показать значок"}
                        >
                          <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${b.shown ? "translate-x-5" : ""}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {data.effects.some((e) => e.owned) && (
              <>
                <div className="text-xs text-muted-foreground mb-2">Мои эффекты имени</div>
                <div className="space-y-2">
                  {data.effects.filter((e) => e.owned).map((e) => (
                    <button key={e.code} onClick={() => setEffect(data.name_effect === e.code ? null : e.code)} className="w-full flex items-center gap-3 rounded-2xl p-3 bg-white/[0.04] border border-white/10 text-left">
                      <span className="flex-1 min-w-0 text-base font-bold"><ProName name={name} effect={e.code} badgeSize={15} /></span>
                      <span className={`text-xs font-bold ${data.name_effect === e.code ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {data.name_effect === e.code ? "Надет" : "Надеть"}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {buyBadge && data && (
        <div className="fixed inset-0 z-[270] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 animate-fade-in" onClick={() => setBuyBadge(null)}>
          <div className="w-full max-w-sm glass-strong rounded-3xl p-5 animate-scale-in text-center" onClick={(e) => e.stopPropagation()} style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
            <div className="relative">
              <div className="absolute inset-x-10 top-0 h-28 blur-3xl opacity-50" style={{ background: (RARITY[buyBadge.rarity] || RARITY.common).glow }} />
              <img src={badgeSrc(buyBadge.code)} alt="" className="relative w-28 h-28 mx-auto drop-shadow-[0_12px_20px_rgba(0,0,0,0.6)]" />
            </div>
            <h3 className="text-xl font-bold mt-3">{buyBadge.title}</h3>
            <div className="text-xs font-extrabold uppercase tracking-wider mt-1" style={{ color: (RARITY[buyBadge.rarity] || RARITY.common).color }}>
              {(RARITY[buyBadge.rarity] || RARITY.common).label}
            </div>
            <p className="text-sm text-muted-foreground mt-2">{buyBadge.description}</p>
            <div className="mt-3 rounded-2xl bg-white/5 p-3 text-sm">
              {buyBadge.supply
                ? <>Вам достанется экземпляр <b>№{buyBadge.issued + 1}</b> из {buyBadge.supply}</>
                : <>Тираж не ограничен · ваш номер <b>№{buyBadge.issued + 1}</b></>}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-sm">
              Предпросмотр: <ProName name={name} badges={[buyBadge.code]} badgeSize={15} className="font-semibold" />
            </div>
            {data.balance < buyBadge.price ? (
              <>
                <p className="text-sm text-red-400 mt-4">Не хватает {buyBadge.price - data.balance} ⚡</p>
                <button onClick={() => { setBuyBadge(null); onOpenLightning?.(); }} className="w-full mt-2 py-3 rounded-2xl font-bold text-black bg-gradient-to-r from-amber-300 to-amber-500">
                  Пополнить Молнии
                </button>
              </>
            ) : (
              <button onClick={() => doBuyBadge(buyBadge)} disabled={!!busy} className="w-full mt-4 py-3 rounded-2xl grad-primary text-white font-bold disabled:opacity-50">
                {busy ? "Покупаем..." : `Купить за ⚡ ${buyBadge.price}`}
              </button>
            )}
            <button onClick={() => setBuyBadge(null)} className="w-full mt-2 py-2.5 rounded-2xl glass text-sm font-semibold">Отмена</button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-[300] px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-lg animate-fade-in ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

export default ShopPanel;
