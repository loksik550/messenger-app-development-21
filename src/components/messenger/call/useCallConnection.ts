import { useState, useEffect, useRef } from "react";
import { api, getCallAvatar, getIceServers, type User } from "@/lib/api";
import { type CallState } from "@/components/messenger/CallScreenParts";
import { startRingtone, stopRingtone, startDialTone, stopDialTone, playHangupSound, unlockAudioContext } from "@/lib/sounds";

export interface CallConnectionParams {
  currentUser: User;
  remoteUserId: number;
  callId: string;
  isIncoming: boolean;
  autoAccept?: boolean;
  onClose: () => void;
}

export function useCallConnection({ currentUser, remoteUserId, callId, isIncoming, autoAccept, onClose }: CallConnectionParams) {
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

  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;
  useEffect(() => () => { endedRef.current = true; cleanupRef.current(); }, []);

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

  const endCall = (reason: "hangup" | "decline" | "remote_hangup") => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (reason !== "remote_hangup") sendSignal(reason).catch(() => { /* ignore */ });
    // Мгновенно останавливаем таймер длительности, чтобы секунды замерли
    // сразу при сбросе собеседником, а не через задержку cleanup().
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    stopRingtone();
    stopDialTone();
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
    if (endedRef.current) {
      stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
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
    // Обычный режим ICE: браузер пробует и прямой путь (работает на одном Wi-Fi),
    // и ВСЕ доступные TURN-ретрансляторы (для разных сетей). relay-only не помог —
    // виноват был конкретный сервер Metered (резал DTLS), а не режим. Теперь TURN
    // несколько (Metered + OpenRelay + ExpressTURN) — сработает рабочий.
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
        void sent;
        // ТОЛЬКО индикатор качества. Никакого ICE-restart — он рвал соединение
        // в момент установки медиа (в логах после restart сразу шёл disconnected).
        if (bytes > lastAudioBytesRef.current) {
          lastAudioBytesRef.current = bytes;
          audioStallRef.current = 0;
          setNetPoor(false);
        } else {
          audioStallRef.current += 1;
          if (audioStallRef.current >= 2) setNetPoor(true);
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
    if (endedRef.current) return;
    try {
      const data = await api("get_call_signals", { call_id: callId, since_id: sinceRef.current }, currentUser.id);
      if (data.ended) { endCall("remote_hangup"); return; }
      if (!data.signals) return;
      for (const sig of data.signals) {
        const sid = sig.id || 0;
        sinceRef.current = Math.max(sinceRef.current, sid);
        if (sid && processedRef.current.has(sid)) continue;
        if (sid) processedRef.current.add(sid);
        // Сигнал завершения обрабатываем всегда, даже если PeerConnection ещё
        // не создан или уже закрыт — иначе у собеседника таймер не остановится.
        if (["hangup", "decline", "end", "cancel"].includes(sig.type)) {
          endCall("remote_hangup");
          return;
        }
        const pc = pcRef.current;
        if (!pc) continue;
        await handleSignal(pc, sig);
      }
    } catch { /* network ignore */ }
  };

  const startPolling = () => {
    if (pollRef.current) return;
    sinceRef.current = 0;
    pollOnce();
    pollRef.current = setInterval(pollOnce, 700);
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

  useEffect(() => {
    if (!isIncoming || !autoAccept) return;
    const t = setTimeout(() => { if (!endedRef.current) acceptCall(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAccept]);

  return {
    isVideo, state, muted, setMuted, videoOff, setVideoOff, speaker, setSpeaker, netPoor, duration, mediaError, callAvatar,
    localStreamRef, remoteAudioRef, localVideoRef, remoteVideoRef,
    endCall, acceptCall, bindRemoteMedia,
  };
}
