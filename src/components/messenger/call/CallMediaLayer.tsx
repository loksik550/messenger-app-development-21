import type { MutableRefObject } from "react";
import Icon from "@/components/ui/icon";
import { type CallState } from "@/components/messenger/CallScreenParts";

interface CallMediaLayerProps {
  isVideo: boolean;
  state: CallState;
  videoOff: boolean;
  mediaError: string;
  remoteAudioRef: MutableRefObject<HTMLAudioElement | null>;
  localVideoRef: MutableRefObject<HTMLVideoElement | null>;
  remoteVideoRef: MutableRefObject<HTMLVideoElement | null>;
}

export function CallMediaLayer({ isVideo, state, videoOff, mediaError, remoteAudioRef, localVideoRef, remoteVideoRef }: CallMediaLayerProps) {
  return (
    <>
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
    </>
  );
}
