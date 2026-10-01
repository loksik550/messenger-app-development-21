import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { Loading, ErrorBox } from "./DevDashboard";
import { rustoreCall, type Rating, type Review, type Reply } from "./rustoreApi";
import RuStoreRating from "./RuStoreRating";
import RuStoreReviewCard from "./RuStoreReviewCard";

type Filter = "all" | "no_reply" | "low" | "high";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "no_reply", label: "Без ответа" },
  { key: "low", label: "1–2 звезды" },
  { key: "high", label: "4–5 звёзд" },
];

interface Resp {
  items: Review[];
  page: number;
  has_more: boolean;
  rating?: Rating | null;
}

export default function DevRuStoreReviews() {
  const [items, setItems] = useState<Review[]>([]);
  const [rating, setRating] = useState<Rating | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    rustoreCall<Resp>("reviews", { page: 0, size: 50 })
      .then((d) => {
        setItems(d.items);
        setRating(d.rating || null);
        setPage(0);
        setHasMore(d.has_more);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const loadMore = async () => {
    setMore(true);
    try {
      const d = await rustoreCall<Resp>("reviews", { page: page + 1, size: 50 });
      setItems((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...d.items.filter((r) => !seen.has(r.id))];
      });
      setPage(page + 1);
      setHasMore(d.has_more);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setMore(false);
    }
  };

  const updateReply = (id: number, reply: Reply | null) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, reply } : r)));
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      if (filter === "no_reply" && r.reply) return false;
      if (filter === "low" && r.rating > 2) return false;
      if (filter === "high" && r.rating < 4) return false;
      if (q && !`${r.user} ${r.text}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filter, query]);

  const noReplyCount = items.filter((r) => !r.reply).length;

  if (loading && !items.length && !error) return <Loading />;
  if (error && !items.length) return <ErrorBox text={error} onRetry={load} />;

  return (
    <div className="space-y-5 max-w-3xl">
      <RuStoreRating rating={rating} />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl text-sm border transition ${
              filter === f.key ? "bg-sky-500/15 border-sky-500/40 text-sky-200" : "bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/5"
            }`}
          >
            {f.label}
            {f.key === "no_reply" && noReplyCount > 0 && (
              <span className="ml-1.5 px-1.5 rounded-full bg-amber-500/20 text-amber-300 text-xs">{noReplyCount}</span>
            )}
          </button>
        ))}
        <div className="relative flex-1 min-w-[160px]">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по тексту или имени"
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/30 border border-white/10 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-500/50"
          />
        </div>
        <button onClick={load} className="p-2 rounded-xl hover:bg-white/5 text-slate-400" title="Обновить">
          <Icon name="RefreshCw" size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && items.length > 0 && <div className="text-sm text-red-300">{error}</div>}

      {items.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-10 text-center">
          <Icon name="MessageSquareText" size={28} className="mx-auto text-slate-600 mb-2" />
          <div className="text-sm text-slate-300">Отзывов в RuStore пока нет</div>
          <div className="text-xs text-slate-500 mt-1">Они появятся здесь, как только пользователи начнут их оставлять.</div>
        </div>
      ) : shown.length === 0 ? (
        <div className="text-sm text-slate-500 text-center py-8">Ничего не найдено по этому фильтру</div>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <RuStoreReviewCard key={r.id} review={r} onReplyChange={(reply) => updateReply(r.id, reply)} />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={more}
          className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
        >
          {more ? "Загружаю…" : "Показать ещё"}
        </button>
      )}
    </div>
  );
}
