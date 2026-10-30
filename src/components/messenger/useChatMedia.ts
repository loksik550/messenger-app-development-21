import { useState, useRef, useEffect } from "react";
import { track } from "@/lib/track";
import { api, uploadAny, FileTooLargeError, type Chat, type Message, type User } from "@/lib/api";
import { uploadAlbum, MAX_ALBUM } from "@/lib/uploadAlbum";
import { getSendOriginal } from "@/lib/originalQuality";
import { canEncryptChat, encryptFile, type MediaKey } from "@/lib/e2e";

// Отправка файлов и запись голосовых сообщений.
// Логика перенесена из ChatComponents.tsx без изменений.
export function useChatMedia({
  chat, currentUser, setMessages, setLastSince, setShowAttach,
}: {
  chat: Chat;
  currentUser: User;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setLastSince: React.Dispatch<React.SetStateAction<number>>;
  setShowAttach: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("Загружаем...");
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const recordSecRef = useRef(0);
  useEffect(() => { recordSecRef.current = recordSec; }, [recordSec]);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordCancelledRef = useRef(false);

  const sendFile = async (file: File, extra?: { duration?: number; mediaTypeOverride?: "audio" | "video" | "image" | "file" }) => {
    // Лимит размера: тело облачной функции ограничено, а base64 раздувает на ~33%.
    // Видео-кружки сжаты при записи, для них предел выше.
    const original = !!currentUser.is_pro && getSendOriginal() && !extra?.mediaTypeOverride
      && (file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (file.type.startsWith("image/") && !extra?.mediaTypeOverride && !original) {
      const { compressImage } = await import("@/lib/compressImage");
      file = await compressImage(file);
    }
    setUploading(true);
    setShowAttach(false);
    const labelMap: Record<string, string> = { image: "Загружаем фото...", video: "Загружаем видео...", audio: "Загружаем аудио...", file: "Загружаем файл..." };
    const kindLabel = file.type.startsWith("video/") ? "видео" : file.type.startsWith("audio/") ? "аудио" : file.type.startsWith("image/") ? "фото" : "файл";
    const onProgress = (done: number, total: number) => {
      setUploadLabel(`Загружаем ${kindLabel}: ${Math.floor((done / Math.max(total, 1)) * 100)}%`);
    };
    try {
      const secure = !chat.saved && !chat.group && await canEncryptChat(chat.id, currentUser.id);
      let mediaKey: MediaKey | null = null;
      let result: Awaited<ReturnType<typeof uploadAny>>;
      if (secure) {
        const enc = await encryptFile(file, file.name || "file");
        mediaKey = enc.key;
        const guessed = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "file";
        const up = await uploadAny(new File([enc.blob], "encrypted.bin", { type: "application/octet-stream" }), currentUser.id, onProgress, { original: true });
        result = { ...up, media_type: guessed, file_name: "encrypted.bin", file_size: file.size };
      } else {
        result = await uploadAny(file, currentUser.id, onProgress, { original });
      }
      const finalMediaType = extra?.mediaTypeOverride || result.media_type;
      const localUrl = mediaKey ? URL.createObjectURL(file) : result.url;
      track(finalMediaType === "audio" ? "msg_voice" : finalMediaType === "image" ? "msg_photo" : finalMediaType === "video" ? "msg_video" : "msg_file");
      setUploadLabel(labelMap[finalMediaType] || "Загружаем...");
      const data = await api("send_message", {
        chat_id: chat.id,
        media_type: finalMediaType,
        media_url: result.url,
        file_name: mediaKey ? "encrypted.bin" : result.file_name,
        file_size: result.file_size,
        duration: extra?.duration,
        ...(mediaKey ? { e2e_media: mediaKey } : {}),
      }, currentUser.id);
      if (data?.error) throw new Error(data.error);
      if (data.id) {
        const timeStr = new Date(data.created_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
        setMessages(prev => [...prev, {
          id: data.id,
          text: data.text || "",
          time: timeStr,
          out: true,
          created_at: data.created_at,
          media_type: finalMediaType,
          media_url: localUrl,
          image_url: finalMediaType === "image" ? localUrl : undefined,
          file_name: mediaKey ? mediaKey.name : result.file_name,
          file_size: result.file_size,
          duration: extra?.duration,
          reactions: [],
        }]);
        setLastSince(data.created_at);
      }
    } catch (uploadErr) {
      console.error(uploadErr);
      if (uploadErr instanceof FileTooLargeError) {
        window.dispatchEvent(new CustomEvent("nova:file-too-large", { detail: { message: uploadErr.message, isPro: uploadErr.isPro, proMb: uploadErr.proMb, limitMb: uploadErr.limitMb } }));
        return;
      }
      const reason = uploadErr instanceof Error && uploadErr.message ? `\n\nПричина: ${uploadErr.message}` : "";
      alert(`Не удалось отправить файл. Проверь интернет и попробуй ещё раз.${reason}`);
    } finally { setUploading(false); setUploadLabel("Загружаем..."); }
  };

  const sendFiles = async (files: File[]) => {
    const list = files.filter(Boolean);
    if (list.length === 0) return;
    const images = list.filter(f => f.type.startsWith("image/") && !/gif|svg/i.test(f.type));
    const secure = !chat.saved && !chat.group && await canEncryptChat(chat.id, currentUser.id);
    if (list.length === 1 || images.length < 2 || secure) {
      for (const f of list) await sendFile(f);
      return;
    }
    if (images.length > MAX_ALBUM) alert(`За раз можно отправить до ${MAX_ALBUM} фото — отправим первые ${MAX_ALBUM}.`);
    setUploading(true);
    setShowAttach(false);
    setUploadLabel(`Загружаем фото 0/${Math.min(images.length, MAX_ALBUM)}...`);
    try {
      const original = !!currentUser.is_pro && getSendOriginal();
      const { urls, failed } = await uploadAlbum(images, currentUser.id, (d, t) => setUploadLabel(`Загружаем фото ${d}/${t}...`), { original });
      if (urls.length === 0) throw new Error("Ни одно фото не загрузилось");
      const payload = urls.length > 1 ? { album: urls.map(url => ({ url })) } : undefined;
      const data = await api("send_message", {
        chat_id: chat.id, media_type: "image", media_url: urls[0],
        payload, file_name: "photo.jpg",
      }, currentUser.id);
      if (!data?.id) throw new Error(data?.error || "Сервер не принял сообщение");
      track("msg_photo");
      const timeStr = new Date(data.created_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
      setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, {
        id: data.id, text: "📷 Фото", time: timeStr, out: true,
        created_at: data.created_at, media_type: "image", media_url: urls[0], image_url: urls[0],
        payload: payload || null, reactions: [],
      }]);
      setLastSince(data.created_at);
      if (failed > 0) alert(`Не загрузилось фото: ${failed}. Остальные отправлены.`);
    } catch (e) {
      console.error(e);
      alert(`Не удалось отправить фото. Проверь интернет и попробуй ещё раз.${e instanceof Error && e.message ? `\n\nПричина: ${e.message}` : ""}`);
    } finally {
      setUploading(false);
      setUploadLabel("Загружаем...");
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Запись недоступна. Открой приложение по защищённому адресу (https) и в современном браузере.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      alert("Браузер не поддерживает запись звука.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      // Подбираем поддерживаемый формат. На Apple-устройствах webm не
      // воспроизводится — там приоритет mp4, на остальных webm/opus.
      const isApple = /iphone|ipad|ipod|mac/i.test(navigator.userAgent);
      const candidates = isApple
        ? ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", ""]
        : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/ogg;codecs=opus", ""];
      let mime = "";
      for (const c of candidates) {
        if (!c) { mime = ""; break; }
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) {
          mime = c; break;
        }
      }
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorder.current = mr;
      audioChunks.current = [];
      recordCancelledRef.current = false;
      mr.ondataavailable = e => { if (e.data && e.data.size > 0) audioChunks.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
        setRecording(false);
        if (recordCancelledRef.current) return; // отмена — не отправляем
        const realType = (mr.mimeType || mime || "audio/webm").split(";")[0].trim() || "audio/webm";
        const ext = realType.includes("mp4") ? "m4a" : realType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(audioChunks.current, { type: realType });
        if (blob.size < 500) return; // совсем пустая запись
        const dur = recordSecRef.current;
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: realType });
        await sendFile(file, { duration: dur, mediaTypeOverride: "audio" });
      };
      mr.start(); // пишем одним куском — корректный заголовок и длительность
      setRecording(true);
      setRecordSec(0);
      if (recordTimer.current) clearInterval(recordTimer.current);
      recordTimer.current = setInterval(() => setRecordSec(s => {
        if (s + 1 >= 300) { // макс 5 минут — стоп и отправка через onstop
          if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
            try { mediaRecorder.current.stop(); } catch { /* ignore */ }
          }
          return 300;
        }
        return s + 1;
      }), 1000);
    } catch (e) {
      const name = (e as DOMException).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        alert("Доступ к микрофону запрещён. Разреши его в настройках браузера.");
      } else {
        alert("Не удалось включить запись: " + (e as Error).message);
      }
    }
  };

  // Стоп + отправка
  const stopRecording = () => {
    recordCancelledRef.current = false;
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      try { mediaRecorder.current.stop(); } catch { /* ignore */ }
    } else {
      if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
      setRecording(false);
    }
  };

  // Отмена без отправки
  const cancelRecording = () => {
    recordCancelledRef.current = true;
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      try { mediaRecorder.current.stop(); } catch { /* ignore */ }
    } else {
      if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
      setRecording(false);
    }
  };

  return {
    uploading, uploadLabel, recording, recordSec,
    mediaRecorder, recordTimer,
    sendFile, sendFiles, startRecording, stopRecording, cancelRecording,
  };
}

export default useChatMedia;