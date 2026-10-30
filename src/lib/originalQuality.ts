const KEY = "nova_send_original";

/** Отправлять фото без сжатия (Nova Pro). Читается только в обработчиках событий. */
export function getSendOriginal(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function setSendOriginal(v: boolean) {
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("nova:send-original", { detail: v }));
}
