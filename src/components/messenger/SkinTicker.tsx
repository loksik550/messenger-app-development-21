import { useActiveSkin } from "@/hooks/useSkinAccess";

/** Бегущая строка новостей под вкладками — показывается, если у включённой тестовой темы задан текст. */
export default function SkinTicker() {
  const skin = useActiveSkin();
  const text = skin?.ticker?.trim();
  if (!text) return null;
  return (
    <div className="skin-ticker relative overflow-hidden -mt-2 mb-3 py-1.5 border-b border-white/10" aria-label="Новости Nova">
      <div className="skin-ticker-track whitespace-nowrap text-[11px] font-semibold tracking-wide uppercase">
        <span className="px-4">{text}</span>
        <span className="px-4" aria-hidden>{text}</span>
      </div>
    </div>
  );
}
