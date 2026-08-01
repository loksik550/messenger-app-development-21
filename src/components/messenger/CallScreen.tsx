import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { api, avatarGrad, getCallAvatar, getIceServers, type User } from "@/lib/api";
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

export function CallScreen({ currentUser, remoteUserId, remoteName, callId, isIncoming, onClose }: CallScreenProps) {
  const isVideo = callId.startsWith("video_");
  const [state, setState] = useState<CallState>(isIncoming ? "ringing" : "calling");
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [netPoor, setNetPoor] = useState(false);
  const [duration, setDuration] = useState(0);
  const [mediaError, setMediaError] = useState<string>("");
  const callAvatar = getCallAvatar(remoteUserId);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sinceRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const endedRef = useRef(false);
  const startedRef = useRef(false);
  const processedRef = useRef<Set<number>>(new Set());
  const restartingRef = useRef(false);
  const iceServersRef = useRef<RTCIceServer[] | null>(null);
  const audioWatchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAudioBytesRef = useRef(0);
  const audioStallRef = useRef(0);

  // ── Завершение / очистка ──────────────────────────────────────────────────
  const cleanup = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (audioWatchRef.current) { clearInterval(audioWatchRef.current); audioWatchRef.current = null; }
    try { pcRef.current?.close(); } catch { /* ignore */ }
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    stopRingtone();
    stopDialTone();
  };

  const sendSignal = async (type: string, payload?: unknown) => {
    try {
      await api("call_signal", { call_id: callId, to_user_id: remoteUserId, type, payload }, currentUser.id);
    } catch { /* network ignore */ }
  };

  // Диагностика: пишем технические события звонка в БД (type='diag'),
  // чтобы разобрать причину проблем со звуком. Собеседник эти сигналы игнорирует.
  const logDiag = (event: string, extra?: Record<string, unknown>) => {
    try {
      api("call_signal", {
        call_id: callId,
        to_user_id: remoteUserId,
        type: "diag",
        payload: { event, role: isIncoming ? "callee" : "caller", video: isVideo, ...extra },
      }, currentUser.id).catch(() => { /* ignore */ });
    } catch { /* ignore */ }
  };

  const endCall = (reason: "hangup" | "remote_hangup") => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (reason === "hangup") sendSignal("hangup").catch(() => { /* ignore */ });
    playHangupSound();
    setState("ended");
    setTimeout(() => { cleanup(); onClose(); }, 700);
  };

  const startTimer = () => {
    stopRingtone();
    stopDialTone();
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  // Привязка входящего медиапотока к элементам и настойчивое воспроизведение.
  const bindRemoteMedia = () => {
    const stream = remoteStreamRef.current;
    if (isVideo && remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject !== stream) remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.muted = !speaker;
      remoteVideoRef.current.play().catch(() => { /* разблокируется по тапу */ });
    }
    if (remoteAudioRef.current) {
      if (remoteAudioRef.current.srcObject !== stream) remoteAudioRef.current.srcObject = stream;
      // На видео звук идёт через video-элемент, аудио-элемент — резерв (без дубля)
      remoteAudioRef.current.muted = isVideo ? true : !speaker;
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.play().catch(() => { /* разблокируется по тапу */ });
    }
  };

  const flushPendingCandidates = async (pc: RTCPeerConnection) => {
    const queue = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const c of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
  };

  // ── Создание PeerConnection ───────────────────────────────────────────────
  const createPC = async (): Promise<RTCPeerConnection | null> => {
    let stream: MediaStream;
    try {
      const constraints: MediaStreamConstraints = isVideo
        ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      logDiag("mic_ok", { tracks: stream.getAudioTracks().map(t => `${t.kind}:${t.readyState}:${t.enabled}`) });
    } catch (e) {
      const err = e as DOMException;
      logDiag("mic_fail", { name: (e as DOMException).name });
      setMediaError(
        err.name === "NotAllowedError" ? "Доступ к микрофону/камере запрещён. Разреши в настройках."
        : err.name === "NotFoundError" ? "Микрофон/камера не найдены"
        : `Не удалось получить доступ: ${err.message || err.name}`
      );
      return null;
    }
    localStreamRef.current = stream;
    if (isVideo && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(() => { /* ignore */ });
    }

    const iceServers = iceServersRef.current || await getIceServers();
    const turnCount = iceServers.filter(s => {
      const u = Array.isArray(s.urls) ? s.urls.join(",") : String(s.urls);
      return u.includes("turn:") || u.includes("turns:");
    }).length;
    logDiag("ice_servers", { total: iceServers.length, turn: turnCount });
    // Обычный режим ICE (STUN + TURN как запас). Именно так работало изначально.
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    // Добавляем локальные треки. Этого достаточно для двустороннего аудио —
    // отдельный addTransceiver создавал бы лишнюю дорожку и ломал SDP.
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal("candidate", e.candidate.toJSON());
    };

    pc.ontrack = (e) => {
      // Берём поток собеседника как есть (как в рабочей версии) — надёжнее для
      // воспроизведения, чем ручная сборка дорожек.
      const incoming = e.streams[0] || new MediaStream([e.track]);
      remoteStreamRef.current = incoming;
      logDiag("ontrack", { kind: e.track.kind, tracks: incoming.getTracks().map(t => t.kind) });
      stopRingtone();
      stopDialTone();
      bindRemoteMedia();
      setNetPoor(false);
      setState("connected");
      startTimer();
      startAudioWatch(pc);
    };

    const onConn = () => {
      const ice = pc.iceConnectionState;
      const conn = pc.connectionState;
      logDiag("ice_state", { ice, conn });
      if (ice === "connected" || ice === "completed" || conn === "connected") {
        restartingRef.current = false;
        setNetPoor(false);
        bindRemoteMedia();
        logSelectedPair(pc);
        if (remoteStreamRef.current.getTracks().length) {
          setState("connected");
          startTimer();
        }
      } else if (ice === "disconnected") {
        // Временный обрыв — не завершаем звонок, ждём восстановления
        setNetPoor(true);
      } else if (ice === "failed" || conn === "failed") {
        setNetPoor(true);
        // Полный обрыв — пробуем переподключиться (только звонящий)
        if (!isIncoming && !restartingRef.current) {
          restartingRef.current = true;
          restartIce(pc);
        }
      }
    };
    pc.oniceconnectionstatechange = onConn;
    pc.onconnectionstatechange = onConn;

    return pc;
  };

  // Определяем, через какой путь идёт звонок: relay (TURN-ретранслятор),
  // srflx/prflx (через NAT), host (прямой). Это ключ к диагнозу "не слышно".
  const logSelectedPair = async (pc: RTCPeerConnection) => {
    try {
      const stats = await pc.getStats();
      const cands: Record<string, { type?: string; protocol?: string; address?: string }> = {};
      let localId = "", remoteId = "";
      stats.forEach((r) => {
        if (r.type === "local-candidate" || r.type === "remote-candidate") {
          cands[r.id] = { type: (r as { candidateType?: string }).candidateType, protocol: (r as { protocol?: string }).protocol };
        }
        if (r.type === "candidate-pair" && (r as { nominated?: boolean; selected?: boolean; state?: string }).state === "succeeded" && ((r as { nominated?: boolean }).nominated || (r as { selected?: boolean }).selected)) {
          localId = (r as { localCandidateId?: string }).localCandidateId || "";
          remoteId = (r as { remoteCandidateId?: string }).remoteCandidateId || "";
        }
      });
      logDiag("selected_pair", {
        local: cands[localId]?.type + "/" + cands[localId]?.protocol,
        remote: cands[remoteId]?.type + "/" + cands[remoteId]?.protocol,
      });
    } catch { /* ignore */ }
  };

  // Сторож звука: соединение может стать "connected", но медиа не течёт
  // (прямой путь между разными операторами "молчит"). Тогда пересобираем
  // ICE-рестартом — WebRTC переберёт пары и пойдёт через TURN-ретранслятор.
  const startAudioWatch = (pc: RTCPeerConnection) => {
    if (audioWatchRef.current) return;
    lastAudioBytesRef.current = 0;
    audioStallRef.current = 0;
    audioWatchRef.current = setInterval(async () => {
      if (!pcRef.current || endedRef.current) return;
      try {
        const stats = await pc.getStats();
        let bytes = 0, sent = 0;
        stats.forEach((r) => {
          if (r.type === "inbound-rtp" && (r as { kind?: string }).kind === "audio") {
            bytes = (r as { bytesReceived?: number }).bytesReceived || 0;
          }
          if (r.type === "outbound-rtp" && (r as { kind?: string }).kind === "audio") {
            sent = (r as { bytesSent?: number }).bytesSent || 0;
          }
        });
        logDiag("audio_stats", { recv: bytes, sent });
        if (bytes > lastAudioBytesRef.current) {
          lastAudioBytesRef.current = bytes;
          audioStallRef.current = 0;
        } else {
          audioStallRef.current += 1;
          // 3 проверки подряд без нового звука (~9 сек) — пересобираем связь
          if (audioStallRef.current >= 3 && !isIncoming && !restartingRef.current) {
            restartingRef.current = true;
            audioStallRef.current = 0;
            setNetPoor(true);
            logDiag("audio_stall_restart", { recv: bytes, sent });
            restartIce(pc);
          }
        }
      } catch { /* ignore */ }
    }, 3000);
  };

  const restartIce = async (pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      await sendSignal("offer", { sdp: offer.sdp, type: offer.type });
    } catch { restartingRef.current = false; }
  };

  // ── Обработка входящих сигналов ───────────────────────────────────────────
  const handleSignal = async (pc: RTCPeerConnection, sig: { id?: number; type: string; payload: unknown }) => {
    try {
      if (sig.type === "offer") {
        // Применяем offer только из stable (обычный offer или ICE-restart).
        if (pc.signalingState !== "stable") { console.log("[call] offer skipped, state=" + pc.signalingState); return; }
        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
        remoteDescSetRef.current = true;
        await flushPendingCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal("answer", { sdp: answer.sdp, type: answer.type });
        console.log("[call] offer applied, answer sent");
        stopRingtone(); stopDialTone();
      } else if (sig.type === "answer") {
        if (pc.signalingState !== "have-local-offer") { console.log("[call] answer skipped, state=" + pc.signalingState); return; }
        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
        remoteDescSetRef.current = true;
        await flushPendingCandidates(pc);
        console.log("[call] answer applied");
        stopRingtone(); stopDialTone();
      } else if (sig.type === "candidate") {
        const cand = sig.payload as RTCIceCandidateInit;
        if (!remoteDescSetRef.current) pendingCandidatesRef.current.push(cand);
        else { try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (err) { console.log("[call] addIceCandidate err:", err); } }
      } else if (["hangup", "decline", "end", "cancel"].includes(sig.type)) {
        endCall("remote_hangup");
      }
    } catch (err) { console.log("[call] handleSignal ERROR on " + sig.type + ":", err); }
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
        if (sid && processedRef.current.has(sid)) continue;
        if (sid) processedRef.current.add(sid);
        await handleSignal(pc, sig);
      }
    } catch { /* network ignore */ }
  };

  const startPolling = () => {
    if (pollRef.current) return;
    sinceRef.current = 0;
    pollOnce();
    pollRef.current = setInterval(pollOnce, 1000);
  };

  // Звонящий: создаёт PC, шлёт offer
  const startOutgoing = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    const pc = await createPC();
    if (!pc) return;
    startPolling();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal("offer", { sdp: offer.sdp, type: offer.type });
  };

  // Принимающий: создаёт PC, ждёт offer (polling сам обработает и ответит)
  const acceptCall = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    stopRingtone(); stopDialTone();
    setState("calling");
    const pc = await createPC();
    if (!pc) return;
    startPolling();
    // Жест пользователя — разблокируем воспроизведение
    unlockAudioContext();
    bindRemoteMedia();
  };

  // ── Запуск при монтировании ───────────────────────────────────────────────
  useEffect(() => {
    unlockAudioContext();
    getIceServers().then(s => { iceServersRef.current = s; }).catch(() => { /* fallback */ });
    if (isIncoming) {
      startRingtone();
    } else {
      startDialTone();
      // Дожидаемся ICE-серверов, затем стартуем исходящий звонок
      getIceServers()
        .then(s => { iceServersRef.current = s; startOutgoing(); })
        .catch(() => startOutgoing());
    }
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Виброзвонок при входящем
  useEffect(() => {
    if (state !== "ringing") return;
    const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;
    if (canVibrate) navigator.vibrate([600, 400, 600, 400]);
    const iv = setInterval(() => { if (canVibrate) navigator.vibrate([600, 400, 600, 400]); }, 2000);
    return () => { clearInterval(iv); if (canVibrate) navigator.vibrate(0); };
  }, [state]);

  // После соединения — настойчиво воспроизводим звук собеседника (важно для Android)
  useEffect(() => {
    if (state !== "connected") return;
    let tries = 0;
    const tryPlay = () => {
      bindRemoteMedia();
      tries += 1;
      if (tries >= 8) clearInterval(iv);
    };
    tryPlay();
    const iv = setInterval(tryPlay, 600);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, speaker]);

  const hangup = () => endCall("hangup");
  const reject = () => endCall("hangup");

  const fmtDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const stateLabel = state === "connected" && netPoor
    ? "Слабое соединение…"
    : { calling: "Соединение…", ringing: "Входящий звонок", connected: fmtDuration(duration), ended: "Звонок завершён" }[state];

  const unlockAudio = async () => {
    unlockAudioContext();
    bindRemoteMedia();
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
              <img src={callAvatar} alt={remoteName} className="relative w-32 h-32 rounded-full object-cover animate-pulse-glow border-2 border-white/20" />
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


        {state === "connected" && !isVideo && (
          <div className="flex items-end gap-1 h-10 mt-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="w-1.5 bg-violet-500/60 rounded-full animate-pulse" style={{ height: `${8 + Math.random() * 24}px`, animationDelay: `${i * 0.07}s` }} />
            ))}
          </div>
        )}
      </div>

      <div className="w-full relative z-20 flex-shrink-0">
        {state === "ringing" ? (
          <div className="flex items-center justify-center gap-16">
            <div className="flex flex-col items-center gap-2.5">
              <button onClick={reject} className="w-[72px] h-[72px] bg-red-500 rounded-full flex items-center justify-center shadow-xl shadow-red-500/40 hover:bg-red-600 active:scale-95 transition-all">
                <Icon name="PhoneOff" size={30} className="text-white" />
              </button>
              <span className="text-sm font-medium text-white/80">Отклонить</span>
            </div>
            <div className="flex flex-col items-center gap-2.5">
              <button onClick={acceptCall} className="w-[72px] h-[72px] bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/40 hover:bg-emerald-600 active:scale-95 transition-all animate-call-shake">
                <Icon name="Phone" size={30} className="text-white" />
              </button>
              <span className="text-sm font-medium text-white/80">Принять</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => { setMuted(m => { localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = m; }); return !m; }); }}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${muted ? "bg-red-500/20 text-red-400" : "glass text-foreground"}`}
              >
                <Icon name={muted ? "MicOff" : "Mic"} size={22} />
              </button>
              <span className="text-xs text-muted-foreground">{muted ? "Включить" : "Выкл. микро"}</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button onClick={hangup} className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors">
                <Icon name="PhoneOff" size={26} className="text-white" />
              </button>
              <span className="text-xs text-muted-foreground">Завершить</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => { setSpeaker(s => { const next = !s; if (remoteAudioRef.current) remoteAudioRef.current.muted = isVideo ? true : !next; if (remoteVideoRef.current) remoteVideoRef.current.muted = !next; return next; }); }}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${speaker ? "grad-primary text-white" : "glass text-muted-foreground"}`}
              >
                <Icon name={speaker ? "Volume2" : "VolumeX"} size={22} />
              </button>
              <span className="text-xs text-muted-foreground">{speaker ? "Звук вкл." : "Звук выкл."}</span>
            </div>

            {isVideo && (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => { setVideoOff(v => { localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = v; }); return !v; }); }}
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