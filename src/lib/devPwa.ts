import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  const prev = el.href;
  el.href = href;
  return () => { if (el) el.href = prev; };
}

function setMeta(name: string, content: string) {
  const el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) return () => {};
  const prev = el.content;
  el.content = content;
  return () => { el.content = prev; };
}

function getBuildId(doc: Document) {
  const el = doc.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]');
  return el ? el.getAttribute("src") : null;
}

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: window-controls-overlay)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Делает Dev-панель отдельным устанавливаемым приложением и следит за обновлениями. */
export function useDevPwa() {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const [installed, setInstalled] = useState(isStandalone());
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const undo = [
      setLink("manifest", "/dev-manifest.json"),
      setLink("apple-touch-icon", "/dev-icon-192.png"),
      setMeta("theme-color", "#0f0f17"),
      setMeta("apple-mobile-web-app-title", "Nova Dev"),
    ];
    const sync = () => { setCanInstall(!!deferredPrompt); setInstalled(isStandalone()); };
    listeners.add(sync);
    sync();
    return () => { listeners.delete(sync); undo.forEach((u) => u()); };
  }, []);

  useEffect(() => {
    const current = getBuildId(document);
    if (!current) return;
    const check = async () => {
      try {
        const res = await fetch(`/?_=${Date.now()}`, { cache: "no-store" });
        const html = await res.text();
        const next = getBuildId(new DOMParser().parseFromString(html, "text/html"));
        if (next && next !== current) setUpdateReady(true);
      } catch { /* offline */ }
    };
    const timer = setInterval(check, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    check();
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notify();
    return outcome === "accepted";
  };

  const applyUpdate = async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
    } catch { /* ignore */ }
    window.location.reload();
  };

  return { canInstall, installed, updateReady, install, applyUpdate };
}
