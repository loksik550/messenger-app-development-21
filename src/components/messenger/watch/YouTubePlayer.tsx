import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { PlayerHandle } from "./watchTypes";

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allow: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
}
type YTWindow = Window & { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  const w = window as YTWindow;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); if (w.YT) resolve(w.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

const YouTubePlayer = forwardRef<PlayerHandle, {
  videoId: string;
  onUserPlay: () => void;
  onUserPause: () => void;
  onReady: () => void;
}>(function YouTubePlayer({ videoId, onUserPlay, onUserPause, onReady }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const suppressRef = useRef(0);
  const cbRef = useRef({ onUserPlay, onUserPause, onReady });
  cbRef.current = { onUserPlay, onUserPause, onReady };

  useImperativeHandle(ref, () => ({
    play: () => { suppressRef.current = Date.now() + 1200; playerRef.current?.playVideo(); },
    pause: () => { suppressRef.current = Date.now() + 1200; playerRef.current?.pauseVideo(); },
    seek: (sec) => { suppressRef.current = Date.now() + 1200; playerRef.current?.seekTo(sec, true); },
    getTime: () => playerRef.current?.getCurrentTime?.() || 0,
    getDuration: () => playerRef.current?.getDuration?.() || 0,
    isPaused: () => (playerRef.current?.getPlayerState?.() ?? 2) !== 1,
  }), []);

  useEffect(() => {
    let cancelled = false;
    const mount = document.createElement("div");
    hostRef.current?.appendChild(mount);
    loadApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => cbRef.current.onReady(),
          onStateChange: (e: { data: number }) => {
            if (Date.now() < suppressRef.current) return;
            if (e.data === 1) cbRef.current.onUserPlay();
            else if (e.data === 2) cbRef.current.onUserPause();
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
      mount.remove();
    };
  }, [videoId]);

  return <div ref={hostRef} className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full" />;
});

export default YouTubePlayer;
