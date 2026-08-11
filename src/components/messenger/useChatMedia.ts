import { useState, useRef, useEffect } from "react";
import { api, uploadMedia, type Chat, type Message, type User } from "@/lib/api";

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
    const isVideo = extra?.mediaTypeOverride === "video";
    const MAX_FILE_MB = isVideo ? 4 : 4.5;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      alert(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум ${MAX_FILE_MB} МБ. Сожми файл или запиши короче.`);
      return;
    }
    setUploading(true);
    setShowAttach(false);
    const labelMap: Record<string, string> = { image: "Загружаем фото...", video: "Загружаем видео...", audio: "Загружаем аудио...", file: "Загружаем файл..." };
    try {
      const result = await uploadMedia(file, currentUser.id);
      const finalMediaType = extra?.mediaTypeOverride || result.media_type;
      setUploadLabel(labelMap[finalMediaType] || "Загружаем...");
      const data = await api("send_message", {
        chat_id: chat.id,
        media_type: finalMediaType,
        media_url: result.url,
        file_name: result.file_name,
        file_size: result.file_size,
        duration: extra?.duration,
      }, currentUser.id);
      if (data.id) {
        const timeStr = new Date(data.created_at * 1000).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
        setMessages(prev => [...prev, {
          id: data.id,
          text: data.text || "",
          time: timeStr,
          out: true,
          created_at: data.created_at,
          media_type: finalMediaType,
          media_url: result.url,
          image_url: finalMediaType === "image" ? result.url : undefined,
          file_name: result.file_name,
          file_size: result.file_size,
          duration: extra?.duration,
          reactions: [],
        }]);
        setLastSince(data.created_at);
      }
    } catch (uploadErr) {
      console.error(uploadErr);
      alert("Не удалось отправить файл. Попробуй ещё раз или выбери файл меньшего размера.");
    } finally { setUploading(false); }
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
        const realType = mr.mimeType || mime || "audio/webm";
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
    sendFile, startRecording, stopRecording, cancelRecording,
  };
}

export default useChatMedia;
