import { useMemo } from "react";
import Icon from "@/components/ui/icon";
import { avatarGrad } from "@/lib/api";

export type CallState = "calling" | "ringing" | "connected" | "ended";

interface CallInfoProps {
  state: CallState;
  isVideo: boolean;
  netPoor: boolean;
  remoteUserId: number;
  remoteName: string;
  callAvatar: string | null | undefined;
  stateLabel: string;
}

function VoiceBars() {
  const heights = useMemo(() => Array.from({ length: 20 }, () => 8 + Math.random() * 24), []);
  return (
    <div className="flex items-end gap-1 h-10 mt-2">
      {heights.map((h, i) => (
        <div key={i} className="w-1.5 bg-violet-500/60 rounded-full animate-pulse" style={{ height: `${h}px`, animationDelay: `${i * 0.07}s` }} />
      ))}
    </div>
  );
}

export function CallInfo({ state, isVideo, netPoor, remoteUserId, remoteName, callAvatar, stateLabel }: CallInfoProps) {
  const labelClass = state === "connected" && netPoor
    ? "text-amber-400 text-sm"
    : state === "connected"
      ? "text-emerald-400 text-sm"
      : state === "ringing"
        ? "text-emerald-400 text-base animate-pulse"
        : "text-muted-foreground text-sm";

  return (
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
      <p className={`font-medium ${labelClass}`}>{stateLabel}</p>
      {isVideo && (
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-xs text-white/70">
          <Icon name="Video" size={12} />Видеозвонок
        </div>
      )}
      {state === "connected" && !isVideo && <VoiceBars />}
    </div>
  );
}

function RoundButton({ onClick, className, icon, size, iconSize, label, labelClass = "text-xs text-muted-foreground", iconClass }: {
  onClick: () => void;
  className: string;
  icon: string;
  size: string;
  iconSize: number;
  label: string;
  labelClass?: string;
  iconClass?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button onClick={onClick} aria-label={label} className={`${size} rounded-full flex items-center justify-center transition-all ${className}`}>
        <Icon name={icon} size={iconSize} className={iconClass} />
      </button>
      <span className={labelClass}>{label}</span>
    </div>
  );
}

interface CallControlsProps {
  state: CallState;
  isVideo: boolean;
  muted: boolean;
  speaker: boolean;
  videoOff: boolean;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleVideo: () => void;
}

export function CallControls({
  state, isVideo, muted, speaker, videoOff,
  onAccept, onReject, onHangup, onToggleMute, onToggleSpeaker, onToggleVideo,
}: CallControlsProps) {
  if (state === "ringing") {
    return (
      <div className="flex items-center justify-center gap-16">
        <RoundButton
          onClick={onReject}
          size="w-[72px] h-[72px]"
          className="bg-red-500 shadow-xl shadow-red-500/40 hover:bg-red-600 active:scale-95"
          icon="PhoneOff" iconSize={30} iconClass="text-white"
          label="Отклонить" labelClass="text-sm font-medium text-white/80"
        />
        <RoundButton
          onClick={onAccept}
          size="w-[72px] h-[72px]"
          className="bg-emerald-500 shadow-xl shadow-emerald-500/40 hover:bg-emerald-600 active:scale-95 animate-call-shake"
          icon="Phone" iconSize={30} iconClass="text-white"
          label="Принять" labelClass="text-sm font-medium text-white/80"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-6">
      <RoundButton
        onClick={onToggleMute}
        size="w-14 h-14"
        className={muted ? "bg-red-500/20 text-red-400" : "glass text-foreground"}
        icon={muted ? "MicOff" : "Mic"} iconSize={22}
        label={muted ? "Включить" : "Выкл. микро"}
      />
      <RoundButton
        onClick={onHangup}
        size="w-16 h-16"
        className="bg-red-500 shadow-lg shadow-red-500/30 hover:bg-red-600"
        icon="PhoneOff" iconSize={26} iconClass="text-white"
        label="Завершить"
      />
      <RoundButton
        onClick={onToggleSpeaker}
        size="w-14 h-14"
        className={speaker ? "grad-primary text-white" : "glass text-muted-foreground"}
        icon={speaker ? "Volume2" : "VolumeX"} iconSize={22}
        label={speaker ? "Звук вкл." : "Звук выкл."}
      />
      {isVideo && (
        <RoundButton
          onClick={onToggleVideo}
          size="w-14 h-14"
          className={videoOff ? "bg-red-500/20 text-red-400" : "glass text-foreground"}
          icon={videoOff ? "VideoOff" : "Video"} iconSize={22}
          label="Камера"
        />
      )}
    </div>
  );
}
