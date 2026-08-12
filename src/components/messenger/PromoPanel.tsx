import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";

interface RefInfo {
  code: string;
  invited: number;
  days_earned: number;
  already_used: boolean;
  enabled: boolean;
  inviter_days: number;
  invited_days: number;
}

export default function PromoPanel({
  currentUser, onClose, onUserUpdate,
}: {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (u: User) => void;
}) {
  const [tab, setTab] = useState<"promo" | "referral">("promo");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [refCode, setRefCode] = useState("");
  const [ref, setRef] = useState<RefInfo | null>(null);
  const [friendCode, setFriendCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api("my_referral", {}, currentUser.id).then((r) => {
      if (r && !r.error) setRef(r as unknown as RefInfo);
    });
  }, [currentUser.id]);

  const refresh = async () => {
    const me = await api("refresh_me", {}, currentUser.id);
    if (me?.user && onUserUpdate) onUserUpdate({ ...currentUser, ...me.user });
  };

  const activate = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setErr("");
    setOk("");
    const r = await api("promo_activate", { code: code.trim() }, currentUser.id);
    setBusy(false);
    if (r?.error) {
      setErr(r.error);
      return;
    }
    setOk(r.message || "Промокод активирован");
    setCode("");
    refresh();
  };

  const applyFriend = async () => {
    if (!friendCode.trim()) return;
    setBusy(true);
    setErr("");
    setOk("");
    const r = await api("referral_apply", { code: friendCode.trim() }, currentUser.id);
    setBusy(false);
    if (r?.error) {
      setErr(r.error);
      return;
    }
    setOk(`Premium на ${r.granted_days} дн. активирован`);
    setFriendCode("");
    const upd = await api("my_referral", {}, currentUser.id);
    if (upd && !upd.error) setRef(upd as unknown as RefInfo);
    refresh();
  };

  const copyCode = () => {
    const text = ref?.code || refCode;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (ref?.code) setRefCode(ref.code);
  }, [ref?.code]);

  return (
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#12131f] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 pb-7 max-h-[92vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Icon name="Gift" size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-lg">Промокоды и бонусы</h2>
            <p className="text-xs text-muted-foreground">Получите Premium бесплатно</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8 transition text-muted-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="flex gap-1.5 mb-5 glass rounded-2xl p-1">
          {([["promo", "Промокод"], ["referral", "Пригласить друга"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => { setTab(k); setErr(""); setOk(""); }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${
                tab === k ? "grad-primary text-white" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "promo" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Введите промокод</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="NOVA2026"
                className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3.5 text-center text-lg font-mono font-bold tracking-widest outline-none focus:border-violet-500/50 placeholder:text-muted-foreground/40"
              />
            </div>

            <button
              onClick={activate}
              disabled={busy || !code.trim()}
              className="w-full py-3.5 grad-primary rounded-2xl text-white font-bold glow-primary disabled:opacity-40 transition"
            >
              {busy ? "Проверяем..." : "Активировать"}
            </button>

            <div className="glass rounded-2xl p-4">
              <div className="flex items-start gap-2.5">
                <Icon name="Info" size={15} className="text-violet-400 mt-0.5 shrink-0" />
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Промокоды дают бесплатные дни Premium или скидку на подписку.
                  Ищите их в наших анонсах и акциях.
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === "referral" && (
          <div className="space-y-4">
            {ref?.enabled === false ? (
              <div className="glass rounded-2xl p-5 text-center">
                <Icon name="Clock" size={26} className="text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm">Программа временно приостановлена</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl p-5 text-white relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)" }}>
                  <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                  <div className="relative">
                    <div className="text-xs text-white/80 mb-1">Ваш код приглашения</div>
                    <div className="text-2xl font-black font-mono tracking-widest mb-3">
                      {ref?.code || "—"}
                    </div>
                    <button
                      onClick={copyCode}
                      className="w-full py-2.5 rounded-xl bg-white/20 backdrop-blur text-sm font-semibold hover:bg-white/25 transition"
                    >
                      {copied ? "Скопировано" : "Скопировать код"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="glass rounded-2xl p-4 text-center">
                    <div className="text-2xl font-black">{ref?.invited ?? 0}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">друзей пришло</div>
                  </div>
                  <div className="glass rounded-2xl p-4 text-center">
                    <div className="text-2xl font-black">{ref?.days_earned ?? 0}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">дней получено</div>
                  </div>
                </div>

                <div className="glass rounded-2xl p-4">
                  <div className="flex items-start gap-2.5">
                    <Icon name="Sparkles" size={15} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-[12px] text-muted-foreground leading-relaxed">
                      Друг вводит ваш код — вы получаете {ref?.inviter_days ?? 7} дн. Premium,
                      а он {ref?.invited_days ?? 7} дн. в подарок.
                    </p>
                  </div>
                </div>

                {!ref?.already_used && (
                  <div className="pt-1">
                    <label className="text-xs text-muted-foreground mb-2 block">
                      Вас пригласили? Введите код друга
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={friendCode}
                        onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                        placeholder="NOVA0001"
                        className="flex-1 bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm font-mono outline-none focus:border-violet-500/50 placeholder:text-muted-foreground/40"
                      />
                      <button
                        onClick={applyFriend}
                        disabled={busy || !friendCode.trim()}
                        className="px-5 rounded-2xl grad-primary text-white text-sm font-bold disabled:opacity-40"
                      >
                        Ввести
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {err && (
          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 mt-4">
            <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}
        {ok && (
          <div className="flex items-start gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3 mt-4">
            <Icon name="CircleCheck" size={16} className="mt-0.5 shrink-0" />
            <span>{ok}</span>
          </div>
        )}
      </div>
    </div>
  );
}
