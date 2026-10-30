import { useCallback, useEffect, useRef, useState } from "react";
import { api, getIceServers, type User } from "@/lib/api";
import nativeCall from "@/lib/nativeCall";

export interface GCallParticipant { user_id: number; name: string; avatar_url?: string | null; muted: boolean }
type Peer = { pc: RTCPeerConnection; stream: MediaStream; audio: HTMLAudioElement; pending: RTCIceCandidateInit[]; remoteSet: boolean };

export type GCallState = "joining" | "active" | "ended" | "error";

/** Групповой аудиозвонок: каждый участник соединён с каждым (до 8 человек). */
export function useGroupCall(groupId: number, me: User, onClosed: () => void) {
  const [state, setState] = useState<GCallState>("joining");
  const [error, setError] = useState("");
  const [participants, setParticipants] = useState<GCallParticipant[]>([]);
  const [connected, setConnected] = useState<Set<number>>(new Set());
  const [speaking, setSpeaking] = useState<Set<number>>(new Set());
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  const callIdRef = useRef("");
  const localRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<number, Peer>>(new Map());
  const iceRef = useRef<RTCIceServer[]>([]);
  const sinceRef = useRef(0);
  const endedRef = useRef(false);
  const mutedRef = useRef(false);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysers = useRef<Map<number, AnalyserNode>>(new Map());

  const send = (to: number, type: string, payload?: unknown) =>
    api("gcall_signal", { call_id: callIdRef.current, to_user_id: to, type, payload }, me.id).catch(() => null);

  const markConn = (uid: number, on: boolean) =>
    setConnected((p) => { const n = new Set(p); if (on) n.add(uid); else n.delete(uid); return n; });

  const dropPeer = (uid: number) => {
    const p = peersRef.current.get(uid);
    if (!p) return;
    try { p.pc.close(); } catch { /* ignore */ }
    p.audio.srcObject = null;
    p.audio.remove();
    peersRef.current.delete(uid);
    analysers.current.delete(uid);
    markConn(uid, false);
  };

  const attachAnalyser = (uid: number, stream: MediaStream) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      analysers.current.set(uid, an);
    } catch { /* ignore */ }
  };

  const makePeer = (uid: number): Peer => {
    const existing = peersRef.current.get(uid);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: iceRef.current });
    const stream = new MediaStream();
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    audio.style.display = "none";
    document.body.appendChild(audio);
    const peer: Peer = { pc, stream, audio, pending: [], remoteSet: false };
    peersRef.current.set(uid, peer);
    localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));
    pc.onicecandidate = (e) => { if (e.candidate) send(uid, "candidate", e.candidate.toJSON()); };
    pc.ontrack = (e) => {
      if (!stream.getTracks().includes(e.track)) stream.addTrack(e.track);
      audio.srcObject = stream;
      audio.play().catch(() => { /* по тапу */ });
      attachAnalyser(uid, stream);
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "connected") markConn(uid, true);
      if (st === "failed" || st === "closed") dropPeer(uid);
      if (st === "disconnected") markConn(uid, false);
    };
    return peer;
  };

  const flush = async (p: Peer) => {
    const list = p.pending.splice(0);
    for (const c of list) { try { await p.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
  };

  const offerTo = async (uid: number) => {
    const p = makePeer(uid);
    const offer = await p.pc.createOffer({ offerToReceiveAudio: true });
    await p.pc.setLocalDescription(offer);
    await send(uid, "offer", { sdp: offer.sdp, type: offer.type });
  };

  const handleSignal = async (sig: { from_user_id: number; type: string; payload: unknown }) => {
    const uid = sig.from_user_id;
    if (sig.type === "bye") { dropPeer(uid); return; }
    if (sig.type === "offer") {
      if (peersRef.current.has(uid)) dropPeer(uid);
      const p = makePeer(uid);
      await p.pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
      p.remoteSet = true;
      await flush(p);
      const ans = await p.pc.createAnswer();
      await p.pc.setLocalDescription(ans);
      await send(uid, "answer", { sdp: ans.sdp, type: ans.type });
      return;
    }
    const p = peersRef.current.get(uid);
    if (!p) return;
    if (sig.type === "answer" && p.pc.signalingState === "have-local-offer") {
      await p.pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
      p.remoteSet = true;
      await flush(p);
    } else if (sig.type === "candidate") {
      const c = sig.payload as RTCIceCandidateInit;
      if (!p.remoteSet) p.pending.push(c);
      else { try { await p.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
    }
  };

  // Соединяемся с теми, у кого id больше нашего — так два человека не звонят друг другу одновременно.
  const syncPeers = (list: GCallParticipant[]) => {
    const ids = new Set(list.map((p) => p.user_id));
    for (const uid of [...peersRef.current.keys()]) if (!ids.has(uid)) dropPeer(uid);
    for (const p of list) {
      if (p.user_id === me.id || peersRef.current.has(p.user_id)) continue;
      if (me.id < p.user_id) offerTo(p.user_id).catch(() => dropPeer(p.user_id));
    }
  };

  const cleanup = () => {
    timers.current.forEach(clearInterval);
    timers.current = [];
    for (const uid of [...peersRef.current.keys()]) dropPeer(uid);
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    audioCtxRef.current?.close().catch(() => { /* ignore */ });
    audioCtxRef.current = null;
    nativeCall.ended();
  };

  const leave = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    const cid = callIdRef.current;
    for (const uid of peersRef.current.keys()) send(uid, "bye");
    if (cid) api("gcall_leave", { call_id: cid }, me.id).catch(() => null);
    cleanup();
    setState("ended");
    setTimeout(onClosed, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id, onClosed]);

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    localRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    api("gcall_ping", { call_id: callIdRef.current, muted: next }, me.id).catch(() => null);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        localRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        if (!alive) return;
        setError("Нет доступа к микрофону. Разрешите его в настройках и попробуйте снова.");
        setState("error");
        return;
      }
      iceRef.current = await getIceServers(me.id);
      const r = await api("gcall_join", { group_id: groupId }, me.id).catch(() => null);
      if (!alive) return;
      if (!r || r.error) {
        setError(r?.error || "Не удалось подключиться к звонку");
        setState("error");
        localRef.current?.getTracks().forEach((t) => t.stop());
        return;
      }
      callIdRef.current = r.call_id;
      setParticipants(r.participants || []);
      setState("active");
      nativeCall.started();
      syncPeers(r.participants || []);

      const poll = async () => {
        if (endedRef.current) return;
        const d = await api("gcall_signals", { call_id: callIdRef.current, since_id: sinceRef.current }, me.id).catch(() => null);
        for (const sig of d?.signals || []) {
          sinceRef.current = Math.max(sinceRef.current, sig.id);
          try { await handleSignal(sig); } catch { /* ignore */ }
        }
      };
      const ping = async () => {
        if (endedRef.current) return;
        const d = await api("gcall_ping", { call_id: callIdRef.current }, me.id).catch(() => null);
        if (!d) return;
        if (d.left || d.ended) { leave(); return; }
        setParticipants(d.participants || []);
        syncPeers(d.participants || []);
      };
      const levels = () => {
        const now = new Set<number>();
        const buf = new Uint8Array(128);
        analysers.current.forEach((an, uid) => {
          an.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          if (sum / buf.length > 18) now.add(uid);
        });
        setSpeaking(now);
      };
      poll();
      timers.current.push(setInterval(poll, 1200));
      timers.current.push(setInterval(ping, 4000));
      timers.current.push(setInterval(levels, 300));
      timers.current.push(setInterval(() => setDuration((x) => x + 1), 1000));
    })();
    return () => {
      alive = false;
      if (!endedRef.current) {
        endedRef.current = true;
        if (callIdRef.current) api("gcall_leave", { call_id: callIdRef.current }, me.id).catch(() => null);
        cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, me.id]);

  return { state, error, participants, connected, speaking, muted, duration, toggleMute, leave };
}
