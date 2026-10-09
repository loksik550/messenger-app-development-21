import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User, type Fundraiser, YOOKASSA_PAY_API } from "@/lib/api";
import { authHeaders } from "@/lib/authToken";

interface Props {
  currentUser: User;
  fundraiserId?: number;
  mode: "view" | "create";
  onClose: () => void;
  onCreated?: (id: number, title: string, target: number) => void;
}

export default function FundraiserPanel({ currentUser, fundraiserId, mode, onClose, onCreated }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [target, setTarget] = useState<string>("10000");

  // View
  const [data, setData] = useState<Fundraiser | null>(null);
  const [donateAmount, setDonateAmount] = useState<string>("100");
  const [donateMsg, setDonateMsg] = useState<string>("");
  const [isAnon, setIsAnon] = useState(false);
  const [donateMethod, setDonateMethod] = useState<"wallet" | "yookassa">("yookassa");
  const [donateEmail, setDonateEmail] = useState<string>(localStorage.getItem("nova_payment_email") || "");

  const reload = async () => {
    if (!fundraiserId) return;
    const r = await api("fundraiser_get", { fundraiser_id: fundraiserId });
    if (r.fundraiser) setData(r.fundraiser as Fundraiser);
  };

  useEffect(() => { if (mode === "view") reload();   }, [fundraiserId]);

  const create = async () => {
    setError("");
    const t = parseFloat(target);
    if (!title.trim() || title.trim().length < 2) { setError("Название от 2 символов"); return; }
    if (!t || t < 100) { setError("Цель от 100 ₽"); return; }
    setBusy(true);
    const r = await api("fundraiser_create", {
      title: title.trim(),
      description: description.trim(),
      cover_url: coverUrl || null,
      target_amount: t,
    }, currentUser.id);
    setBusy(false);
    if (r.fundraiser_id) {
      onCreated?.(r.fundraiser_id, title.trim(), t);
      onClose();
    } else {
      setError(r.error || "Не удалось создать");
    }
  };

  const donateWallet = async () => {
    setError("");
    const a = parseFloat(donateAmount);
    if (!a || a < 10) { setError("Минимум 10 ₽"); return; }
    setBusy(true);
    const r = await api("fundraiser_donate_wallet", {
      fundraiser_id: fundraiserId,
      amount: a,
      message: donateMsg,
      is_anonymous: isAnon,
    }, currentUser.id);
    setBusy(false);
    if (r.collected_amount !== undefined) {
      await reload();
      const userR = await api("get_me", { phone: currentUser.phone });
      if (userR.user) localStorage.setItem("nova_user", JSON.stringify(userR.user));
    } else {
      setError(r.error || "Ошибка");
    }
  };

  const donateYookassa = async () => {
    setError("");
    const a = parseFloat(donateAmount);
    if (!a || a < 10) { setError("Минимум 10 ₽"); return; }
    if (!donateEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donateEmail)) {
      setError("Введи email для чека"); return;
    }
    localStorage.setItem("nova_payment_email", donateEmail);
    setBusy(true);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?payment=success&fund=${fundraiserId}`;
      const res = await fetch(YOOKASSA_PAY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(currentUser.id) },
        body: JSON.stringify({
          amount: a,
          user_email: donateEmail,
          return_url: returnUrl,
          purpose: "fundraiser",
          related_id: fundraiserId,
          extra: { donor_name: currentUser.name, message: donateMsg, is_anonymous: isAnon },
        }),
      });
      const d = await res.json();
      setBusy(false);
      if (d.payment_url) {
        window.location.href = d.payment_url;
      } else {
        setError(d.error || "Не удалось создать платёж");
      }
    } catch {
      setBusy(false);
      setError("Ошибка соединения с ЮKassa");
    }
  };

  const closeFund = async () => {
    if (!fundraiserId) return;
    if (!confirm("Закрыть сбор? Это действие необратимо.")) return;
    await api("fundraiser_close", { fundraiser_id: fundraiserId }, currentUser.id);
    await reload();
  };

  const fmt = (v: number) => v.toLocaleString("ru", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-[260] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="font-bold flex-1 text-lg">
          {mode === "create" ? "Создать сбор" : "Сбор средств"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
        {mode === "create" && (
          <>
            <div className="rounded-3xl p-5 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #ec4899, #a855f7)" }}>
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
              <Icon name="HandHeart" size={32} className="text-white mb-2" />
              <div className="text-lg font-black">Открой свой сбор</div>
              <div className="text-xs text-white/85">Друзья и подписчики смогут поддержать тебя прямо в чате</div>
            </div>

            <div className="glass rounded-2xl p-3 space-y-2">
              <div className="text-[11px] text-muted-foreground">Название сбора</div>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="На что собираем?" maxLength={120}
                className="w-full bg-white/5 rounded-xl px-3 py-2.5 outline-none text-sm" />
            </div>

            <div className="glass rounded-2xl p-3 space-y-2">
              <div className="text-[11px] text-muted-foreground">Описание</div>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Расскажи, на что нужны деньги" maxLength={1000} rows={4}
                className="w-full bg-white/5 rounded-xl px-3 py-2.5 outline-none text-sm resize-none" />
            </div>

            <div className="glass rounded-2xl p-3 space-y-2">
              <div className="text-[11px] text-muted-foreground">Цель сбора, ₽</div>
              <input type="number" value={target} onChange={e => setTarget(e.target.value)}
                min="100" max="10000000"
                className="w-full bg-white/5 rounded-xl px-3 py-2.5 outline-none text-sm font-bold" />
            </div>

            <div className="glass rounded-2xl p-3 space-y-2">
              <div className="text-[11px] text-muted-foreground">Обложка (URL картинки, опционально)</div>
              <input value={coverUrl} onChange={e => setCoverUrl(e.target.value)}
                placeholder="https://..." className="w-full bg-white/5 rounded-xl px-3 py-2.5 outline-none text-xs" />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button onClick={create} disabled={busy}
              className="w-full py-3.5 rounded-2xl font-black text-white grad-primary disabled:opacity-50">
              {busy ? "Создаём..." : "Создать сбор"}
            </button>
          </>
        )}

        {mode === "view" && data && (
          <>
            {data.cover_url && (
              <img src={data.cover_url} alt="" className="w-full h-48 object-cover rounded-2xl" />
            )}

            <div className="glass rounded-3xl p-4">
              <h3 className="text-xl font-black mb-1">{data.title}</h3>
              <div className="text-xs text-muted-foreground mb-3">от {data.owner_name}</div>
              {data.description && <p className="text-sm leading-relaxed mb-4">{data.description}</p>}

              {/* Прогресс */}
              <div className="space-y-1 mb-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black grad-text">{fmt(data.collected_amount)} ₽</span>
                  <span className="text-xs text-muted-foreground">из {fmt(data.target_amount)} ₽</span>
                </div>
                <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full grad-primary transition-all"
                    style={{ width: `${Math.min(100, (data.collected_amount / data.target_amount) * 100)}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{Math.round((data.collected_amount / data.target_amount) * 100)}% собрано</span>
                  <span>{data.donations.length} донатов</span>
                </div>
              </div>

              {data.status === "closed" ? (
                <div className="bg-zinc-500/10 border border-zinc-500/20 rounded-xl px-3 py-2 text-center text-xs text-muted-foreground">
                  Сбор закрыт
                </div>
              ) : data.owner_id === currentUser.id ? (
                <button onClick={closeFund}
                  className="w-full py-2.5 rounded-xl bg-white/5 text-sm font-semibold text-muted-foreground hover:bg-white/10">
                  Закрыть сбор
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    {[100, 300, 500, 1000].map(a => (
                      <button key={a} onClick={() => setDonateAmount(String(a))}
                        className={`py-2 rounded-xl text-xs font-bold transition ${
                          donateAmount === String(a) ? "grad-primary text-white" : "bg-white/5"
                        }`}>{a} ₽</button>
                    ))}
                  </div>
                  <input type="number" value={donateAmount} onChange={e => setDonateAmount(e.target.value)}
                    min="10" placeholder="Сумма ₽"
                    className="w-full bg-white/5 rounded-xl px-3 py-2.5 outline-none text-sm font-semibold" />
                  <input value={donateMsg} onChange={e => setDonateMsg(e.target.value)}
                    placeholder="Сообщение (необязательно)" maxLength={200}
                    className="w-full bg-white/5 rounded-xl px-3 py-2.5 outline-none text-xs" />
                  <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={isAnon} onChange={e => setIsAnon(e.target.checked)} />
                    Скрыть моё имя в списке
                  </label>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button onClick={() => setDonateMethod("yookassa")}
                      className={`p-2 rounded-xl border-2 text-xs font-semibold ${
                        donateMethod === "yookassa" ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-white/5"
                      }`}>Картой</button>
                    <button onClick={() => setDonateMethod("wallet")}
                      className={`p-2 rounded-xl border-2 text-xs font-semibold ${
                        donateMethod === "wallet" ? "border-emerald-400 bg-emerald-500/10" : "border-white/10 bg-white/5"
                      }`}>С кошелька</button>
                  </div>
                  {donateMethod === "yookassa" && (
                    <input type="email" value={donateEmail} onChange={e => setDonateEmail(e.target.value)}
                      placeholder="Email для чека"
                      className="w-full bg-white/5 rounded-xl px-3 py-2.5 outline-none text-xs" />
                  )}

                  {error && <p className="text-xs text-red-400">{error}</p>}

                  <button onClick={donateMethod === "yookassa" ? donateYookassa : donateWallet}
                    disabled={busy}
                    className="w-full py-3 rounded-2xl font-black text-white grad-primary disabled:opacity-50">
                    {busy ? "Отправляем..." : `Поддержать на ${donateAmount || 0} ₽`}
                  </button>
                </div>
              )}
            </div>

            {data.donations.length > 0 && (
              <div className="glass rounded-2xl p-3">
                <div className="text-xs text-muted-foreground mb-2 px-1">Последние донаты</div>
                <div className="divide-y divide-white/5">
                  {data.donations.map(d => (
                    <div key={d.id} className="flex items-center gap-3 py-2">
                      <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold">
                        {d.donor_name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{d.donor_name}</div>
                        {d.message && <div className="text-[11px] text-muted-foreground truncate">{d.message}</div>}
                      </div>
                      <div className="text-sm font-black grad-text">+{fmt(d.amount)} ₽</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {mode === "view" && !data && (
          <div className="text-center text-sm text-muted-foreground py-8">Загружаем...</div>
        )}
      </div>
    </div>
  );
}
