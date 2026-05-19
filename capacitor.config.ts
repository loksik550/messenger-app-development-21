import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // ⚠️ Уникальный ID — менять нельзя после публикации в RuStore
  appId: "ru.nova.messenger",
  appName: "Nova",
  webDir: "dist",
  bundledWebRuntime: false,

  // Если используешь онлайн-сайт (а не локальные файлы) — раскомментируй блок server:
  // server: {
  //   url: "https://your-domain.com",
  //   cleartext: false,
  //   androidScheme: "https",
  // },

  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0a0814",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0814",
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      iconColor: "#8b5cf6",
    },
  },
};

export default config;