import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

function extFrom(url: string, mime: string) {
  const m = url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
  if (m) return m[1].toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
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
export async function saveMedia(url: string, kind: "image" | "video" = "image"): Promise<SaveResult> {
  const blob = await fetchBlob(url);
  const ext = extFrom(url, blob.type);
  const name = `Nova_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}.${ext}`;

  if (Capacitor.isNativePlatform()) {
    const data = await blobToBase64(blob);
    const folder = kind === "video" ? "Movies/Nova" : "Pictures/Nova";
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

  const file = new File([blob], name, { type: blob.type || (kind === "video" ? "video/mp4" : "image/jpeg") });
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
