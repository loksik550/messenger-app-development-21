import type { MutableRefObject } from "react";
import Icon from "@/components/ui/icon";
import { nativeCall } from "@/lib/nativeCall";
import { type CallState } from "@/components/messenger/CallScreenParts";

interface CallMediaLayerProps {
  isVideo: boolean;
  state: CallState;
  videoOff: boolean;
  mediaError: string;
  mediaDenied?: boolean;
  onRetryMedia?: () => void;
  remoteAudioRef: MutableRefObject<HTMLAudioElement | null>;
  localVideoRef: MutableRefObject<HTMLVideoElement | null>;
  remoteVideoRef: MutableRefObject<HTMLVideoElement | null>;
}

export function CallMediaLayer({ isVideo, state, videoOff, mediaError, mediaDenied, onRetryMedia, remoteAudioRef, localVideoRef, remoteVideoRef }: CallMediaLayerProps) {
  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {mediaError && (
        <div
          className="absolute left-4 right-4 z-30 px-4 py-3 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-100 text-sm"
          style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
        >
          <div className="flex items-start gap-2">
            <Icon name="MicOff" size={18} className="mt-0.5 flex-shrink-0 text-red-300" />
            <span className="flex-1">{mediaError}</span>
          </div>
          {mediaDenied && (
            <>
              {!nativeCall.canOpenSettings() && (
                <p className="mt-2 text-xs text-red-200/80">
                  В браузере нажмите на значок замка или «aA» в адресной строке → Разрешения → Микрофон → Разрешить.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                {nativeCall.canOpenSettings() && (
                  <button
                    type="button"
                    onClick={() => { nativeCall.openSettings(); }}
                    className="flex-1 py-2 rounded-xl bg-white/15 text-white text-xs font-semibold"
                  >
                    Открыть настройки
                  </button>
                )}
                <button
                  type="button"
                  onClick={onRetryMedia}
                  className="flex-1 py-2 rounded-xl bg-violet-500 text-white text-xs font-semibold"
                >
                  Повторить
                </button>
              </div>
            </>
          )}
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
