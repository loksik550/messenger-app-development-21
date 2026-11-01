import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, uploadMedia, type User, type Group } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatAtoms";

interface Props {
  currentUser: User;
  open: boolean;
  onClose: () => void;
  onCreated: (group: Group) => void;
}

export function GroupCreateModal({ currentUser, open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<"info" | "members">("info");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isChannel, setIsChannel] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep("info"); setName(""); setDescription(""); setIsChannel(false);
    setAvatarUrl(null); setSelected([]); setSearch(""); setError("");
  }, [open]);

  useEffect(() => {
    if (step !== "members") return;
    api("get_users", { query: search || "" }, currentUser.id).then(d => {
      if (d.users) setUsers(d.users.filter((u: User) => u.id !== currentUser.id));
    });
  }, [step, search, currentUser.id]);

  const pickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setUploading(true);
    try { const r = await uploadMedia(f, currentUser.id); setAvatarUrl(r.url); }
    catch { /* ignore */ } finally { setUploading(false); }
  };

  const toggle = (id: number) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const create = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setError("Введи название"); return; }
    if (trimmedName.length < 2) { setError("Минимум 2 символа в названии"); return; }
    setCreating(true); setError("");
    try {
      const desc = (description || "").trim();
      const ava = (avatarUrl || "").trim();
      const d = await api("create_group", {
        name: trimmedName,
        description: desc || null,
        avatar_url: ava || null,
        is_channel: isChannel,
        member_ids: selected,
      }, currentUser.id);
      if (d && d.group) {
        onCreated(d.group);
        onClose();
        if (d.invited > 0) alert(`Приглашения отправлены: ${d.invited}. Участники появятся, когда примут их.`);
      }
      else setError((d && d.error) || "Ошибка создания группы");
    } catch (e) {
      setError((e as Error)?.message || "Ошибка соединения");
    } finally { setCreating(false); }
  };

  const filtered = search.trim()
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : users;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-[#15151f] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-white/5">
          {step === "members" && (
            <button onClick={() => setStep("info")} className="p-1.5 rounded-xl hover:bg-white/8">
              <Icon name="ChevronLeft" size={20} />
            </button>
          )}
          <div className="flex-1">
            <h2 className="font-bold text-lg">
              {step === "info" ? (isChannel ? "Новый канал" : "Новая группа") : "Добавить участников"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {step === "info" ? "Шаг 1 из 2" : `Выбрано: ${selected.length}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/8">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Step 1: Info */}
        {step === "info" && (
          <div className="p-5 space-y-4">
            {/* Тип: группа / канал */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl">
              <button
                onClick={() => setIsChannel(false)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${!isChannel ? "grad-primary text-white" : "text-muted-foreground"}`}
              >
                <Icon name="Users" size={14} className="inline mr-1.5" />
                Группа
              </button>
              <button
                onClick={() => setIsChannel(true)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${isChannel ? "grad-primary text-white" : "text-muted-foreground"}`}
              >
                <Icon name="Radio" size={14} className="inline mr-1.5" />
                Канал
              </button>
            </div>

            {/* Аватар */}
            <div className="flex items-center gap-4">
              <button onClick={() => fileRef.current?.click()} className="relative flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} className="w-16 h-16 rounded-2xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl grad-primary flex items-center justify-center">
                    {uploading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Icon name={isChannel ? "Radio" : "Users"} size={26} className="text-white" />
                    }
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                  <Icon name="Camera" size={11} className="text-white" />
                </div>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
              <div className="flex-1">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={isChannel ? "Название канала" : "Название группы"}
                  maxLength={100}
                  className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Описание */}
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={isChannel ? "Описание канала (необязательно)" : "Описание группы (необязательно)"}
              maxLength={500}
              rows={2}
              className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-muted-foreground resize-none"
            />

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              onClick={() => name.trim() ? setStep("members") : setError("Введи название")}
              className="w-full h-12 rounded-2xl grad-primary text-white font-semibold flex items-center justify-center gap-2"
            >
              Далее
              <Icon name="ChevronRight" size={18} />
            </button>
          </div>
        )}

        {/* Step 2: Members */}
        {step === "members" && (
          <div className="flex flex-col max-h-[60vh]">
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 bg-white/5 rounded-2xl px-3 py-2">
                <Icon name="Search" size={16} className="text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск по имени..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex gap-2 px-5 pb-2 overflow-x-auto no-scrollbar">
                {selected.map(id => {
                  const u = users.find(u => u.id === id);
                  if (!u) return null;
                  return (
                    <button key={id} onClick={() => toggle(id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs font-medium whitespace-nowrap flex-shrink-0"
                    >
                      {u.name.split(" ")[0]}
                      <Icon name="X" size={12} />
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5">
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Пользователи не найдены</p>
              )}
              {filtered.map(u => (
                <button
                  key={u.id}
                  onClick={() => toggle(u.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition ${selected.includes(u.id) ? "bg-violet-500/10" : "hover:bg-white/5"}`}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar label={u.name[0]?.toUpperCase() || "?"} id={u.id} src={u.avatar_url} />
                    {selected.includes(u.id) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                        <Icon name="Check" size={11} className="text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.last_seen ? (Date.now() / 1000 - u.last_seen < 300 ? "В сети" : "Не в сети") : ""}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-white/5">
              {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
              <button
                onClick={create}
                disabled={creating}
                className="w-full h-12 rounded-2xl grad-primary text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {creating
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <>
                    <Icon name={isChannel ? "Radio" : "Users"} size={18} />
                    {isChannel ? "Создать канал" : "Создать группу"}
                  </>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GroupCreateModal;