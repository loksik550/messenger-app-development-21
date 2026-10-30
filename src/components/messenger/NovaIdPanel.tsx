import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, YOOKASSA_PAY_API, type User } from "@/lib/api";
import { authHeaders } from "@/lib/authToken";
import SbpQrModal from "@/components/messenger/SbpQrModal";

interface Price { lightning: number; rub: number; beautiful?: boolean }
interface Info {
  current: string | null;
  is_pro: boolean;
  lightning: number;
  enabled: boolean;
  prices: Record<string, Price>;
  min_len: number;
  max_len: number;
}
interface CheckRes {
  nova_id: string;
  available: boolean;
  reason?: string;
  mine?: boolean;
  price?: Price;
  suggestions?: { nova_id: string; price: Price }[];
}

const fmtRub = (n: number) => `${n.toLocaleString("ru", { maximumFractionDigits: 2 })} ₽`;

export default function NovaIdPanel({
  currentUser, onClose, onUserUpdate, onOpenPro, onOpenLightning,
}: {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (u: User) => void;
  onOpenPro?: () => void;
  onOpenLightning?: () => void;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [q, setQ] = useState("");
  const [checking, setChecking] = useState(false);
  const [res, setRes] = useState<CheckRes | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [askEmail, setAskEmail] = useState<null | "card" | "sbp">(null);
  const [qr, setQr] = useState<{ data: string; paymentId: string; amount: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api("nova_id_info", {}, currentUser.id).then((d) => { if (!d.error) setInfo(d as Info); });
    setEmail(localStorage.getItem("nova_payment_email") || "");
  }, [currentUser.id]);

  const check = (value: string) => {
    const v = value.replace(/\D/g, "").slice(0, 7);
    setQ(v);
    setRes(null);
    setError("");
    if (timer.current) clearTimeout(timer.current);
    if (v.length < 3) return;
    timer.current = setTimeout(async () => {
      setChecking(true);
      const d = await api("nova_id_check", { nova_id: v }, currentUser.id);
      setChecking(false);
      if (!d.error) setRes(d as CheckRes);
    }, 400);
  };

  const refreshMe = async () => {
    const me = await api("get_me", {}, currentUser.id);
    if (me?.user) {
      onUserUpdate?.(me.user);
      localStorage.setItem("nova_user", JSON.stringify(me.user));
    }
  };

  const buyLightning = async () => {
    if (!res?.price) return;
    setBusy(true);
    setError("");
    const d = await api("nova_id_buy", { nova_id: res.nova_id }, currentUser.id);
    setBusy(false);
    if (d.error) { setError(d.error); return; }
    await refreshMe();
    setDone(d.nova_id);
  };

  const buyRub = async (method: "card" | "sbp") => {
    if (!res?.price) return;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAskEmail(method); setError("Введите email — он нужен для чека"); return; }
    localStorage.setItem("nova_payment_email", email);
    setBusy(true);
    setError("");
    try {
      const r = await fetch(YOOKASSA_PAY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(currentUser.id) },
        body: JSON.stringify({
          amount: res.price.rub, user_email: email, purpose: "nova_id", method,
          return_url: `${window.location.origin}${window.location.pathname}?payment=success`,
          extra: { nova_id: res.nova_id },
        }),
      });
      const d = await r.json();
      setBusy(false);
      if (method === "sbp" && d.qr_data) { setQr({ data: d.qr_data, paymentId: d.payment_id, amount: res.price.rub }); return; }
      if (d.payment_url) { window.location.href = d.payment_url; return; }
      setError(d.error || "Не удалось создать платёж");
    } catch {
      setBusy(false);
      setError("Ошибка соединения с оплатой");
    }
  };

  if (qr) {
    return (
      <SbpQrModal
        qrData={qr.data}
        paymentId={qr.paymentId}
        amount={qr.amount}
        userId={currentUser.id}
        onPaid={async () => { setQr(null); await refreshMe(); setDone(res?.nova_id || null); }}
        onClose={() => setQr(null)}
      />
    );
  }

  const isPro = info?.is_pro ?? !!currentUser.is_pro;
  const lightning = info?.lightning ?? currentUser.lightning_balance ?? 0;
  const enough = res?.price ? lightning >= res.price.lightning : false;

  return (
    <div className="fixed inset-0 z-[270] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="font-bold flex-1 text-lg">Красивый ID</h2>
        <span className="inline-flex items-center gap-1 text-xs text-amber-300 font-semibold">
          <Icon name="Zap" size={13} /> {lightning.toLocaleString("ru")}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-md w-full mx-auto">
        {done ? (
          <div className="text-center py-10 animate-scale-in">
            <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}>
              <Icon name="Check" size={36} className="text-white" />
            </div>
            <div className="text-sm text-muted-foreground">Ваш новый ID</div>
            <div className="text-4xl font-black font-mono tracking-wider mt-1">{done}</div>
            <p className="text-sm text-muted-foreground mt-3">Теперь вас можно найти по нему в поиске.</p>
            <button onClick={onClose} className="mt-6 px-6 py-3 rounded-2xl grad-primary text-white font-semibold">Готово</button>
          </div>
        ) : (
          <>
            <div className="glass rounded-2xl p-4 text-center">
              <div className="text-xs text-muted-foreground">Сейчас ваш ID</div>
              <div className="text-2xl font-black font-mono tracking-wider">{info?.current || currentUser.nova_id || "—"}</div>
            </div>

            {!isPro && (
              <button onClick={onOpenPro} className="w-full rounded-2xl p-4 text-left flex items-center gap-3 border border-violet-500/30" style={{ background: "linear-gradient(135deg, rgba(139,92,246,.18), rgba(217,70,239,.12))" }}>
                <Icon name="Lock" size={20} className="text-violet-300" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">Только для Nova Pro</div>
                  <div className="text-xs text-muted-foreground">Проверить ID может каждый, купить — подписчики Pro</div>
                </div>
                <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
              </button>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Желаемый ID — от 3 до 7 цифр</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">ID</span>
                <input
                  value={q}
                  onChange={(e) => check(e.target.value)}
                  inputMode="numeric"
                  placeholder="666"
                  autoFocus
                  className="w-full glass rounded-2xl pl-12 pr-12 py-4 text-2xl font-mono font-bold tracking-widest outline-none focus:ring-2 focus:ring-violet-500/50"
                />
                {checking && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />}
              </div>
            </div>

            {res && (
              <div className={`rounded-2xl p-4 border animate-fade-in ${res.available ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/25 bg-red-500/5"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon name={res.available ? "CircleCheck" : "CircleX"} size={18} className={res.available ? "text-emerald-400" : "text-red-400"} />
                  <span className="font-mono font-bold text-lg">{res.nova_id}</span>
                  <span className={`text-sm ${res.available ? "text-emerald-400" : "text-red-400"}`}>{res.available ? "свободен" : res.reason}</span>
                </div>
                {res.available && res.price && (
                  <>
                    {res.price.beautiful && <div className="text-[11px] text-fuchsia-300 mb-2">Красивая комбинация — цена выше</div>}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="glass rounded-xl p-3 text-center">
                        <div className="text-[11px] text-muted-foreground">Молниями</div>
                        <div className="font-bold text-amber-300 flex items-center justify-center gap-1"><Icon name="Zap" size={14} />{res.price.lightning.toLocaleString("ru")}</div>
                      </div>
                      <div className="glass rounded-xl p-3 text-center">
                        <div className="text-[11px] text-muted-foreground">Рублями</div>
                        <div className="font-bold">{fmtRub(res.price.rub)}</div>
                      </div>
                    </div>
                    {isPro && info?.enabled !== false && (
                      <div className="space-y-2 mt-3">
                        <button
                          onClick={enough ? buyLightning : onOpenLightning}
                          disabled={busy}
                          className="w-full py-3 rounded-2xl text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                        >
                          <Icon name="Zap" size={16} />
                          {enough ? `Купить за ${res.price.lightning.toLocaleString("ru")} ⚡` : `Не хватает ${(res.price.lightning - lightning).toLocaleString("ru")} ⚡ — пополнить`}
                        </button>
                        {res.price.rub > 0 && (
                          <>
                            {askEmail && (
                              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email для чека" type="email"
                                className="w-full glass rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/50" />
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <button onClick={() => buyRub("sbp")} disabled={busy} className="py-3 rounded-2xl glass font-semibold text-sm disabled:opacity-60">СБП · {fmtRub(res.price.rub)}</button>
                              <button onClick={() => buyRub("card")} disabled={busy} className="py-3 rounded-2xl glass font-semibold text-sm disabled:opacity-60">Картой</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
                {!res.available && res.suggestions && res.suggestions.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-2">Свободные похожие:</div>
                    <div className="flex flex-wrap gap-2">
                      {res.suggestions.map((s) => (
                        <button key={s.nova_id} onClick={() => check(s.nova_id)} className="px-3 py-1.5 rounded-full glass text-sm font-mono hover:bg-white/10">
                          {s.nova_id} <span className="text-amber-300 text-xs">⚡{s.price.lightning}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <div className="text-sm text-red-400 text-center">{error}</div>}

            {info && (
              <div className="glass rounded-2xl p-4">
                <div className="text-sm font-semibold mb-2">Цены</div>
                <div className="space-y-1.5">
                  {Object.entries(info.prices).map(([len, p]) => (
                    <div key={len} className="flex items-center text-sm">
                      <span className="flex-1 text-muted-foreground">{len} цифры{Number(len) >= 5 ? "" : ""}</span>
                      <span className="text-amber-300 mr-3">⚡{p.lightning.toLocaleString("ru")}</span>
                      <span>{fmtRub(p.rub)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Красивые комбинации (666, 1234, 7777, 1000, зеркальные) стоят дороже. Старый ID освобождается.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
