import { useEffect, useRef, useState } from "react";
import { getSendOriginal } from "@/lib/originalQuality";
import { api, uploadAny, FileTooLargeError, type User, type Group, type GroupMessage } from "@/lib/api";
import { uploadAlbum, MAX_ALBUM } from "@/lib/uploadAlbum";

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
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("Загружаем...");
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
    const original = !!currentUser.is_pro && getSendOriginal() && !opts?.mediaTypeOverride
      && (file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (file.type.startsWith("image/") && !opts?.mediaTypeOverride && !original) {
      const { compressImage } = await import("@/lib/compressImage");
      file = await compressImage(file);
    }
    setUploading(true); setShowAttach(false);
    const kindLabel = file.type.startsWith("video/") ? "видео" : file.type.startsWith("audio/") ? "аудио" : file.type.startsWith("image/") ? "фото" : "файл";
    try {
      const result = await uploadAny(file, currentUser.id, (done, total) => setUploadLabel(`Загружаем ${kindLabel}: ${Math.floor((done / Math.max(total, 1)) * 100)}%`), { original });
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
      if (uploadErr instanceof FileTooLargeError) {
        window.dispatchEvent(new CustomEvent("nova:file-too-large", { detail: { message: uploadErr.message, isPro: uploadErr.isPro, proMb: uploadErr.proMb, limitMb: uploadErr.limitMb } }));
        return;
      }
      const reason = uploadErr instanceof Error && uploadErr.message ? `\n\nПричина: ${uploadErr.message}` : "";
      alert(`Не удалось отправить файл. Проверь интернет и попробуй ещё раз.${reason}`);
    } finally { setUploading(false); setUploadLabel("Загружаем..."); }
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
        const realType = (mr.mimeType || mime || "audio/webm").split(";")[0].trim() || "audio/webm";
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

  const sendFiles = async (files: File[]) => {
    const list = files.filter(Boolean);
    if (list.length === 0) return;
    const images = list.filter(f => f.type.startsWith("image/") && !/gif|svg/i.test(f.type));
    if (list.length === 1 || images.length < 2) {
      for (const f of list) await sendFile(f);
      return;
    }
    if (images.length > MAX_ALBUM) alert(`За раз можно отправить до ${MAX_ALBUM} фото — отправим первые ${MAX_ALBUM}.`);
    setUploading(true); setShowAttach(false);
    setUploadLabel(`Загружаем фото 0/${Math.min(images.length, MAX_ALBUM)}...`);
    try {
      const original = !!currentUser.is_pro && getSendOriginal();
      const { urls, failed } = await uploadAlbum(images, currentUser.id, (d, t) => setUploadLabel(`Загружаем фото ${d}/${t}...`), { original });
      if (urls.length === 0) throw new Error("Ни одно фото не загрузилось");
      const payload = urls.length > 1 ? { album: urls.map(url => ({ url })) } : null;
      const d = await api("send_group_message", {
        group_id: group.id, media_type: "image", media_url: urls[0], file_name: "photo.jpg",
        payload: payload || undefined,
      }, currentUser.id);
      if (!d?.id) throw new Error(d?.error || "Сервер не принял сообщение");
      setMessages(prev => prev.some(m => m.id === d.id) ? prev : [...prev, {
        id: d.id, sender_id: currentUser.id, sender_name: currentUser.name,
        sender_avatar: currentUser.avatar_url, text: "", created_at: d.created_at,
        time: toTime(d.created_at), out: true, kind: "text",
        media_type: "image", media_url: urls[0], payload,
      }]);
      setLastSince(d.created_at);
      if (failed > 0) alert(`Не загрузилось фото: ${failed}. Остальные отправлены.`);
    } catch (e) {
      console.error(e);
      alert(`Не удалось отправить фото. Проверь интернет и попробуй ещё раз.${e instanceof Error && e.message ? `\n\nПричина: ${e.message}` : ""}`);
    } finally {
      setUploading(false);
      setUploadLabel("Загружаем...");
    }
  };

  return { recording, recordSec, sendFile, sendFiles, uploading, uploadLabel, startRecording, stopRecording, cancelRecording };
}