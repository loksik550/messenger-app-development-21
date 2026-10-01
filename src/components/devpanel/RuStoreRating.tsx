import Icon from "@/components/ui/icon";
import { plural, type Rating } from "./rustoreApi";

interface Props {
  rating: Rating | null | undefined;
  onOpenReviews?: () => void;
}

export default function RuStoreRating({ rating, onOpenReviews }: Props) {
  if (!rating) return null;

  if (rating.error) {
    return (
      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 text-sm text-slate-400 flex gap-2">
        <Icon name="Star" size={16} className="flex-shrink-0 mt-0.5 text-slate-500" />
        Рейтинг недоступен: {rating.error}
      </div>
    );
  }

  const total = rating.total || 0;
  const max = Math.max(1, ...Object.values(rating.stars));

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1 sm:w-36 flex-shrink-0">
          <div className="text-4xl font-bold text-white leading-none">
            {total ? rating.average.toFixed(1).replace(".", ",") : "—"}
          </div>
          <div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon
                  key={i}
                  name="Star"
                  size={14}
                  className={i <= Math.round(rating.average) && total ? "text-amber-400 fill-amber-400" : "text-slate-600"}
                />
              ))}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {total} {plural(total, "оценка", "оценки", "оценок")}
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-1.5">
          {(["5", "4", "3", "2", "1"] as const).map((s) => {
            const n = rating.stars[s] || 0;
            return (
              <div key={s} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-slate-400">{s}</span>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${(n / max) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-slate-500">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
        <span>Только оценка, без текста: {rating.no_comment}</span>
        {rating.without_reply > 0 ? (
          <span className="text-amber-300">Отзывов без ответа: {rating.without_reply}</span>
        ) : (
          <span>На все отзывы есть ответ</span>
        )}
        {onOpenReviews && (
          <button onClick={onOpenReviews} className="ml-auto flex items-center gap-1 text-sky-400 hover:text-sky-300">
            Открыть отзывы <Icon name="ArrowRight" size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
