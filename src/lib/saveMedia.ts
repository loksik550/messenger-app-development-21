import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

function extFrom(url: string, mime: string) {
  const m = url.startsWith("blob:") ? null : url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
  if (m) return m[1].toLowerCase();
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("audio/mp4")) return "m4a";
  if (mime.includes("pdf")) return "pdf";
  return "jpg";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Не удалось скачать (${res.status})`);
  return res.blob();
}

export type SaveResult = "saved" | "shared" | "downloaded";

/** Сохраняет фото/видео из чата на устройство. */
export async function saveMedia(url: string, kind: "image" | "video" | "audio" | "file" = "image"): Promise<SaveResult> {
  const blob = await fetchBlob(url);
  const ext = extFrom(url, blob.type);
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const name = `Nova_${stamp}.${ext}`;

  if (Capacitor.isNativePlatform()) {
    const data = await blobToBase64(blob);
    const folder = kind === "video" ? "Movies/Nova" : kind === "audio" ? "Music/Nova" : kind === "file" ? "Download/Nova" : "Pictures/Nova";
    try {
      await Filesystem.writeFile({ path: `${folder}/${name}`, data, directory: Directory.ExternalStorage, recursive: true });
      return "saved";
    } catch {
      try {
        await Filesystem.writeFile({ path: `Nova/${name}`, data, directory: Directory.Documents, recursive: true });
        return "saved";
      } catch {
        const res = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
        await Share.share({ title: name, url: res.uri, dialogTitle: "Сохранить" });
        return "shared";
      }
    }
  }

  const file = new File([blob], name, { type: blob.type || (kind === "video" ? "video/mp4" : kind === "audio" ? "audio/webm" : "image/jpeg") });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  const isMobile = window.matchMedia?.("(pointer: coarse)").matches;
  if (isMobile && nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: name });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "shared";
    }
  }
  const obj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = obj;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(obj); }, 2000);
  return "downloaded";
}

export async function shareMedia(url: string) {
  if (Capacitor.isNativePlatform()) {
    const blob = await fetchBlob(url);
    const name = `Nova_share.${extFrom(url, blob.type)}`;
    const res = await Filesystem.writeFile({ path: name, data: await blobToBase64(blob), directory: Directory.Cache });
    await Share.share({ url: res.uri, dialogTitle: "Поделиться" });
    return;
  }
  if (navigator.share) {
    try { await navigator.share({ url }); return; } catch { /* отмена */ }
  }
  await navigator.clipboard?.writeText(url);
}
function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось открыть фото"));
    img.src = url;
  });
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const obj = URL.createObjectURL(blob);
  try { return await loadImg(obj); } finally { setTimeout(() => URL.revokeObjectURL(obj), 1000); }
}

function canvasBlob(c: HTMLCanvasElement, type: string, q?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Ошибка обработки"))), type, q));
}

export type CopyResult = "image" | "link";

/** Копирует фото в буфер обмена (если устройство не умеет — копирует ссылку). */
export async function copyImage(url: string): Promise<CopyResult> {
  try {
    const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if (CI && navigator.clipboard?.write) {
      const png = (async () => {
        const img = await blobToImage(await fetchBlob(url));
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext("2d")!.drawImage(img, 0, 0);
        return canvasBlob(c, "image/png");
      })();
      await navigator.clipboard.write([new CI({ "image/png": png })]);
      return "image";
    }
  } catch { /* fallback ниже */ }
  const { native } = await import("@/lib/native");
  const ok = await native.clipboard.write(url);
  if (!ok) throw new Error("Не удалось скопировать");
  return "link";
}

/** Делает из фото квадратный стикер 512×512 с прозрачными скруглёнными краями. */
export async function makeStickerFile(url: string): Promise<File> {
  const img = await blobToImage(await fetchBlob(url));
  const S = 512;
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d")!;
  const r = 72;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(S, 0, S, S, r);
  ctx.arcTo(S, S, 0, S, r);
  ctx.arcTo(0, S, 0, 0, r);
  ctx.arcTo(0, 0, S, 0, r);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);
  const blob = await canvasBlob(c, "image/png");
  return new File([blob], `sticker_${Date.now()}.png`, { type: "image/png" });
}
