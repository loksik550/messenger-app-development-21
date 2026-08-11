import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type User } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";

interface RequestInfo {
  id: number;
  status: string;
  note: string;
  created_at: number;
  reviewed_at: number | null;
}

const CATEGORIES = [
  { key: "personal", label: "Частное лицо", icon: "User", hint: "Публичная личность, автор" },
  { key: "blogger", label: "Блогер", icon: "Sparkles", hint: "Аудитория в соцсетях" },
  { key: "business", label: "Компания", icon: "Briefcase", hint: "Бренд или организация" },
  { key: "media", label: "СМИ", icon: "Newspaper", hint: "Издание, редакция" },
  { key: "official", label: "Гос. организация", icon: "Landmark", hint: "Официальная структура" },
];

export default function VerificationPanel({
  currentUser, onBack,
}: {
  currentUser: User;
  onBack: () => void;
}) {
  useEdgeSwipeBack(onBack);
  const [verified, setVerified] = useState(!!currentUser.verified);
  const [request, setRequest] = useState<RequestInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState(currentUser.name || "");
  const [category, setCategory] = useState("personal");
  const [links, setLinks] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const r = await api("verification_status", {}, currentUser.id);
      if (r && !r.error) {
        setVerified(!!r.verified);
        setRequest(r.request || null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setError("");
    if (fullName.trim().length < 2) {
      setError("Укажите имя или название");
      return;
    }
    setBusy(true);
    try {
      const r = await api(
        "verification_apply",
        { full_name: fullName.trim(), category, links: links.trim(), comment: comment.trim() },
        currentUser.id,
      );
      if (r?.error) {
        setError(r.error);
        return;
      }
      await load();
    } catch {
      setError("Не удалось отправить заявку");
    } finally {
      setBusy(false);
    }
  };

  const pending = request?.status === "pending";
  const rejected = request?.status === "rejected";

  return (
    <div className="flex flex-col h-full max-h-[100dvh] bg-background overflow-hidden animate-fade-in">
      <header
        className="flex items-center gap-3 px-4 pb-3 border-b border-border shrink-0"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-accent transition" aria-label="Назад">
          <Icon name="ArrowLeft" size={20} />
        </button>
        <h1 className="text-lg font-semibold">Верификация</h1>
      </header>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <Icon name="Loader2" size={24} className="animate-spin text-violet-400" />
          </div>
        ) : verified ? (
          <div className="flex flex-col items-center text-center py-10">
            <div className="w-20 h-20 rounded-3xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center mb-4">
              <Icon name="BadgeCheck" size={40} className="text-sky-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Аккаунт подтверждён</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Рядом с вашим именем отображается синяя галочка. Она видна всем собеседникам.
            </p>
          </div>
        ) : pending ? (
          <div className="flex flex-col items-center text-center py-10">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mb-4">
              <Icon name="Clock" size={38} className="text-amber-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Заявка на рассмотрении</h2>
            <p className="text-sm text-muted-foreground max-w-xs mb-1">
              Мы проверяем данные вручную. Обычно это занимает до трёх дней.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Отправлена {new Date((request?.created_at || 0) * 1000).toLocaleDateString("ru")}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="glass rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center shrink-0">
                  <Icon name="BadgeCheck" size={20} className="text-sky-400" />
                </div>
                <div>
                  <h2 className="font-semibold mb-1">Синяя галочка</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Подтверждает, что аккаунт настоящий. Помогает читателям отличить вас от подделок
                    и повышает доверие к вашим сообщениям.
                  </p>
                </div>
              </div>
            </div>

            {rejected && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
                <div>
                  <div>Предыдущая заявка отклонена</div>
                  {request?.note && <div className="text-xs opacity-80 mt-0.5">{request.note}</div>}
                  <div className="text-xs opacity-70 mt-1">Можно подать новую с уточнёнными данными.</div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Имя или название</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={100}
                className="w-full glass rounded-xl px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 transition"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Категория</label>
              <div className="space-y-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition text-left ${
                      category === c.key
                        ? "bg-violet-500/15 border-violet-500/40"
                        : "glass border-transparent hover:bg-white/5"
                    }`}
                  >
                    <Icon
                      name={c.icon}
                      size={18}
                      className={category === c.key ? "text-violet-400" : "text-muted-foreground"}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{c.label}</div>
                      <div className="text-[11px] text-muted-foreground">{c.hint}</div>
                    </div>
                    {category === c.key && <Icon name="Check" size={16} className="text-violet-400" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Ссылки на вас в интернете
              </label>
              <input
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="Сайт, соцсети, публикации"
                maxLength={500}
                className="w-full glass rounded-xl px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 transition placeholder-muted-foreground"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Почему вас стоит подтвердить
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Коротко расскажите о себе или организации"
                className="w-full glass rounded-xl px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 transition resize-none placeholder-muted-foreground"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={submit}
              disabled={busy}
              className="w-full py-3.5 grad-primary rounded-2xl text-white font-bold glow-primary hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Icon name="Loader2" size={18} className="animate-spin" />
                  Отправляем...
                </>
              ) : (
                <>
                  Отправить заявку
                  <Icon name="ArrowRight" size={18} />
                </>
              )}
            </button>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Заявки рассматриваются вручную. Мы можем запросить дополнительные подтверждения.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}