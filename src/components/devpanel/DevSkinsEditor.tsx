import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi } from "@/lib/devApi";
import { SKIN_BASES, type SkinBase } from "@/lib/skins";

interface SkinRow { id: string; name: string; base: SkinBase; image: string; ticker: string; active: boolean }
const EMPTY: SkinRow = { id: "", name: "", base: "rain", image: "", ticker: "", active: true };

function readFile(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
}

/** Сжимает картинку до 1080 px по ширине, чтобы фон быстро грузился на телефонах. */
async function compress(f: File): Promise<{ data: string; type: string }> {
  const src = await readFile(f);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
  const scale = Math.min(1, 1080 / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  return { data: c.toDataURL("image/jpeg", 0.82), type: "image/jpeg" };
}

/** Список тестовых тем: добавить свою картинку, выбрать стиль, задать бегущую строку. */
export default function DevSkinsEditor({ editable }: { editable: boolean }) {
  const [rows, setRows] = useState<SkinRow[] | null>(null);
  const [edit, setEdit] = useState<SkinRow | null>(null);
  const [file, setFile] = useState<{ data: string; type: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try { const r = await devApi<{ skins: SkinRow[] }>("test_skins_list"); setRows(r.skins || []); } catch { setRows([]); }
  };
  useEffect(() => { load(); }, []);

  const open = (s: SkinRow) => { setEdit({ ...s }); setFile(null); setErr(""); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setFile(await compress(f)); } catch { setErr("Не удалось прочитать картинку"); }
  };

  const save = async () => {
    if (!edit) return;
    setBusy(true); setErr("");
    try {
      await devApi("test_skin_save", {
        id: edit.id, name: edit.name, base: edit.base, ticker: edit.ticker, active: edit.active,
        image_base64: file?.data, image_type: file?.type,
      });
      setEdit(null); setFile(null);
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Ошибка"); }
    setBusy(false);
  };

  const remove = async (s: SkinRow) => {
    if (!confirm(`Удалить тему «${s.name}»?`)) return;
    await devApi("test_skin_delete", { id: s.id }).catch(() => null);
    load();
  };

  if (!rows) return <div className="text-sm text-slate-500">Загрузка тем...</div>;
  const preview = file?.data || edit?.image;

  return (
    <div className="rounded-2xl border border-white/10 p-5">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-bold flex-1">Темы</h3>
        {editable && (
          <button onClick={() => open({ ...EMPTY })} className="px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold flex items-center gap-1.5">
            <Icon name="Plus" size={15} /> Новая тема
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {rows.map((s) => (
          <div key={s.id} className={`rounded-2xl overflow-hidden border bg-white/[0.03] ${s.active ? "border-white/10" : "border-white/5 opacity-50"}`}>
            <img src={s.image} alt="" className="w-full aspect-[9/12] object-cover" />
            <div className="p-2.5">
              <div className="text-sm font-semibold truncate">{s.name}</div>
              <div className="text-[11px] text-slate-500">Стиль: {SKIN_BASES.find((b) => b.id === s.base)?.name}{s.ticker ? " · бегущая строка" : ""}{!s.active ? " · скрыта" : ""}</div>
              {editable && (
                <div className="flex gap-1.5 mt-2">
                  <button onClick={() => open(s)} className="flex-1 py-1.5 rounded-lg bg-white/5 text-xs">Изменить</button>
                  <button onClick={() => remove(s)} className="px-2 py-1.5 rounded-lg bg-red-500/15 text-red-300 text-xs" aria-label="Удалить"><Icon name="Trash2" size={13} /></button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEdit(null)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#14121f] border border-white/10 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">{edit.id ? "Изменить тему" : "Новая тема"}</h3>
            <div className="flex gap-4">
              <button onClick={() => inputRef.current?.click()} className="w-32 flex-shrink-0 aspect-[9/16] rounded-xl overflow-hidden border border-dashed border-white/20 bg-black/30 flex items-center justify-center relative">
                {preview ? <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" /> : (
                  <span className="text-xs text-slate-400 text-center px-2"><Icon name="ImagePlus" size={22} className="mx-auto mb-1" />Загрузить фон</span>
                )}
              </button>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
              <div className="flex-1 space-y-3">
                <label className="block">
                  <span className="text-xs text-slate-500 mb-1 block">Название</span>
                  <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value.slice(0, 40) })} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none" />
                </label>
                <div>
                  <span className="text-xs text-slate-500 mb-1 block">Стиль кнопок и плашек</span>
                  <div className="space-y-1.5">
                    {SKIN_BASES.map((b) => (
                      <button key={b.id} onClick={() => setEdit({ ...edit, base: b.id })} className={`w-full text-left px-3 py-2 rounded-xl text-xs border ${edit.base === b.id ? "border-violet-500 bg-violet-500/15" : "border-white/10 bg-white/[0.03]"}`}>
                        <b>{b.name}</b> <span className="text-slate-400">— {b.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Лучше вертикальная картинка. Её сожмём до 1080 px, чтобы быстро грузилась.</p>
            <label className="block mt-3">
              <span className="text-xs text-slate-500 mb-1 block">Бегущая строка под вкладками (пусто — не показывать)</span>
              <textarea value={edit.ticker} onChange={(e) => setEdit({ ...edit, ticker: e.target.value.slice(0, 600) })} rows={3}
                placeholder="NOVA NEWS: Магазин открыт  •  Новые эффекты имени"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none resize-none" />
            </label>
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              Показывать тестерам
            </label>
            {err && <p className="text-sm text-red-300 mt-2">{err}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEdit(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-sm">Отмена</button>
              <button onClick={save} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50">{busy ? "Сохраняем..." : "Сохранить"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
