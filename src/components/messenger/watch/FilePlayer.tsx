import { forwardRef, useImperativeHandle, useRef } from "react";
import type { PlayerHandle } from "./watchTypes";

const FilePlayer = forwardRef<PlayerHandle, {
  src: string;
  onUserPlay: () => void;
  onUserPause: () => void;
  onUserSeek: () => void;
  onReady: () => void;
}>(function FilePlayer({ src, onUserPlay, onUserPause, onUserSeek, onReady }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const suppressRef = useRef(0);

  useImperativeHandle(ref, () => ({
    play: () => {
      suppressRef.current = Date.now() + 800;
      videoRef.current?.play().catch(() => { /* автозапуск запрещён — пользователь нажмёт сам */ });
    },
    pause: () => { suppressRef.current = Date.now() + 800; videoRef.current?.pause(); },
    seek: (sec) => { suppressRef.current = Date.now() + 800; if (videoRef.current) videoRef.current.currentTime = sec; },
    getTime: () => videoRef.current?.currentTime || 0,
    getDuration: () => videoRef.current?.duration || 0,
    isPaused: () => videoRef.current?.paused ?? true,
  }), []);

  const user = (fn: () => void) => () => { if (Date.now() >= suppressRef.current) fn(); };

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      playsInline
      preload="metadata"
      className="w-full h-full bg-black object-contain"
      onLoadedMetadata={onReady}
      onPlay={user(onUserPlay)}
      onPause={user(onUserPause)}
      onSeeked={user(onUserSeek)}
    />
  );
});

export default FilePlayer;
