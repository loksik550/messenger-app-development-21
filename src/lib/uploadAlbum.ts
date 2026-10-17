import { uploadMedia } from "@/lib/api";
import { compressImage } from "@/lib/compressImage";

export const MAX_ALBUM = 10;

/** Загружает несколько фото параллельно (по 3), сохраняя порядок. Пропускает неудачные. */
export async function uploadAlbum(
  files: File[],
  userId: number,
  onProgress?: (done: number, total: number) => void,
): Promise<{ urls: string[]; failed: number }> {
  const list = files.slice(0, MAX_ALBUM);
  const urls: (string | null)[] = new Array(list.length).fill(null);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      try {
        const f = await compressImage(list[i]);
        const r = await uploadMedia(f, userId);
        urls[i] = r.url;
      } catch (e) {
        console.error(e);
      }
      done++;
      onProgress?.(done, list.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const ok = urls.filter((u): u is string => !!u);
  return { urls: ok, failed: list.length - ok.length };
}
