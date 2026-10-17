import { Capacitor, registerPlugin } from "@capacitor/core";

interface NovaCallPlugin {
  callStarted(): Promise<void>;
  callEnded(): Promise<void>;
}

const NovaCall = registerPlugin<NovaCallPlugin>("NovaCall");
const available = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("NovaCall");

export const nativeCall = {
  started() {
    if (!available()) return;
    NovaCall.callStarted().catch(() => { /* старая версия приложения */ });
  },
  ended() {
    if (!available()) return;
    NovaCall.callEnded().catch(() => { /* старая версия приложения */ });
  },
};

export default nativeCall;
