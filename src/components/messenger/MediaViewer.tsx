import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { saveMedia, shareMedia, copyImage, makeStickerFile } from "@/lib/saveMedia";
import ForwardMediaDialog from "@/components/messenger/ForwardMediaDialog";
import { useMediaActions } from "@/components/messenger/MediaActionsContext";
import { MenuList, PhotoLongPressMenu, type PhotoMenuItem } from "@/components/messenger/MediaPhotoMenu";
import { api, uploadMedia, type User } from "@/lib/api";
import native from "@/lib/native";

export interface MediaItem {
  url: string;
  type: "image" | "video";
  msgId?: number;
}

function storedUser(): User | null {
  try { return JSON.parse(localStorage.getItem("nova_user") || "null"); } catch { return null; }
}

export function MediaViewer({
  items,
  startIndex = 0,
  onClose,
}: {
  items: MediaItem[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(Math.max(0, Math.min(startIndex, items.length - 1)));
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(true);
  const [showChrome, setShowChrome] = useState(true);
  const chromeTimer = useRef<number | null>(null);
  // Свайп / drag-to-dismiss
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragAxis = useRef<"y" | "x" | null>(null);
  // Pinch zoom (для image)
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);

  const current = items[index];
  const [menuOpen, setMenuOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const canForward = !!localStorage.getItem("nova_user");
  const [saving, setSaving] = useState(false);
  const actions = useMediaActions();
  const msgId = current?.msgId && current.msgId > 0 ? current.msgId : null;
  const act = actions && msgId ? actions : null;
  const [pressMenu, setPressMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = (t: string) => {
    setToast(t);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  };

  const download = async () => {
    if (!current || saving) return;
    setMenuOpen(false);
    setSaving(true);
    try {
      const r = await saveMedia(current.url, current.type);
      if (r === "saved") showToast(current.type === "video" ? "Видео сохранено в галерею" : "Фото сохранено в галерею");
      else if (r === "downloaded") showToast("Файл скачан");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    setMenuOpen(false);
    try { await shareMedia(current.url); } catch { showToast("Не удалось поделиться"); }
  };

  const closeMenus = () => { setMenuOpen(false); setPressMenu(false); };

  const leaveThen = (fn: () => void) => {
    closeMenus();
    setClosing(true);
    setTimeout(() => { onClose(); fn(); }, 200);
  };

  const copy = async () => {
    closeMenus();
    try {
      const r = await copyImage(current.url);
      showToast(r === "image" ? "Фото скопировано" : "Ссылка на фото скопирована");
    } catch { showToast("Не удалось скопировать"); }
  };

  const createSticker = async () => {
    closeMenus();
    const me = storedUser();
    if (!me) { showToast("Войдите в аккаунт"); return; }
    if (busy) return;
    setBusy(true);
    showToast("Создаём стикер…");
    try {
      const file = await makeStickerFile(current.url);
      const up = await uploadMedia(file, me.id);
      const r = await api("stickers_add_personal", { image_url: up.url }, me.id);
      if (r?.error) throw new Error(r.error);
      native.haptic.light();
      showToast("Стикер добавлен в «Мои стикеры»");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не удалось создать стикер");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!act || !msgId) return;
    setConfirmDelete(false);
    closeMenus();
    try {
      await act.deleteNow(msgId);
      if (items.length <= 1) close();
      else { showToast("Удалено"); close(); }
    } catch { showToast("Не удалось удалить"); }
  };

  const doReact = async (emoji: string) => {
    if (!act || !msgId) return;
    setPressMenu(false);
    native.haptic.light();
    try { await act.react(msgId, emoji); showToast(`Реакция ${emoji}`); } catch { showToast("Не удалось поставить реакцию"); }
  };

  const doPin = async () => {
    if (!act || !msgId) return;
    const wasPinned = act.isPinned(msgId);
    closeMenus();
    try { await act.togglePin(msgId); showToast(wasPinned ? "Откреплено" : "Закреплено"); } catch { showToast("Не удалось закрепить"); }
  };

  const isVideo = current?.type === "video";
  const saveLabel = isVideo ? "Сохранить видео" : "Сохранить фото";

  const topMenu: PhotoMenuItem[] = [
    ...(act ? [{ key: "show", icon: "MessageSquareShare", label: "Показать в чате", onClick: () => leaveThen(() => act.showInChat(msgId!)) }] : []),
    ...(!isVideo ? [{ key: "sticker", icon: "Sticker", label: "Создать стикер", onClick: createSticker }] : []),
    { key: "save", icon: "CircleArrowDown", label: saveLabel, onClick: download },
    ...(act ? [{ key: "reply", icon: "Reply", label: "Ответить", onClick: () => leaveThen(() => act.reply(msgId!)) }] : []),
    ...(!act ? [{ key: "share", icon: "Share2", label: "Поделиться", onClick: share }] : []),
    ...(act && act.canDelete(msgId!) ? [{ key: "del", icon: "Trash2", label: "Удалить", danger: true, onClick: () => { closeMenus(); setConfirmDelete(true); } }] : []),
  ];

  const pressItems: PhotoMenuItem[] = [
    ...(act ? [{ key: "reply", icon: "Reply", label: "Ответить", onClick: () => leaveThen(() => act.reply(msgId!)) }] : []),
    ...(!isVideo ? [{ key: "copy", icon: "Copy", label: "Скопировать", onClick: copy }] : []),
    { key: "save", icon: "Download", label: saveLabel, onClick: download },
    ...(act && act.canPin ? [{ key: "pin", icon: act.isPinned(msgId!) ? "PinOff" : "Pin", label: act.isPinned(msgId!) ? "Открепить" : "Закрепить", onClick: doPin }] : []),
    ...(canForward ? [{ key: "fwd", icon: "Forward", label: "Переслать", onClick: () => { closeMenus(); setForwardOpen(true); } }] : []),
    ...(act && act.canDelete(msgId!) ? [{ key: "del", icon: "Trash2", label: "Удалить", danger: true, onClick: () => { closeMenus(); setConfirmDelete(true); } }] : []),
    ...(act ? [{ key: "select", icon: "CircleCheck", label: "Выбрать", divider: true, onClick: () => leaveThen(() => act.select(msgId!)) }] : []),
  ];

  const cancelPress = () => {
    if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
    pressStart.current = null;
  };

  const openPressMenu = () => {
    cancelPress();
    dragStartY.current = null;
    dragStartX.current = null;
    dragAxis.current = null;
    setDragY(0);
    setMenuOpen(false);
    native.haptic.medium();
    setPressMenu(true);
  };

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Авто-скрытие топ-бара через 2.5 сек (как в TG)
  const bumpChrome = useCallback(() => {
    setShowChrome(true);
    if (chromeTimer.current) window.clearTimeout(chromeTimer.current);
    chromeTimer.current = window.setTimeout(() => setShowChrome(false), 2500);
  }, []);

  useEffect(() => {
    // Открытие — fade-in
    const id = window.setTimeout(() => setOpening(false), 10);
    bumpChrome();
    return () => window.clearTimeout(id);
  }, [bumpChrome]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (forwardOpen) return;
      if (e.key === "Escape") {
        if (confirmDelete) { setConfirmDelete(false); return; }
        if (pressMenu || menuOpen) { setPressMenu(false); setMenuOpen(false); return; }
        close();
      }
      if (pressMenu || confirmDelete) return;
      if (e.key === "ArrowRight") { setIndex(i => Math.min(items.length - 1, i + 1)); bumpChrome(); }
      if (e.key === "ArrowLeft") { setIndex(i => Math.max(0, i - 1)); bumpChrome(); }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (chromeTimer.current) window.clearTimeout(chromeTimer.current);
    };
  }, [close, items.length, bumpChrome, forwardOpen, pressMenu, menuOpen, confirmDelete]);

  // Сброс zoom при смене медиа
  useEffect(() => {
    setScale(1); setPan({ x: 0, y: 0 }); setMenuOpen(false);
  }, [index]);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    bumpChrome();
    cancelPress();
    if (e.touches.length === 1 && scale === 1) {
      pressStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      pressTimer.current = window.setTimeout(openPressMenu, 450);
    }
    if (e.touches.length === 2 && current.type === "image") {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      pinchStart.current = { dist: Math.hypot(dx, dy), scale };
      dragStartY.current = null;
      dragStartX.current = null;
      return;
    }
    if (scale > 1) return;
    dragStartY.current = e.touches[0].clientY;
    dragStartX.current = e.touches[0].clientX;
    dragAxis.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (pressStart.current && e.touches[0]) {
      const mx = Math.abs(e.touches[0].clientX - pressStart.current.x);
      const my = Math.abs(e.touches[0].clientY - pressStart.current.y);
      if (mx > 10 || my > 10 || e.touches.length > 1) cancelPress();
    }
    if (e.touches.length === 2 && pinchStart.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const next = Math.max(1, Math.min(4, pinchStart.current.scale * (d / pinchStart.current.dist)));
      setScale(next);
      return;
    }
    if (dragStartY.current === null || dragStartX.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    const dx = e.touches[0].clientX - dragStartX.current;
    if (!dragAxis.current) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        dragAxis.current = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
      }
    }
    if (dragAxis.current === "y") {
      setDragY(dy);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    cancelPress();
    if (pinchStart.current && e.touches.length < 2) {
      pinchStart.current = null;
    }
    if (dragAxis.current === "y") {
      if (Math.abs(dragY) > 100) close();
      setDragY(0);
    } else if (dragAxis.current === "x" && dragStartX.current !== null) {
      const dx = (e.changedTouches[0]?.clientX ?? dragStartX.current) - dragStartX.current;
      if (dx < -50 && index < items.length - 1) { setIndex(i => i + 1); bumpChrome(); }
      if (dx > 50 && index > 0) { setIndex(i => i - 1); bumpChrome(); }
    }
    dragStartY.current = null;
    dragStartX.current = null;
    dragAxis.current = null;
  };

  const onDoubleClickImg = () => {
    setScale(s => (s > 1 ? 1 : 2));
    setPan({ x: 0, y: 0 });
  };

  const onContentClick = () => {
    if (pressMenu) return;
    if (menuOpen) { setMenuOpen(false); return; }
    setShowChrome(s => !s);
    if (chromeTimer.current) window.clearTimeout(chromeTimer.current);
  };

  if (!current) return null;

  const dragProgress = Math.min(1, Math.abs(dragY) / 400);
  const bgOpacity = closing || opening ? 0 : 1 - dragProgress * 0.7;
  const contentTransform = `translate3d(0, ${dragY}px, 0) scale(${closing || opening ? 0.94 : 1 - dragProgress * 0.08})`;
  const contentOpacity = closing || opening ? 0 : 1;

  const node = (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center select-none overscroll-none"
      style={{
        background: `rgba(0,0,0,${bgOpacity})`,
        transition: closing || opening
          ? "background 200ms ease-out"
          : (dragY === 0 ? "background 200ms ease-out" : "none"),
        touchAction: "none",
      }}
    >
      {/* Top bar (auto-hide) */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent"
        style={{
          paddingTop: "calc(0.75rem + env(safe-area-inset-top))",
          opacity: (showChrome || menuOpen) && !closing ? 1 : 0,
          transform: (showChrome || menuOpen) && !closing ? "translateY(0)" : "translateY(-8px)",
          transition: "opacity 200ms ease-out, transform 200ms ease-out",
          pointerEvents: (showChrome || menuOpen) && !closing ? "auto" : "none",
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white active:scale-95 transition"
          aria-label="Закрыть"
        >
          <Icon name="X" size={20} />
        </button>
        {items.length > 1 ? (
          <div className="text-white text-sm font-medium px-3 py-1 rounded-full bg-black/40 backdrop-blur">
            {index + 1} / {items.length}
          </div>
        ) : <div />}
        <div className="relative">
          <button
            onClick={() => { setMenuOpen(v => !v); bumpChrome(); }}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white active:scale-95 transition"
            aria-label="Ещё"
          >
            <Icon name="EllipsisVertical" fallback="MoreVertical" size={20} />
          </button>
          {menuOpen && (
            <MenuList items={topMenu} className="absolute right-0 top-12 min-w-[250px] animate-scale-in origin-top-right" />
          )}
        </div>
      </div>

      {/* Нижняя панель — как в Telegram */}
      {current.type === "image" && <div
        className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-3 p-4 bg-gradient-to-t from-black/70 to-transparent"
        style={{
          paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
          opacity: showChrome && !closing ? 1 : 0,
          transform: showChrome && !closing ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 200ms ease-out, transform 200ms ease-out",
          pointerEvents: showChrome && !closing ? "auto" : "none",
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={download}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 backdrop-blur text-white text-sm font-medium active:scale-95 transition disabled:opacity-60"
        >
          <Icon name={saving ? "Loader2" : "Download"} size={18} className={saving ? "animate-spin" : ""} />
          {saving ? "Сохраняем…" : "Скачать"}
        </button>
        {canForward && (
          <button
            onClick={() => setForwardOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 backdrop-blur text-white text-sm font-medium active:scale-95 transition"
          >
            <Icon name="Forward" size={18} />
            Переслать
          </button>
        )}
        <button
          onClick={share}
          className="w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white active:scale-95 transition"
          aria-label="Поделиться"
        >
          <Icon name="Share2" size={18} />
        </button>
      </div>}

      {pressMenu && (
        <PhotoLongPressMenu
          url={current.url}
          isVideo={isVideo}
          items={pressItems}
          onReact={act ? doReact : undefined}
          onClose={() => setPressMenu(false)}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[45] bg-black/60 flex items-center justify-center p-6 animate-fade-in"
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-xs rounded-3xl bg-[#232733] border border-white/10 p-5 text-white animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-1">{isVideo ? "Удалить видео?" : "Удалить фото?"}</h3>
            <p className="text-sm text-white/60 mb-5">Сообщение исчезнет у всех участников чата.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded-xl text-sm text-white/80 hover:bg-white/10">Отмена</button>
              <button onClick={doDelete} className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30">Удалить</button>
            </div>
          </div>
        </div>
      )}

      {forwardOpen && (
        <ForwardMediaDialog
          url={current.url}
          type={current.type}
          onClose={() => setForwardOpen(false)}
          onDone={(name) => { setForwardOpen(false); showToast(`Отправлено: ${name}`); }}
        />
      )}

      {toast && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-20 px-4 py-2.5 rounded-xl bg-[#1f1d2b]/95 text-white text-sm shadow-xl flex items-center gap-2 animate-fade-in"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        >
          <Icon name="CircleCheck" size={16} className="text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Содержимое: на весь экран */}
      <div
        className="w-screen h-[100dvh] flex items-center justify-center"
        style={{
          transform: contentTransform,
          opacity: contentOpacity,
          transition: closing || opening
            ? "transform 220ms cubic-bezier(0.22,0.61,0.36,1), opacity 200ms ease-out"
            : (dragY === 0 ? "transform 220ms cubic-bezier(0.22,0.61,0.36,1), opacity 200ms ease-out" : "none"),
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onContentClick}
      >
        {current.type === "image" ? (
          <img
            src={current.url}
            alt=""
            draggable={false}
            onDoubleClick={onDoubleClickImg}
            onContextMenu={(e) => { e.preventDefault(); openPressMenu(); }}
            className="w-screen h-[100dvh] object-contain select-none"
            style={{
              WebkitTouchCallout: "none",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transition: pinchStart.current ? "none" : "transform 150ms ease-out",
            }}
          />
        ) : (
          <video
            src={current.url}
            controls
            autoPlay
            playsInline
            className="w-screen h-[100dvh] object-contain bg-black"
          />
        )}
      </div>

      {/* Навигация (desktop) */}
      {items.length > 1 && (
        <>
          {index > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setIndex(i => i - 1); bumpChrome(); }}
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 backdrop-blur items-center justify-center text-white hover:bg-black/60 z-10"
              style={{ opacity: showChrome ? 1 : 0, transition: "opacity 200ms" }}
            >
              <Icon name="ChevronLeft" size={22} />
            </button>
          )}
          {index < items.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setIndex(i => i + 1); bumpChrome(); }}
              className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 backdrop-blur items-center justify-center text-white hover:bg-black/60 z-10"
              style={{ opacity: showChrome ? 1 : 0, transition: "opacity 200ms" }}
            >
              <Icon name="ChevronRight" size={22} />
            </button>
          )}
        </>
      )}
    </div>
  );

  return createPortal(node, document.body);
}
