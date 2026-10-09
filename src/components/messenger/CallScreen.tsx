import { type User } from "@/lib/api";
import { CallInfo, CallControls } from "@/components/messenger/CallScreenParts";
import { useCallConnection } from "@/components/messenger/call/useCallConnection";
import { useCallControls } from "@/components/messenger/call/useCallControls";
import { CallMediaLayer } from "@/components/messenger/call/CallMediaLayer";


interface CallScreenProps {
  currentUser: User;
  remoteUserId: number;
  remoteName: string;
  callId: string;
  isIncoming: boolean;
  autoAccept?: boolean;
  onClose: () => void;
}

export function CallScreen({ currentUser, remoteUserId, remoteName, callId, isIncoming, autoAccept, onClose }: CallScreenProps) {
  const {
    isVideo, state, muted, setMuted, videoOff, setVideoOff, speaker, setSpeaker, netPoor, duration, mediaError, callAvatar,
    localStreamRef, remoteAudioRef, localVideoRef, remoteVideoRef,
    endCall, acceptCall, bindRemoteMedia,
  } = useCallConnection({ currentUser, remoteUserId, callId, isIncoming, autoAccept, onClose });

  const { hangup, toggleMute, toggleSpeaker, toggleVideo, reject, stateLabel, unlockAudio } = useCallControls({
    isVideo, state, netPoor, duration, setMuted, setSpeaker, setVideoOff,
    localStreamRef, remoteAudioRef, remoteVideoRef, endCall, bindRemoteMedia,
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center bg-background px-8 animate-fade-in"
      style={{ paddingTop: "calc(3rem + env(safe-area-inset-top))", paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
      onPointerDown={unlockAudio}
    >
      <CallMediaLayer
        isVideo={isVideo}
        state={state}
        videoOff={videoOff}
        mediaError={mediaError}
        remoteAudioRef={remoteAudioRef}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
      />

      <CallInfo
        state={state}
        isVideo={isVideo}
        netPoor={netPoor}
        remoteUserId={remoteUserId}
        remoteName={remoteName}
        callAvatar={callAvatar}
        stateLabel={stateLabel}
      />

      <div className="w-full relative z-20 flex-shrink-0">
        <CallControls
          state={state}
          isVideo={isVideo}
          muted={muted}
          speaker={speaker}
          videoOff={videoOff}
          onAccept={acceptCall}
          onReject={reject}
          onHangup={hangup}
          onToggleMute={toggleMute}
          onToggleSpeaker={toggleSpeaker}
          onToggleVideo={toggleVideo}
        />
      </div>
    </div>
  );
}
