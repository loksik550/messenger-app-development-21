import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { api, avatarGrad, getCallAvatar, type User } from "@/lib/api";
import { startRingtone, stopRingtone, startDialTone, stopDialTone, playHangupSound, unlockAudioContext } from "@/lib/sounds";

type CallState = "calling" | "ringing" | "connected" | "ended";

interface CallScreenProps {
  currentUser: User;
  remoteUserId: number;
  remoteName: string;
  callId: string;
  isIncoming: boolean;
  onClose: () => void;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  // TURN-серверы (ретрансляция) нужны, когда оба собеседника за NAT — например
  // оба в мобильном интернете. Без них голос не проходит и собеседника не слышно.
  // Держим несколько публичных релеев для надёжности (как в мессенджерах).
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: [
      "turn:relay1.expressturn.com:3478",
      "turn:relay1.expressturn.com:3478?transport=tcp",
    ],
    username: "ef2X8ODBQZ8PXHNXQL",
    credential: "ymS3tZmVQ0kR6Xt3",
  },
];

export function CallScreen({ currentUser, remoteUserId, remoteName, callId, isIncoming, onClose }: CallScreenProps) {
  const isVideo = callId.startsWith("video_");
  const [state, setState] = useState<CallState>(isIncoming ? "ringing" : "calling");
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [netPoor, setNetPoor] = useState(false);
  const [duration, setDuration] = useState(0);
  // Своя картинка на звонок для этого контакта (хранится локально, видна только мне)
  const callAvatar = getCallAvatar(remoteUserId);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sinceRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const endedRef = useRef(false);
  const processedRef = useRef<Set<number>>(new Set()); // id уже обработанных сигналов
  const restartingRef = useRef(false);
  const [mediaError, setMediaError] = useState<string>("");

  const cleanup = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { pcRef.current?.close(); } catch { /* ignore */ }
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    stopRingtone();
    stopDialTone();
  };

  const endCall = (reason: "hangup" | "remote_hangup") => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (reason === "hangup") sendSignal("hangup").catch(() => { /* ignore */ });
    playHangupSound();
    setState("ended");
    setTimeout(() => { cleanup(); onClose(); }, 800);
  };

  const sendSignal = async (type: string, payload?: unknown) => {
    try {
      await api("call_signal", { call_id: callId, to_user_id: remoteUserId, type, payload }, currentUser.id);
    } catch { /* ignore network */ }
  };

  const startTimer = () => {
    stopRingtone();
    stopDialTone();
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const attachRemoteStream = (stream: MediaStream) => {
    remoteStreamRef.current = stream;
    if (isVideo && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.volume = 1.0;
      remoteVideoRef.current.play().catch(() => { /* autoplay-блокировка — разблокируется по тапу */ });
      // На видеозвонке audio-элемент — резерв, держим без звука чтобы не дублировать
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.muted = true;
      }
    } else if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.play().catch(() => { /* autoplay-блокировка — разблокируется по тапу */ });
    }
  };

  const flushPendingCandidates = async (pc: RTCPeerConnection) => {
    const queue = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const c of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
  };

  const initPC = async (): Promise<RTCPeerConnection | null> => {
    let stream: MediaStream;
    try {
      const constraints: MediaStreamConstraints = isVideo
        ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      const err = e as DOMException;
      const msg = err.name === "NotAllowedError"
        ? "Доступ к микрофону/камере запрещён. Разреши в настройках браузера."
        : err.name === "NotFoundError"
          ? "Микрофон/камера не найдены"
          : `Не удалось получить доступ: ${err.message || err.name}`;
      setMediaError(msg);
      return null;
    }
    localStreamRef.current = stream;

    if (isVideo && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(() => { /* ignore */ });
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 4,
    });
    pcRef.current = pc;

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal("candidate", e.candidate.toJSON());
    };

    pc.ontrack = (e) => {
      // Поток собеседника пошёл — рингтон/гудки больше не нужны
      stopRingtone();
      stopDialTone();
      const incoming = e.streams[0] || new MediaStream([e.track]);
      attachRemoteStream(incoming);
    };

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === "connected" || s === "completed") {
        restartingRef.current = false;
        setNetPoor(false);
        setState("connected");
        startTimer();
        if (remoteStreamRef.current) attachRemoteStream(remoteStreamRef.current);
      } else if (s === "disconnected") {
        // Временный обрыв — показываем «слабое соединение», но не завершаем звонок
        setNetPoor(true);
      } else if (s === "failed") {
        // Пытаемся восстановить связь через ICE-restart (только инициатор звонка)
        setNetPoor(true);
        if (!isIncoming && !restartingRef.current) {
          restartingRef.current = true;
          restartIce(pc);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      const cs = pc.connectionState;
      if (cs === "connected") {
        restartingRef.current = false;
        setNetPoor(false);
        setState("connected");
        startTimer();
        if (remoteStreamRef.current) attachRemoteStream(remoteStreamRef.current);
      } else if (cs === "failed" && !isIncoming && !restartingRef.current) {
        restartingRef.current = true;
        restartIce(pc);
      }
    };

    return pc;
  };

  // Переустановка ICE-соединения при обрыве (как переподключение в Telegram).
  const restartIce = async (pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      await sendSignal("offer", { sdp: offer.sdp, type: offer.type });
    } catch { restartingRef.current = false; }
  };

  const handleSignal = async (pc: RTCPeerConnection, sig: { id?: number; type: string; payload: unknown; created_at: number }) => {
    if (sig.type === "offer") {
      // Дедуп по id (в pollOnce) уже гарантирует, что один и тот же offer
      // не применится дважды. Новый offer (напр. ICE-restart) имеет другой id
      // и будет обработан. Применяем только когда соединение в stable.
      if (pc.signalingState !== "stable") return;
      await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
      remoteDescSetRef.current = true;
      await flushPendingCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal("answer", { sdp: answer.sdp, type: answer.type });
      stopRingtone();
      stopDialTone();
    } else if (sig.type === "answer") {
      // Применяем answer только если ждём его (иначе SDP-состояние сломается)
      if (pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
      remoteDescSetRef.current = true;
      await flushPendingCandidates(pc);
      stopRingtone();
      stopDialTone();
    } else if (sig.type === "candidate") {
      const cand = sig.payload as RTCIceCandidateInit;
      if (!remoteDescSetRef.current) {
        pendingCandidatesRef.current.push(cand);
      } else {
        try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* ignore */ }
      }
    } else if (sig.type === "hangup" || sig.type === "decline" || sig.type === "end" || sig.type === "cancel") {
      endCall("remote_hangup");
    }
  };

  const pollOnce = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      const data = await api("get_call_signals", { call_id: callId, since_id: sinceRef.current }, currentUser.id);
      if (!data.signals) return;
      for (const sig of data.signals) {
        const sid = sig.id || 0;
        sinceRef.current = Math.max(sinceRef.current, sid);
        // Дедуп: каждый сигнал обрабатываем ровно один раз
        if (sid && processedRef.current.has(sid)) continue;
        if (sid) processedRef.current.add(sid);
        await handleSignal(pc, sig);
      }
    } catch { /* network ignore */ }
  };

  const pollSignals = () => {
    if (pollRef.current) return;
    // Первый опрос — сразу и с id=0, чтобы гарантированно поймать все сигналы
    // звонка (offer/candidate), даже если приняли не сразу.
    sinceRef.current = 0;
    pollOnce();
    pollRef.current = setInterval(pollOnce, 1000);
  };

  const startCall = async () => {
    const pc = await initPC();
    if (!pc) return;
    pollSignals(); // запускаем polling ДО отправки offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal("offer", { sdp: offer.sdp, type: offer.type });
  };

  const acceptCall = async () => {
    // Сразу глушим рингтон/гудки — иначе они забивают голос собеседника
    stopRingtone();
    stopDialTone();
    setState("calling");
    const pc = await initPC();
    if (!pc) return;
    pollSignals();
    // Жест пользователя — самое время разблокировать audio.play()
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = 1.0;
        await remoteAudioRef.current.play();
      } catch { /* ignore */ }
    }
    if (remoteVideoRef.current) {
      try { remoteVideoRef.current.muted = false; await remoteVideoRef.current.play(); } catch { /* ignore */ }
    }
  };

  useEffect(() => {
    // Разблокируем AudioContext, иначе на мобильных гудки/рингтон не играют
    unlockAudioContext();
    if (isIncoming) {
      startRingtone();
    } else {
      startDialTone();
      startCall();
    }
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Виброзвонок при входящем звонке — повторяется, пока идёт "ringing".
  useEffect(() => {
    if (state !== "ringing") return;
    const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;
    if (canVibrate) navigator.vibrate([600, 400, 600, 400]);
    const iv = setInterval(() => {
      if (canVibrate) navigator.vibrate([600, 400, 600, 400]);
    }, 2000);
    return () => {
      clearInterval(iv);
      if (canVibrate) navigator.vibrate(0);
    };
  }, [state]);

  // Когда звонок соединился — настойчиво пытаемся воспроизвести звук собеседника.
  // На Android/мобильных play() часто требует повтора после прихода потока.
  useEffect(() => {
    if (state !== "connected") return;
    let tries = 0;
    const tryPlay = () => {
      const el = isVideo ? remoteVideoRef.current : remoteAudioRef.current;
      if (el && el.srcObject) {
        if (!isVideo) { el.muted = false; el.volume = 1.0; }
        el.play().catch(() => { /* ждём следующего тика/жеста */ });
      }
      tries += 1;
      if (tries >= 6) clearInterval(iv);
    };
    tryPlay();
    const iv = setInterval(tryPlay, 700);
    return () => clearInterval(iv);
  }, [state, isVideo]);

  const hangup = () => endCall("hangup");
  const reject = () => endCall("hangup");

  const fmtDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const stateLabel = state === "connected" && netPoor
    ? "Слабое соединение…"
    : {
        calling: "Соединение…",
        ringing: "Входящий звонок",
        connected: fmtDuration(duration),
        ended: "Звонок завершён",
      }[state];

  const unlockAudio = async () => {
    unlockAudioContext();
    if (remoteAudioRef.current) {
      try { remoteAudioRef.current.muted = false; await remoteAudioRef.current.play(); } catch { /* ignore */ }
    }
    if (remoteVideoRef.current) {
      try { remoteVideoRef.current.muted = false; await remoteVideoRef.current.play(); } catch { /* ignore */ }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center bg-background px-8 animate-fade-in"
      style={{ paddingTop: "calc(3rem + env(safe-area-inset-top))", paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
      onPointerDown={unlockAudio}
    >
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {mediaError && (
        <div className="absolute top-4 left-4 right-4 z-20 px-4 py-3 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-200 text-sm flex items-center gap-2">
          <Icon name="AlertCircle" size={16} />
          <span className="flex-1">{mediaError}</span>
        </div>
      )}

      {/* Video views */}
      {isVideo && (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ opacity: state === "connected" ? 1 : 0 }}
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-32 right-4 w-28 h-40 object-cover rounded-2xl border-2 border-white/20 z-10 pointer-events-none"
            style={{ display: !videoOff ? "block" : "none" }}
          />
        </>
      )}

      {/* Top info — по центру свободного пространства */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 relative z-10">
        {(!isVideo || state !== "connected") && (
          <div className="relative">
            {state === "ringing" && (
              <>
                <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                <span className="absolute -inset-3 rounded-full border-2 border-emerald-400/40 animate-pulse" />
              </>
            )}
            {callAvatar ? (
              <img
                src={callAvatar}
                alt={remoteName}
                className="relative w-32 h-32 rounded-full object-cover animate-pulse-glow border-2 border-white/20"
              />
            ) : (
              <div className={`relative w-32 h-32 rounded-full flex items-center justify-center text-6xl font-bold text-white animate-pulse-glow bg-gradient-to-br ${avatarGrad(remoteUserId)}`}>
                {remoteName[0]?.toUpperCase()}
              </div>
            )}
          </div>
        )}
        <h2 className="text-2xl font-bold text-white drop-shadow">{remoteName}</h2>
        <p className={`font-medium ${state === "connected" && netPoor ? "text-amber-400 text-sm" : state === "connected" ? "text-emerald-400 text-sm" : state === "ringing" ? "text-emerald-400 text-base animate-pulse" : "text-muted-foreground text-sm"}`}>
          {stateLabel}
        </p>
        {isVideo && <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-xs text-white/70"><Icon name="Video" size={12} />Видеозвонок</div>}

        {/* Waveform (audio only, в соединении) */}
        {state === "connected" && !isVideo && (
          <div className="flex items-end gap-1 h-10 mt-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 bg-violet-500/60 rounded-full animate-pulse"
                style={{ height: `${8 + Math.random() * 24}px`, animationDelay: `${i * 0.07}s` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Controls — всегда внизу */}
      <div className="w-full relative z-20 flex-shrink-0">
        {state === "ringing" ? (
          <div className="flex items-center justify-center gap-16">
            <div className="flex flex-col items-center gap-2.5">
              <button
                onClick={reject}
                className="w-[72px] h-[72px] bg-red-500 rounded-full flex items-center justify-center shadow-xl shadow-red-500/40 hover:bg-red-600 active:scale-95 transition-all"
              >
                <Icon name="PhoneOff" size={30} className="text-white" />
              </button>
              <span className="text-sm font-medium text-white/80">Отклонить</span>
            </div>
            <div className="flex flex-col items-center gap-2.5">
              <button
                onClick={acceptCall}
                className="w-[72px] h-[72px] bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/40 hover:bg-emerald-600 active:scale-95 transition-all animate-call-shake"
              >
                <Icon name="Phone" size={30} className="text-white" />
              </button>
              <span className="text-sm font-medium text-white/80">Принять</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  setMuted(m => {
                    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = m; });
                    return !m;
                  });
                }}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${muted ? "bg-red-500/20 text-red-400" : "glass text-foreground"}`}
              >
                <Icon name={muted ? "MicOff" : "Mic"} size={22} />
              </button>
              <span className="text-xs text-muted-foreground">{muted ? "Включить" : "Выкл. микро"}</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={hangup}
                className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors"
              >
                <Icon name="PhoneOff" size={26} className="text-white" />
              </button>
              <span className="text-xs text-muted-foreground">Завершить</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  setSpeaker(s => {
                    const next = !s;
                    if (remoteAudioRef.current) remoteAudioRef.current.muted = !next;
                    if (remoteVideoRef.current) remoteVideoRef.current.muted = !next;
                    return next;
                  });
                }}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${speaker ? "grad-primary text-white" : "glass text-muted-foreground"}`}
              >
                <Icon name={speaker ? "Volume2" : "VolumeX"} size={22} />
              </button>
              <span className="text-xs text-muted-foreground">{speaker ? "Звук вкл." : "Звук выкл."}</span>
            </div>

            {isVideo && (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => {
                    setVideoOff(v => {
                      localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = v; });
                      return !v;
                    });
                  }}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${videoOff ? "bg-red-500/20 text-red-400" : "glass text-foreground"}`}
                >
                  <Icon name={videoOff ? "VideoOff" : "Video"} size={22} />
                </button>
                <span className="text-xs text-muted-foreground">Камера</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}