const SKIP = /image\/(gif|svg\+xml)/i;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Уменьшает фото до разумного размера перед отправкой (как в Telegram). */
export async function compressImage(file: File, maxSide = 2048, targetBytes = 1.5 * 1024 * 1024): Promise<File> {
  if (!file.type.startsWith("image/") || SKIP.test(file.type) || file.name.startsWith("sticker_")) return file;
  if (file.size <= 400 * 1024 && /jpe?g|webp/i.test(file.type)) return file;
  try {
    const img = await loadImage(file);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) return file;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    let blob: Blob | null = null;
    for (const q of [0.85, 0.75, 0.6, 0.5]) {
      blob = await toBlob(canvas, q);
      if (blob && blob.size <= targetBytes) break;
    }
    if (!blob || blob.size >= file.size) return file;
    const name = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
