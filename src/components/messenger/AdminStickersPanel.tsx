import { useState } from "react";
import Icon from "@/components/ui/icon";
import { CHAT_API, uploadMedia, type User } from "@/lib/api";
import { authHeaders } from "@/lib/authToken";

interface Item {
  emoji: string;
  image_url: string;
  uploading?: boolean;
  error?: string;
}

export function AdminStickersPanel({ currentUser, onClose }: { currentUser: User; onClose: () => void }) {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem("nova_admin_token") || "");
  const [authed, setAuthed] = useState<boolean>(!!sessionStorage.getItem("nova_admin_token"));
  const [authInput, setAuthInput] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [price, setPrice] = useState<string>("0");
  const [isPremium, setIsPremium] = useState(false);
  const [authorId, setAuthorId] = useState<string>(String(currentUser.id));
  const [items, setItems] = useState<Item[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const callApi = async (action: string, payload: Record<string, unknown>) => {
    const res = await fetch(CHAT_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(currentUser.id),
        "X-Admin-Password": token,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    return await res.json();
  };

  const tryAuth = () => {
    if (!authInput.trim()) return;
    sessionStorage.setItem("nova_admin_token", authInput.trim());
    setToken(authInput.trim());
    setAuthed(true);
  };

  const onCoverFile = async (file: File) => {
    setCoverUploading(true); setError("");
    try {
      const r = await uploadMedia(file, currentUser.id);
      setCoverUrl(r.url);
    } catch (e) {
      setError((e as Error).message || "Ошибка загрузки обложки");
    } finally {
      setCoverUploading(false);
    }
  };

  const onItemFile = async (idx: number, file: File) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, uploading: true, error: "" } : it));
    try {
      const r = await uploadMedia(file, currentUser.id);
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, uploading: false, image_url: r.url } : it));
    } catch (e) {
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, uploading: false, error: (e as Error).message || "Ошибка" } : it));
    }
  };

  const addItem = () => setItems(prev => [...prev, { emoji: "", image_url: "" }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: Partial<Item>) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const submit = async () => {
    setError(""); setSuccess("");
    if (!title.trim() || title.trim().length < 2) { setError("Название от 2 символов"); return; }
    const valid = items.filter(it => it.image_url);
    if (valid.length < 1) { setError("Добавь хотя бы один стикер с картинкой"); return; }
    setBusy(true);
    const r = await callApi("stickers_create_pack", {
      title: title.trim(),
      description: description.trim(),
      cover_url: coverUrl || null,
      price: parseFloat(price) || 0,
      is_premium: isPremium,
      author_id: parseInt(authorId, 10) || null,
      items: valid.map(it => ({ emoji: it.emoji, image_url: it.image_url })),
    });
    setBusy(false);
    if (r.pack_id) {
      setSuccess(`Пак #${r.pack_id} опубликован!`);
      setTitle(""); setDescription(""); setCoverUrl(""); setPrice("0"); setIsPremium(false); setItems([]);
    } else {
      setError(r.error || "Не удалось создать пак");
      if (r.error === "Forbidden") {
        sessionStorage.removeItem("nova_admin_token");
        setAuthed(false);
      }
    }
  };

  if (!authed) {
    return (
      <div className="fixed inset-0 z-[290] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
          <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8">
            <Icon name="ChevronLeft" size={20} />
          </button>
          <h2 className="font-bold flex-1 text-lg">Добавить стикерпак</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="glass-strong rounded-3xl p-5 w-full max-w-sm">
            <div className="text-center mb-4">
              <Icon name="ShieldAlert" size={32} className="text-amber-400 mx-auto mb-2" />
              <h3 className="font-bold">Введите админ-пароль</h3>
              <p className="text-xs text-muted-foreground mt-1">ADMIN_PASSWORD из секретов проекта</p>
            </div>
            <input type="password" value={authInput} onChange={e => setAuthInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && tryAuth()}
              placeholder="Пароль"
              className="w-full bg-white/5 rounded-xl px-3 py-2.5 outline-none text-sm mb-2" />
            <button onClick={tryAuth} className="w-full py-3 rounded-2xl grad-primary font-bold text-white text-sm">
              Войти
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[290] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <h2 className="font-bold flex-1 text-lg">Добавить стикерпак</h2>
        <button onClick={() => { sessionStorage.removeItem("nova_admin_token"); setAuthed(false); }}
          className="text-xs text-muted-foreground">Выйти</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
        <div className="glass rounded-2xl p-3 space-y-2">
          <div className="text-[11px] text-muted-foreground">Название</div>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120}
            placeholder="Например: Кот Васька"
            className="w-full bg-white/5 rounded-xl px-3 py-2.5 outline-none text-sm" />
        </div>

        <div className="glass rounded-2xl p-3 space-y-2">
          <div className="text-[11px] text-muted-foreground">Описание</div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={3}
            placeholder="Краткое описание пака"
            className="w-full bg-white/5 rounded-xl px-3 py-2.5 outline-none text-sm resize-none" />
        </div>

        <div className="glass rounded-2xl p-3 space-y-2">
          <div className="text-[11px] text-muted-foreground">Обложка</div>
          {coverUrl ? (
            <div className="flex items-center gap-2">
              <img src={coverUrl} alt="" className="w-16 h-16 rounded-xl object-cover" />
              <button onClick={() => setCoverUrl("")} className="text-xs text-red-400">Удалить</button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-white/15 rounded-xl text-xs text-muted-foreground cursor-pointer hover:bg-white/5">
              <Icon name="Image" size={16} />
              {coverUploading ? "Загружаем..." : "Выбрать картинку"}
              <input type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onCoverFile(f); e.target.value = ""; }} />
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="glass rounded-2xl p-3">
            <div className="text-[11px] text-muted-foreground mb-1">Цена, ₽ (0 — бесплатно)</div>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0"
              className="w-full bg-white/5 rounded-xl px-3 py-2 outline-none text-sm font-bold" />
          </div>
          <div className="glass rounded-2xl p-3">
            <div className="text-[11px] text-muted-foreground mb-1">ID автора</div>
            <input value={authorId} onChange={e => setAuthorId(e.target.value)}
              className="w-full bg-white/5 rounded-xl px-3 py-2 outline-none text-sm" />
          </div>
        </div>

        <label className="flex items-center gap-3 glass rounded-2xl p-3 cursor-pointer">
          <input type="checkbox" checked={isPremium} onChange={e => setIsPremium(e.target.checked)} />
          <div className="flex-1">
            <div className="text-sm font-bold">Только по подписке (PRO)</div>
            <div className="text-[11px] text-muted-foreground">Доступен только подписчикам авторских стикеров (100₽/мес)</div>
          </div>
        </label>

        <div className="glass rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold">Стикеры ({items.length})</div>
            <button onClick={addItem} className="text-xs px-2 py-1 rounded-lg bg-violet-500/20 text-violet-300 font-semibold">
              + Добавить
            </button>
          </div>
          {items.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-4">
              Добавь хотя бы один стикер
            </div>
          )}
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl p-2">
                <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {it.uploading ? (
                    <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                  ) : it.image_url ? (
                    <img src={it.image_url} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <label className="w-full h-full flex items-center justify-center cursor-pointer">
                      <Icon name="Plus" size={16} className="text-muted-foreground" />
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) onItemFile(i, f); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
                <input value={it.emoji} onChange={e => updateItem(i, { emoji: e.target.value })} maxLength={4}
                  placeholder="😀"
                  className="w-12 bg-white/5 rounded-lg px-2 py-2 outline-none text-center text-base" />
                <button onClick={() => removeItem(i)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg">
                  <Icon name="Trash2" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        {success && <p className="text-xs text-emerald-400 text-center">{success}</p>}

        <button onClick={submit} disabled={busy}
          className="w-full py-3.5 rounded-2xl font-black text-white grad-primary disabled:opacity-50">
          {busy ? "Публикуем..." : "Опубликовать пак"}
        </button>
      </div>
    </div>
  );
}
