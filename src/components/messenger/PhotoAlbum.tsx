import { useState } from "react";
import { MediaViewer } from "@/components/messenger/MediaViewer";

const MAX_TILES = 9;

function layout(n: number): { cols: number; spans: number[] } {
  if (n === 2) return { cols: 2, spans: [1, 1] };
  if (n === 3) return { cols: 2, spans: [2, 1, 1] };
  if (n === 4) return { cols: 2, spans: [1, 1, 1, 1] };
  if (n === 5) return { cols: 6, spans: [3, 3, 2, 2, 2] };
  if (n === 6) return { cols: 3, spans: [1, 1, 1, 1, 1, 1] };
  if (n === 7) return { cols: 6, spans: [3, 3, 2, 2, 2, 3, 3] };
  if (n === 8) return { cols: 6, spans: [3, 3, 2, 2, 2, 2, 2, 2] };
  return { cols: 3, spans: Array(n).fill(1) };
}

export default function PhotoAlbum({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [broken, setBroken] = useState<Set<number>>(new Set());
  const shown = urls.slice(0, MAX_TILES);
  const extra = urls.length - shown.length;
  const { cols, spans } = layout(shown.length);
  const tall = shown.length === 3;

  return (
    <>
      <div
        className="grid gap-0.5 w-[260px] max-w-full rounded-2xl overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {shown.map((url, i) => (
          <button
            key={url + i}
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(i); }}
            className={`relative bg-white/5 overflow-hidden ${tall && i === 0 ? "aspect-[2/1]" : "aspect-square"}`}
            style={{ gridColumn: `span ${spans[i] || 1} / span ${spans[i] || 1}` }}
            aria-label={`Фото ${i + 1} из ${urls.length}`}
          >
            {broken.has(i) ? (
              <span className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">Фото</span>
            ) : (
              <img
                src={url}
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover hover:opacity-95 transition"
                onError={() => setBroken((p) => new Set(p).add(i))}
              />
            )}
            {extra > 0 && i === shown.length - 1 && (
              <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-xl font-semibold">
                +{extra}
              </span>
            )}
          </button>
        ))}
      </div>
      {open !== null && (
        <MediaViewer
          items={urls.map((url) => ({ url, type: "image" as const }))}
          startIndex={open}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
