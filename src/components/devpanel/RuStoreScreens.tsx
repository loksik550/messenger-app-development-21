import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { rustoreCall, type Screen, type StoreScreen } from "./rustoreApi";

const MAX = 10;
const MIN = 3;
const SAFE_BYTES = 2_000_000;

interface Props {
  screens: Screen[];
  storeScreens: StoreScreen[];
  onChange: (s: Screen[]) => void;
}

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`«${file.name}» не открывается как картинка`));
    };
    img.src = url;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("Не удалось прочитать файл"));
    r.readAsDataURL(blob);
  });
}

async function prepare(file: File): Promise<string> {
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    throw new Error(`«${file.name}»: нужен PNG или JPG`);
  }
  const img = await readImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  URL.revokeObjectURL(img.src);
  if (Math.min(w, h) < 320) {
    throw new Error(`«${file.name}» ${w}×${h}: слишком маленькая картинка, нужно хотя бы 320 пикселей по короткой стороне`);
  }
  const ratio = Math.max(w, h) / Math.min(w, h);
  const exact = Math.abs(ratio - 16 / 9) <= 0.05 && Math.max(w, h) <= 3840;
  if (exact && file.size <= SAFE_BYTES) return blobToBase64(file);

  const portrait = h >= w;
  let cw = w;
  let ch = h;
  if (!exact) {
    if (portrait) {
      cw = Math.max(w, Math.round((h * 9) / 16));
      ch = Math.round((cw * 16) / 9);
    } else {
      ch = Math.max(h, Math.round((w * 9) / 16));
      cw = Math.round((ch * 16) / 9);
    }
  }
  const k = Math.min(1, 3840 / Math.max(cw, ch));
  cw = Math.round(cw * k);
  ch = Math.round(ch * k);
  const dw = Math.round(w * k);
  const dh = Math.round(h * k);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не смог обработать картинку");
  ctx.fillStyle = "#0b0b14";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, Math.round((cw - dw) / 2), Math.round((ch - dh) / 2), dw, dh);
  for (const q of [0.9, 0.8, 0.7, 0.6]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
    if (blob && blob.size <= SAFE_BYTES) return blobToBase64(blob);
  }
  throw new Error(`«${file.name}» слишком тяжёлый — уменьшите его`);
}

export default function RuStoreScreens({ screens, storeScreens, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, MAX - screens.length);
    const errs: string[] = [];
    if (files.length > list.length) errs.push(`Лишние файлы пропущены — всего можно ${MAX} скриншотов`);
    setBusy(true);
    setErrors([]);
    let current = screens;
    for (let i = 0; i < list.length; i++) {
      setProgress(`Загружаю ${i + 1} из ${list.length}…`);
      try {
        const data = await prepare(list[i]);
        const r = await rustoreCall<{ screens: Screen[] }>("screens_add", { data });
        current = r.screens;
        onChange(current);
      } catch (e) {
        errs.push(e instanceof Error ? e.message : `«${list[i].name}» не загрузился`);
      }
    }
    setErrors(errs);
    setBusy(false);
    setProgress("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async (id: number) => {
    setBusy(true);
    setErrors([]);
    try {
      const r = await rustoreCall<{ screens: Screen[] }>("screens_delete", { id });
      onChange(r.screens);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Не удалось удалить"]);
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= screens.length) return;
    const next = [...screens];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
    setBusy(true);
    try {
      const r = await rustoreCall<{ screens: Screen[] }>("screens_reorder", { ids: next.map((s) => s.id) });
      onChange(r.screens);
    } catch (e) {
      onChange(screens);
      setErrors([e instanceof Error ? e.message : "Не удалось поменять порядок"]);
    } finally {
      setBusy(false);
    }
  };

  const count = screens.length;
  const notEnough = count > 0 && count < MIN;
  const landscape = screens[0]?.orientation === "LANDSCAPE";

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
      <div className="flex items-start gap-3 mb-1">
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">Скриншоты для карточки в RuStore</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Уйдут в RuStore вместе со следующей версией. PNG или JPG, от 3 до 10 штук, все одной ориентации. Лучше всего 1080×1920 — картинки других пропорций панель сама дополнит тёмными полями до 9:16.
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${notEnough ? "border-amber-500/30 text-amber-300 bg-amber-500/10" : "border-white/10 text-slate-400"}`}>
          {count} / {MAX}
        </span>
      </div>

      {count === 0 ? (
        <div className="mt-3 text-xs text-slate-500">
          Пока не загружено ни одного — при отправке в RuStore останутся текущие скриншоты карточки.
        </div>
      ) : notEnough ? (
        <div className="mt-3 text-xs text-amber-300">
          Нужно минимум {MIN} — добавьте ещё {MIN - count} или удалите все, чтобы оставить прежние.
        </div>
      ) : (
        <div className="mt-3 text-xs text-emerald-300">Готово: при отправке новой версии эти скриншоты заменят старые.</div>
      )}

      <div className={`mt-3 grid gap-3 ${landscape ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-5"}`}>
        {screens.map((s, i) => (
          <div key={s.id} className="group relative rounded-xl overflow-hidden border border-white/10 bg-black/30">
            <button onClick={() => setPreview(s.url)} className="block w-full">
              <img
                src={s.url}
                alt={`Скриншот ${i + 1}`}
                className={`w-full object-cover ${s.orientation === "LANDSCAPE" ? "aspect-video" : "aspect-[9/16]"}`}
                loading="lazy"
              />
            </button>
            <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/70 text-[10px] text-white flex items-center justify-center">
              {i + 1}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex justify-between p-1 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex gap-1">
                <button
                  disabled={busy || i === 0}
                  onClick={() => move(i, -1)}
                  className="w-6 h-6 rounded-md bg-black/60 text-white flex items-center justify-center disabled:opacity-30"
                  title="Левее"
                >
                  <Icon name="ChevronLeft" size={14} />
                </button>
                <button
                  disabled={busy || i === count - 1}
                  onClick={() => move(i, 1)}
                  className="w-6 h-6 rounded-md bg-black/60 text-white flex items-center justify-center disabled:opacity-30"
                  title="Правее"
                >
                  <Icon name="ChevronRight" size={14} />
                </button>
              </div>
              <button
                disabled={busy}
                onClick={() => remove(s.id)}
                className="w-6 h-6 rounded-md bg-red-500/80 text-white flex items-center justify-center disabled:opacity-30"
                title="Удалить"
              >
                <Icon name="Trash2" size={13} />
              </button>
            </div>
          </div>
        ))}

        {count < MAX && (
          <button
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed border-white/15 hover:border-sky-500/50 hover:bg-sky-500/5 text-slate-400 flex flex-col items-center justify-center gap-1.5 text-xs transition disabled:opacity-50 ${landscape ? "aspect-video" : "aspect-[9/16]"}`}
          >
            {busy && progress ? (
              <>
                <Icon name="Loader2" size={20} className="animate-spin" />
                <span className="px-2 text-center">{progress}</span>
              </>
            ) : (
              <>
                <Icon name="ImagePlus" size={20} />
                Добавить
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />

      {errors.length > 0 && (
        <div className="mt-3 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300 space-y-1">
          {errors.map((e, i) => (
            <div key={i} className="flex gap-2">
              <Icon name="AlertTriangle" size={14} className="flex-shrink-0 mt-0.5" />
              {e}
            </div>
          ))}
        </div>
      )}

      {storeScreens.length > 0 && (
        <div className="mt-5">
          <div className="text-xs text-slate-500 mb-2">Сейчас в карточке RuStore</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {storeScreens.map((s) => (
              <button key={s.id} onClick={() => setPreview(s.url)} className="flex-shrink-0">
                <img
                  src={s.url}
                  alt=""
                  className={`rounded-lg border border-white/10 object-cover ${s.orientation === "LANDSCAPE" ? "h-16 aspect-video" : "h-24 aspect-[9/16]"}`}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <img src={preview} alt="" className="max-h-[90vh] max-w-full rounded-xl" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center">
            <Icon name="X" size={20} />
          </button>
        </div>
      )}
    </div>
  );
}