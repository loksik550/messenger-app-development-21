import { profileBgStyle } from "@/lib/profileBg";

/** Фон верхней части профиля: готовый градиент или своё фото с затемнением книзу. */
export default function ProfileBackdrop({ bg }: { bg?: string | null }) {
  const style = profileBgStyle(bg);
  if (!style) return null;
  return (
    <div className="absolute inset-x-0 top-0 h-36 z-0 pointer-events-none overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={style} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent via-60% to-[hsl(var(--background))]" />
    </div>
  );
}
