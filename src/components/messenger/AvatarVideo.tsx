import { useState } from "react";

/** Видео-аватар без мигания старого фото: пока видео грузится — показываем его первый кадр, потом плавно включаем. */
export default function AvatarVideo({ src, className = "" }: { src: string; className?: string }) {
  const [ready, setReady] = useState(false);
  const url = src.includes("#") ? src : `${src}#t=0.001`;
  return (
    <video
      key={src}
      src={url}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      onLoadedData={() => setReady(true)}
      className={`w-full h-full object-cover pointer-events-none transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}
