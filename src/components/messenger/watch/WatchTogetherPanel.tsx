import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";
import YouTubePlayer from "./YouTubePlayer";
import FilePlayer from "./FilePlayer";
import { WATCH_EMOJI, expectedPosition, type PlayerHandle, type WatchState } from "./watchTypes";

interface Floater { id: number; emoji: string; left: number }

export default function WatchTogetherPanel({
  chatId, userId, partnerName, initial, onEnded,
}: {
  chatId: number;
  userId: number;
  partnerName: string;
  initial: WatchState;
  onEnded: () => void;
}) {
  const playerRef = useRef<PlayerHandle>(null);
  const stateRef = useRef<WatchState>(initial);
  const offsetRef = useRef(initial.now_ms - Date.now());
  const appliedVersionRef = useRef(0);
  const readyRef = useRef(false);
  const lastReactionRef = useRef(0);
  const floaterSeq = useRef(0);
  const [title, setTitle] = useState(initial.title);
  const [source, setSource] = useState(initial.source);
  const [url, setUrl] = useState(initial.url);
  const [statusText, setStatusText] = useState("");
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const spawn = useCallback((emoji: string) => {
    const id = ++floaterSeq.current;
    setFloaters((f) => [...f.slice(-14), { id, emoji, left: 10 + Math.random() * 70 }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 2600);
  }, []);

  const apply = useCallback((st: WatchState, force = false) => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    const target = expectedPosition(st, offsetRef.current);
    const drift = Math.abs(p.getTime() - target);
    const fresh = st.version !== appliedVersionRef.current;
    if (force || fresh || drift > 2) {
      if (drift > 1.2) p.seek(target);
      if (st.playing && p.isPaused()) p.play();
      if (!st.playing && !p.isPaused()) p.pause();
      appliedVersionRef.current = st.version;
      if (fresh && st.updated_by !== userId && !force) {
        setStatusText(st.playing ? `${partnerName} включил(а) видео` : `${partnerName} поставил(а) на паузу`);
        setTimeout(() => setStatusText(""), 2200);
      }
    }
  }, [partnerName, userId]);

  const receive = useCallback((st: WatchState | null) => {
    if (!st) { onEnded(); return; }
    offsetRef.current = st.now_ms - Date.now();
    if (st.url !== stateRef.current.url) {
      readyRef.current = false;
      appliedVersionRef.current = 0;
      setUrl(st.url); setSource(st.source); setTitle(st.title);
    }
    stateRef.current = st;
    apply(st);
  }, [apply, onEnded]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") {
        const r = await api("watch_poll", { chat_id: chatId, after_reaction: lastReactionRef.current }, userId).catch(() => null);
        if (!stop && r && !r.error) {
          if (lastReactionRef.current > 0 && Array.isArray(r.reactions)) {
            (r.reactions as { emoji: string }[]).forEach((x, i) => setTimeout(() => spawn(x.emoji), i * 150));
          }
          lastReactionRef.current = Number(r.last_reaction) || lastReactionRef.current || 1;
          receive(r.watch as WatchState | null);
        }
      }
      timer = setTimeout(tick, 2000);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [chatId, userId, receive, spawn]);

  const send = useCallback(async (playing: boolean) => {
    const p = playerRef.current;
    if (!p) return;
    const position = p.getTime();
    const local: WatchState = {
      ...stateRef.current, playing, position,
      updated_ms: Date.now() + offsetRef.current, updated_by: userId,
      version: stateRef.current.version + 1,
    };
    stateRef.current = local;
    appliedVersionRef.current = local.version;
    const r = await api("watch_control", { chat_id: chatId, playing, position }, userId).catch(() => null);
    if (r?.watch) {
      offsetRef.current = r.watch.now_ms - Date.now();
      stateRef.current = r.watch;
      appliedVersionRef.current = r.watch.version;
    }
  }, [chatId, userId]);

  const onReady = useCallback(() => {
    readyRef.current = true;
    apply(stateRef.current, true);
  }, [apply]);

  const react = (emoji: string) => {
    spawn(emoji);
    api("watch_react", { chat_id: chatId, emoji }, userId).catch(() => null);
  };

  const stop = async () => {
    if (!confirm("Закончить совместный просмотр для вас обоих?")) return;
    await api("watch_stop", { chat_id: chatId }, userId).catch(() => null);
    onEnded();
  };

  return (
    <div className="relative border-b border-white/5 bg-black/40">
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon name="MonitorPlay" size={16} className="text-violet-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground leading-none mb-0.5">Смотрите вместе</div>
          <div className="text-sm font-medium truncate">{title}</div>
        </div>
        <button onClick={() => setCollapsed((v) => !v)} className="p-2 rounded-xl hover:bg-white/8" aria-label="Свернуть">
          <Icon name={collapsed ? "ChevronDown" : "ChevronUp"} size={16} />
        </button>
        <button onClick={stop} className="p-2 rounded-xl hover:bg-red-500/15 text-red-400" aria-label="Закончить">
          <Icon name="X" size={16} />
        </button>
      </div>

      <div className={collapsed ? "h-0 overflow-hidden" : ""}>
        <div className="relative w-full aspect-video max-h-[42vh] bg-black mx-auto">
          {source === "youtube" ? (
            <YouTubePlayer
              key={url}
              ref={playerRef}
              videoId={url}
              onReady={onReady}
              onUserPlay={() => send(true)}
              onUserPause={() => send(false)}
            />
          ) : (
            <FilePlayer
              key={url}
              ref={playerRef}
              src={url}
              onReady={onReady}
              onUserPlay={() => send(true)}
              onUserPause={() => send(false)}
              onUserSeek={() => send(!(playerRef.current?.isPaused() ?? true))}
            />
          )}

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {floaters.map((f) => (
              <span key={f.id} className="watch-float absolute bottom-2 text-3xl" style={{ left: `${f.left}%` }}>{f.emoji}</span>
            ))}
          </div>

          {statusText && (
            <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 text-white text-xs animate-fade-in">
              {statusText}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 px-3 py-2">
          {WATCH_EMOJI.map((e) => (
            <button key={e} onClick={() => react(e)} className="w-10 h-10 rounded-full glass text-xl active:scale-90 transition-transform">
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
