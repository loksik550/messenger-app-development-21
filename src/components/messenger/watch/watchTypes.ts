export interface WatchState {
  source: "youtube" | "file";
  url: string;
  title: string;
  started_by: number;
  playing: boolean;
  position: number;
  updated_ms: number;
  updated_by: number;
  version: number;
  now_ms: number;
}

export const WATCH_EMOJI = ["❤️", "🔥", "😂", "😮", "👏", "😢"] as const;

export function expectedPosition(st: WatchState, clockOffsetMs: number): number {
  if (!st.playing) return st.position;
  const serverNow = Date.now() + clockOffsetMs;
  return st.position + Math.max(0, serverNow - st.updated_ms) / 1000;
}

export interface PlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (sec: number) => void;
  getTime: () => number;
  getDuration: () => number;
  isPaused: () => boolean;
}
