import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { rustoreCall, type SavedIcon } from "./rustoreApi";

const SIZE = 512;

function toIconBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      reject(new Error("Нужен файл PNG или JPG"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (Math.min(w, h) < 256) {
        reject(new Error(`Картинка ${w}×${h} слишком маленькая — нужна хотя бы 512×512`));
        return;
      }
      const side = Math.min(w, h);
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Браузер не смог обработать картинку"));
        return;
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Не удалось подготовить иконку"));
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = () => reject(new Error("Не удалось прочитать файл"));
        r.readAsDataURL(blob);
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Файл не открывается как картинка"));
    };
    img.src = url;
  });
}

interface Props {
  icon: SavedIcon | null;
  onChange: (icon: SavedIcon | null) => void;
}

export default function RuStoreIcon({ icon, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const data = await toIconBase64(file);
      const r = await rustoreCall<{ icon: SavedIcon }>("icon_set", { data });
      onChange(r.icon);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить иконку");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await rustoreCall("icon_delete");
      onChange(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
      <div className="flex items-start gap-4">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="relative w-20 h-20 rounded-[22px] overflow-hidden border border-white/10 bg-black/30 flex-shrink-0 flex items-center justify-center text-slate-500 hover:border-sky-500/50 transition disabled:opacity-60"
          title="Выбрать иконку"
        >
          {icon ? (
            <img src={icon.url} alt="Новая иконка" className="w-full h-full object-cover" />
          ) : (
            <Icon name="ImagePlus" size={24} />
          )}
          {busy && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Icon name="Loader2" size={20} className="animate-spin text-white" />
            </div>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">Иконка приложения в RuStore</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Уйдёт в RuStore вместе со следующей версией. Квадратная картинка PNG или JPG — панель сама обрежет её по центру и приведёт к 512×512.
          </div>
          <div className={`mt-2 text-xs ${icon ? "text-emerald-300" : "text-slate-500"}`}>
            {icon ? "Готово: при отправке новой версии эта иконка заменит текущую." : "Новая иконка не выбрана — в RuStore останется текущая."}
          </div>
          <div className="mt-3 flex gap-3 text-sm">
            <button onClick={() => inputRef.current?.click()} disabled={busy} className="text-sky-400 hover:text-sky-300 disabled:opacity-50">
              {icon ? "Заменить" : "Загрузить иконку"}
            </button>
            {icon && (
              <button onClick={remove} disabled={busy} className="text-red-400 hover:text-red-300 disabled:opacity-50">
                Убрать
              </button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />

      {error && (
        <div className="mt-3 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300 flex gap-2">
          <Icon name="AlertTriangle" size={14} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </div>
  );
}
