import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { type CallState } from "@/components/messenger/CallScreenParts";
import { unlockAudioContext } from "@/lib/sounds";

export interface CallControlsParams {
  isVideo: boolean;
  state: CallState;
  netPoor: boolean;
  duration: number;
  setMuted: Dispatch<SetStateAction<boolean>>;
  setSpeaker: Dispatch<SetStateAction<boolean>>;
  setVideoOff: Dispatch<SetStateAction<boolean>>;
  localStreamRef: MutableRefObject<MediaStream | null>;
  remoteAudioRef: MutableRefObject<HTMLAudioElement | null>;
  remoteVideoRef: MutableRefObject<HTMLVideoElement | null>;
  endCall: (reason: "hangup" | "decline" | "remote_hangup") => void;
  bindRemoteMedia: () => void;
}

export function useCallControls({
  isVideo, state, netPoor, duration, setMuted, setSpeaker, setVideoOff,
  localStreamRef, remoteAudioRef, remoteVideoRef, endCall, bindRemoteMedia,
}: CallControlsParams) {
  const hangup = () => endCall("hangup");

  const toggleMute = () => setMuted(m => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = m; });
    return !m;
  });

  const toggleSpeaker = () => setSpeaker(s => {
    const next = !s;
    if (remoteAudioRef.current) remoteAudioRef.current.muted = isVideo ? true : !next;
    if (remoteVideoRef.current) remoteVideoRef.current.muted = !next;
    return next;
  });

  const toggleVideo = () => setVideoOff(v => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = v; });
    return !v;
  });
  const reject = () => endCall("decline");

  const fmtDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const stateLabel = state === "connected" && netPoor
    ? "Слабое соединение…"
    : { calling: "Соединение…", ringing: "Входящий звонок", connected: fmtDuration(duration), ended: "Звонок завершён" }[state];

  const unlockAudio = async () => {
    unlockAudioContext();
    bindRemoteMedia();
  };

  return { hangup, toggleMute, toggleSpeaker, toggleVideo, reject, stateLabel, unlockAudio };
}
