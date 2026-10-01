import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { native } from "@/lib/native";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { track } from "@/lib/track";

export const INVITE_BASE = "https://novaa.pro/";

interface RefInfo {
  code: string;
  invited: number;
  days_earned: number;
  enabled: boolean;
  inviter_days: number;
  invited_days: number;
}

export function inviteLink(code: string) {
  return `${INVITE_BASE}?ref=${encodeURIComponent(code)}`;
}

export default function InvitePanel({ currentUser, onClose }: { currentUser: User; onClose: () => void }) {
  useEdgeSwipeBack(onClose);
  const [info, setInfo] = useState<RefInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    track("invite_open");
    api("my_referral", {}, currentUser.id)
      .then(r => { if (r && !r.error) setInfo(r as RefInfo); else setError(r?.error || "Не удалось загрузить"); })
      .catch(() => setError("Нет связи"));
  }, [currentUser.id]);

  const link = info ? inviteLink(info.code) : "";
  const text = info
    ? `Привет! Я общаюсь в Nova — переходи по ссылке, и мы оба получим Premium на ${info.invited_days} дн. 🎁\n${link}`
    : "";

  const share = async () => {
    if (!info) return;
    track("invite_share");
    const shared = await native.share({ title: "Nova", text, dialogTitle: "Пригласить в Nova" });
    if (!shared) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const copy = async () => {
    if (!link) return;
    track("invite_copy");
    await native.clipboard.write(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0f0c1d] animate-fade-in">
      <div className="px-4 pb-3 flex items-center gap-2" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8 transition-colors" aria-label="Назад">
          <Icon name="ChevronLeft" size={22} />
        </button>
        <h2 className="text-xl font-bold">Пригласить друзей</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
        <div className="flex flex-col items-center text-center pt-4 pb-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-pink-500 flex items-center justify-center mb-4 shadow-lg">
            <Icon name="Gift" size={36} className="text-white" />
          </div>
          {info ? (
            <>
              <div className="text-lg font-bold mb-1">
                Вам — {info.inviter_days} дн. Premium, другу — {info.invited_days} дн.
              </div>
              <div className="text-sm text-muted-foreground max-w-xs">
                Отправьте ссылку другу. Когда он зарегистрируется по ней, вы оба получите Premium.
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">{error || "Загрузка..."}</div>
          )}
        </div>

        {info && !info.enabled && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
            Программа приглашений временно приостановлена. Ссылка заработает, когда её снова включат.
          </div>
        )}

        {info && (
          <>
            <div className="glass rounded-2xl p-4 mb-3">
              <div className="text-xs text-muted-foreground mb-1">Ваша ссылка</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-sm font-medium truncate text-violet-300">{link}</div>
                <button onClick={copy} className="p-2 rounded-xl hover:bg-white/8" aria-label="Скопировать">
                  <Icon name={copied ? "Check" : "Copy"} size={18} className={copied ? "text-emerald-400" : ""} />
                </button>
              </div>
              <div className="text-xs text-muted-foreground mt-2">Код: <span className="font-mono text-foreground">{info.code}</span></div>
            </div>

            <button onClick={share} className="w-full py-3.5 grad-primary rounded-2xl text-white font-bold flex items-center justify-center gap-2 glow-primary mb-6">
              <Icon name="Share2" size={18} /> Поделиться ссылкой
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold">{info.invited}</div>
                <div className="text-xs text-muted-foreground">друзей пришло</div>
              </div>
              <div className="glass rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold">{info.days_earned}</div>
                <div className="text-xs text-muted-foreground">дней Premium получено</div>
              </div>
            </div>
          </>
        )}
      </div>

      {copied && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-10 z-[210] px-4 py-2 rounded-full glass-strong text-sm animate-fade-in">
          Ссылка скопирована
        </div>
      )}
    </div>
  );
}
