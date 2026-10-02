import { useEffect, useRef, useState } from "react";
import { api, uploadMedia, type User, type Group, type GroupMessage } from "@/lib/api";

interface Params {
  group: Group;
  currentUser: User;
  setMessages: React.Dispatch<React.SetStateAction<GroupMessage[]>>;
  setLastSince: (v: number) => void;
  setShowAttach: (v: boolean) => void;
  toTime: (ts: number) => string;
}

/** Отправка файлов и запись голосовых сообщений в группе/канале. */
export function useGroupMedia({ group, currentUser, setMessages, setLastSince, setShowAttach, toTime }: Params) {
  const [, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordSecRef = useRef(0);
  const recordCancelledRef = useRef(false);
  const recStartingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
      const mr = mediaRecorder.current;
      if (mr && mr.state === "recording") {
        try { mr.stream?.getTracks().forEach(t => t.stop()); mr.stop(); } catch { /* noop */ }
      }
    };
  }, []);


  const sendFile = async (file: File, opts?: { duration?: number; mediaTypeOverride?: string }) => {
    const isVideo = opts?.mediaTypeOverride === "video";
    const MAX_FILE_MB = isVideo ? 4 : 4.5;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      alert(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум ${MAX_FILE_MB} МБ. Сожми файл или запиши короче.`);
      return;
    }
    setUploading(true); setShowAttach(false);
    try {
      const result = await uploadMedia(file, currentUser.id);
      const mediaType = (opts?.mediaTypeOverride || result.media_type) as "audio" | "video" | "image" | "file";
      const d = await api("send_group_message", {
        group_id: group.id, media_type: mediaType, media_url: result.url,
        file_name: result.file_name, file_size: result.file_size,
        duration: opts?.duration,
      }, currentUser.id);
      if (d.id) {
        setMessages(prev => [...prev, {
          id: d.id, sender_id: currentUser.id, sender_name: currentUser.name,
          sender_avatar: currentUser.avatar_url, text: "", created_at: d.created_at,
          time: toTime(d.created_at), out: true, kind: "text",
          media_type: mediaType, media_url: result.url,
          file_name: result.file_name, file_size: result.file_size,
          duration: opts?.duration,
        }]);
        setLastSince(d.created_at);
      }
    } catch (uploadErr) {
      console.error(uploadErr);
      alert("Не удалось отправить файл. Попробуй ещё раз или выбери файл меньшего размера.");
    } finally { setUploading(false); }
  };

  const startRecording = async () => {
    if (recStartingRef.current || recording) return;
    recStartingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
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
      mediaRecorder.current = mr; audioChunks.current = []; recordCancelledRef.current = false;
      mr.ondataavailable = e => { if (e.data && e.data.size > 0) audioChunks.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
        setRecording(false);
        if (recordCancelledRef.current) return;
        const realType = mr.mimeType || mime || "audio/webm";
        const ext = realType.includes("mp4") ? "m4a" : realType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(audioChunks.current, { type: realType });
        if (blob.size < 500 || recordSecRef.current < 1) return; // слишком короткая запись — не отправляем
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: realType });
        await sendFile(file, { duration: recordSecRef.current, mediaTypeOverride: "audio" });
      };
      mr.start();
      setRecording(true); setRecordSec(0); recordSecRef.current = 0;
      if (recordTimer.current) clearInterval(recordTimer.current);
      recordTimer.current = setInterval(() => setRecordSec(s => {
        const next = s + 1; recordSecRef.current = next;
        if (next >= 300) {
          if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
            try { mediaRecorder.current.stop(); } catch { /* ignore */ }
          }
          return 300;
        }
        return next;
      }), 1000);
    } catch (e) {
      const name = (e as DOMException).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        alert("Доступ к микрофону запрещён. Разреши его в настройках браузера.");
      } else {
        alert("Нет доступа к микрофону");
      }
    } finally {
      recStartingRef.current = false;
    }
  };

  const stopRecording = () => {
    recordCancelledRef.current = false;
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      try { mediaRecorder.current.stop(); } catch { /* ignore */ }
    } else {
      if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
      setRecording(false);
    }
  };

  const cancelRecording = () => {
    recordCancelledRef.current = true;
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      try { mediaRecorder.current.stop(); } catch { /* ignore */ }
    } else {
      if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
      setRecording(false);
    }
  };

  return { recording, recordSec, sendFile, startRecording, stopRecording, cancelRecording };
}
