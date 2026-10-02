import { useState, useEffect, useRef } from "react";
import {
  getRingtoneId, setRingtoneId,
  getNotifyId, setNotifyId,
  saveCustomRingtone, getCustomRingtoneMeta,
  saveCustomNotify, getCustomNotifyMeta,
  type RingtoneId, type NotifyId,
} from "@/lib/sounds";

const MAX_RINGTONE_SIZE = 10 * 1024 * 1024;

/** Состояние и обработчики настроек звуков (мелодия звонка, звук уведомлений, разрешение push). */
export function useSettingsSounds() {
  const [ringtone, setRingtone] = useState<RingtoneId>(() => getRingtoneId());
  const [notifySnd, setNotifySnd] = useState<NotifyId>(() => getNotifyId());
  const [customMeta, setCustomMeta] = useState<{ name: string; size: number; type: string } | null>(null);
  const [customNotifyMeta, setCustomNotifyMeta] = useState<{ name: string; size: number; type: string } | null>(null);
  const ringFileRef = useRef<HTMLInputElement | null>(null);
  const notifyFileRef = useRef<HTMLInputElement | null>(null);
  const [pushPerm, setPushPerm] = useState<NotificationPermission>(() => (typeof Notification !== "undefined" ? Notification.permission : "default"));
  const [soundError, setSoundError] = useState<string>("");

  useEffect(() => { getCustomRingtoneMeta().then(setCustomMeta); }, []);
  useEffect(() => { getCustomNotifyMeta().then(setCustomNotifyMeta); }, []);
  useEffect(() => {
    if (!soundError) return;
    const t = setTimeout(() => setSoundError(""), 3500);
    return () => clearTimeout(t);
  }, [soundError]);

  const onPickRingFile = () => ringFileRef.current?.click();
  const onRingFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const audioExt = /\.(mp3|m4a|aac|ogg|oga|opus|wav|weba|webm|flac|caf|3gp|amr)$/i.test(f.name);
    // На некоторых устройствах MIME-тип пустой — тогда проверяем по расширению
    if (!f.type.startsWith("audio/") && !audioExt) { setSoundError("Можно загрузить только аудио"); return; }
    if (f.size > MAX_RINGTONE_SIZE) { setSoundError("Файл слишком большой (макс 10 МБ)"); return; }
    try {
      const meta = await saveCustomRingtone(f);
      setCustomMeta({ name: meta.name, size: meta.size, type: f.type });
      setRingtoneId("custom");
      setRingtone("custom");
    } catch (err) {
      console.error("[ringtone] save failed:", err);
      setSoundError((err as Error)?.message || "Не удалось сохранить файл");
    }
  };

  const onPickNotifyFile = () => notifyFileRef.current?.click();
  const onNotifyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const audioExt = /\.(mp3|m4a|aac|ogg|oga|opus|wav|weba|webm|flac|caf|3gp|amr)$/i.test(f.name);
    if (!f.type.startsWith("audio/") && !audioExt) { setSoundError("Можно загрузить только аудио"); return; }
    if (f.size > MAX_RINGTONE_SIZE) { setSoundError("Файл слишком большой (макс 10 МБ)"); return; }
    try {
      const meta = await saveCustomNotify(f);
      setCustomNotifyMeta({ name: meta.name, size: meta.size, type: f.type });
      setNotifyId("custom");
      setNotifySnd("custom");
    } catch (err) {
      console.error("[notify] save failed:", err);
      setSoundError((err as Error)?.message || "Не удалось сохранить файл");
    }
  };

  const requestPushPerm = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPushPerm(p);
  };

  return {
    ringtone, setRingtone,
    notifySnd, setNotifySnd,
    customMeta, setCustomMeta,
    customNotifyMeta, setCustomNotifyMeta,
    ringFileRef, notifyFileRef,
    pushPerm, requestPushPerm,
    soundError,
    onPickRingFile, onRingFile,
    onPickNotifyFile, onNotifyFile,
  };
}

export type SettingsSounds = ReturnType<typeof useSettingsSounds>;
