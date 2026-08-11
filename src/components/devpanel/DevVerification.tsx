import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface VerifItem {
  id: number;
  user_id: number;
  user_name: string;
  phone: string;
  avatar_url: string | null;
  already_verified: boolean;
  target_type: string;
  full_name: string;
  category: string;
  links: string;
  comment: string;
  status: string;
  reviewer_note: string;
  created_at: number;
  reviewed_at: number | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  personal: "Частное лицо",
  business: "Компания",
  media: "СМИ",
  blogger: "Блогер",
  official: "Гос. организация",
};

export default function DevVerification({ can }: { can: (p: string) => boolean }) {
  const [items, setItems] = useState<VerifItem[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(0);
  const [note, setNote] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await devApi<{ items: VerifItem[] }>("verifications", { status: filter });
      setItems(res.items);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const decide = async (id: number, approve: boolean) => {
    setBusy(id);
    try {
      await devApi("verify_decide", { request_id: id, approve, note });
      setNote("");
      setOpenId(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось");
    } finally {
      setBusy(0);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            ["pending", "На проверке"],
            ["approved", "Одобренные"],
            ["rejected", "Отклонённые"],
            ["all", "Все"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition ${
              filter === k
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                : "bg-white/[0.04] border border-white/10 text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 transition"
        >
          <Icon name="RefreshCw" size={16} className="text-slate-400" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
            <Icon name="BadgeCheck" size={24} className="text-emerald-400" />
          </div>
          <p className="font-medium">Заявок нет</p>
          <p className="text-sm text-slate-500 mt-1">
            {filter === "pending" ? "Все заявки рассмотрены" : "В этой категории пусто"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((v) => (
            <div key={v.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                {v.avatar_url ? (
                  <img src={v.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-sm font-bold shrink-0">
                    {(v.user_name || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{v.full_name || v.user_name}</span>
                    {v.already_verified && (
                      <Icon name="BadgeCheck" size={15} className="text-sky-400 shrink-0" />
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        v.status === "pending"
                          ? "bg-amber-500/20 text-amber-400"
                          : v.status === "approved"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {v.status === "pending" ? "на проверке" : v.status === "approved" ? "одобрено" : "отклонено"}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 mt-1">
                    {v.user_name} · {v.phone} · ID {v.user_id}
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">
                      {CATEGORY_LABEL[v.category] || v.category || "Без категории"}
                    </span>
                    <span className="text-slate-600">{formatTs(v.created_at)}</span>
                  </div>

                  {v.links && (
                    <div className="mt-2 text-xs text-cyan-400 break-all">{v.links}</div>
                  )}
                  {v.comment && (
                    <p className="mt-2 text-xs text-slate-400 bg-white/[0.03] rounded-lg px-2.5 py-2">
                      {v.comment}
                    </p>
                  )}
                  {v.reviewer_note && v.status !== "pending" && (
                    <p className="mt-2 text-xs text-slate-500">
                      Решение: {v.reviewer_note}
                    </p>
                  )}

                  {v.status === "pending" && can("reports") && (
                    <div className="mt-3">
                      {openId === v.id ? (
                        <div className="space-y-2">
                          <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Комментарий к решению (необязательно)"
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-violet-500/50 placeholder-slate-600"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => decide(v.id, true)}
                              disabled={busy === v.id}
                              className="flex-1 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                              Выдать галочку
                            </button>
                            <button
                              onClick={() => decide(v.id, false)}
                              disabled={busy === v.id}
                              className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-medium hover:bg-red-500/25 disabled:opacity-50"
                            >
                              Отклонить
                            </button>
                            <button
                              onClick={() => { setOpenId(null); setNote(""); }}
                              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setOpenId(v.id)}
                          className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition"
                        >
                          Рассмотреть
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
