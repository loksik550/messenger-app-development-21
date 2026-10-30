import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, type Chat, type Group, type IconName, type User } from "@/lib/api";
import { showProLimit } from "@/components/messenger/ProLimitSheet";

type BuiltinFolder = "all" | "unread" | "favorite" | "groups" | "personal";
export type FolderId = BuiltinFolder | `f${number}`;

export interface CustomFolder { id: number; name: string; icon: string; chat_ids: string[] }

const FOLDERS: { id: BuiltinFolder; label: string; icon: IconName }[] = [
  { id: "all", label: "Все", icon: "MessageCircle" },
  { id: "unread", label: "Непрочитанные", icon: "Mail" },
  { id: "favorite", label: "Избранное", icon: "Star" },
  { id: "personal", label: "Личные", icon: "User" },
  { id: "groups", label: "Группы", icon: "Users" },
];

const FOLDER_ICONS = ["Folder", "Briefcase", "Heart", "Home", "Users", "Star", "Gamepad2", "GraduationCap", "ShoppingBag", "Plane"];

const STORAGE_KEY = "nova_chat_folder";

function isFolderId(v: string): v is FolderId {
  return FOLDERS.some((f) => f.id === v) || /^f\d+$/.test(v);
}

export function getStoredFolder(): FolderId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && isFolderId(v)) return v;
  } catch { /* ignore */ }
  return "all";
}

function customOf(folder: FolderId, custom: CustomFolder[]) {
  if (!folder.startsWith("f")) return null;
  return custom.find((c) => `f${c.id}` === folder) || null;
}

export function filterChatsByFolder(chats: Chat[], folder: FolderId, custom: CustomFolder[] = []): Chat[] {
  const cf = customOf(folder, custom);
  if (cf) return chats.filter((c) => cf.chat_ids.includes(`c${c.id}`));
  switch (folder) {
    case "unread":   return chats.filter(c => (c.unread || 0) > 0);
    case "favorite": return chats.filter(c => c.favorite);
    case "groups":   return chats.filter(c => c.group);
    case "personal": return chats.filter(c => !c.group);
    default:         return chats;
  }
}

export function filterGroupsByFolder(groups: Group[], folder: FolderId, custom: CustomFolder[] = []): Group[] {
  const cf = customOf(folder, custom);
  if (cf) return groups.filter((g) => cf.chat_ids.includes(`g${g.id}`));
  if (folder === "personal" || folder === "favorite") return [];
  if (folder === "unread") return groups.filter((g) => (g.unread_count || 0) > 0);
  return groups;
}

export function useCustomFolders(currentUser: User | null) {
  const [folders, setFolders] = useState<CustomFolder[]>([]);
  const reload = useCallback(async () => {
    if (!currentUser) return;
    const d = await api("folders_list", {}, currentUser.id).catch(() => null);
    if (d && Array.isArray(d.folders)) setFolders(d.folders);
  }, [currentUser?.id]);
  useEffect(() => { reload(); }, [reload]);
  return { folders, reload };
}

export function ChatFolders({ folder, onChange, chats, groups = [], custom = [], currentUser, onFoldersChanged }: {
  folder: FolderId;
  onChange: (f: FolderId) => void;
  chats: Chat[];
  groups?: Group[];
  custom?: CustomFolder[];
  currentUser?: User | null;
  onFoldersChanged?: () => void;
}) {
  const [editor, setEditor] = useState<CustomFolder | "new" | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, folder); } catch { /* ignore */ }
  }, [folder]);

  useEffect(() => {
    if (folder.startsWith("f") && custom.length > 0 && !customOf(folder, custom)) onChange("all");
  }, [folder, custom, onChange]);

  const counts: Record<BuiltinFolder, number> = {
    all: chats.length,
    unread: chats.filter(c => (c.unread || 0) > 0).length,
    favorite: chats.filter(c => c.favorite).length,
    personal: chats.filter(c => !c.group).length,
    groups: chats.filter(c => c.group).length,
  };

  if (chats.length + groups.length < 3 && custom.length === 0) return null;

  const chip = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
      active ? "chip chip-active grad-primary text-white shadow-md shadow-violet-500/20" : "chip bg-white/5 text-muted-foreground hover:bg-white/10"
    }`;

  return (
    <>
      <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar">
        {FOLDERS.map(f => {
          const cnt = counts[f.id];
          if (f.id !== "all" && cnt === 0) return null;
          const active = folder === f.id;
          return (
            <button key={f.id} onClick={() => onChange(f.id)} className={chip(active)}>
              <Icon name={f.icon} size={12} />
              {f.label}
              {cnt > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${active ? "bg-white/20" : "bg-white/10"}`}>{cnt}</span>
              )}
            </button>
          );
        })}
        {custom.map((cf) => {
          const id = `f${cf.id}` as FolderId;
          const active = folder === id;
          return (
            <button
              key={id}
              onClick={() => (active ? setEditor(cf) : onChange(id))}
              className={chip(active)}
              title={active ? "Нажмите ещё раз, чтобы изменить" : cf.name}
            >
              <Icon name={cf.icon} fallback="Folder" size={12} />
              {cf.name}
              {active && <Icon name="Pencil" size={10} className="opacity-70" />}
            </button>
          );
        })}
        {currentUser && (
          <button onClick={() => setEditor("new")} className={chip(false)} aria-label="Новая папка">
            <Icon name="FolderPlus" size={12} />
            {custom.length === 0 && "Папка"}
          </button>
        )}
      </div>
      {editor && currentUser && (
        <FolderEditor
          folder={editor === "new" ? null : editor}
          chats={chats}
          groups={groups}
          currentUser={currentUser}
          onClose={() => setEditor(null)}
          onSaved={(newId) => {
            setEditor(null);
            onFoldersChanged?.();
            if (newId) onChange(`f${newId}`);
          }}
          onDeleted={() => { setEditor(null); onChange("all"); onFoldersChanged?.(); }}
        />
      )}
    </>
  );
}

function FolderEditor({ folder, chats, groups, currentUser, onClose, onSaved, onDeleted }: {
  folder: CustomFolder | null;
  chats: Chat[];
  groups: Group[];
  currentUser: User;
  onClose: () => void;
  onSaved: (newId?: number) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(folder?.name || "");
  const [icon, setIcon] = useState(folder?.icon || "Folder");
  const [sel, setSel] = useState<Set<string>>(new Set(folder?.chat_ids || []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const items = [
    ...chats.filter((c) => !c.saved).map((c) => ({ key: `c${c.id}`, name: c.name, avatar: c.avatar_url, group: false })),
    ...groups.map((g) => ({ key: `g${g.id}`, name: g.name, avatar: g.avatar_url, group: true })),
  ];

  const toggle = (k: string) => setSel((p) => {
    const n = new Set(p);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const save = async () => {
    if (!name.trim()) { setError("Введите название"); return; }
    setBusy(true); setError("");
    const r = await api("folder_save", { id: folder?.id, name: name.trim(), icon, chat_ids: [...sel] }, currentUser.id).catch(() => null);
    setBusy(false);
    if (!r) { setError("Нет связи, попробуйте ещё раз"); return; }
    if (r.limit === "folders") {
      onClose();
      showProLimit({ kind: "folders", is_pro: !!r.is_pro, folders_free: r.folders_free, folders_pro: r.folders_pro });
      return;
    }
    if (r.error) { setError(r.error); return; }
    onSaved(folder ? undefined : r.id);
  };

  const remove = async () => {
    if (!folder) return;
    setBusy(true);
    await api("folder_delete", { id: folder.id }, currentUser.id).catch(() => null);
    setBusy(false);
    onDeleted();
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-3xl p-5 animate-scale-in flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()} style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">{folder ? "Папка" : "Новая папка"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/8"><Icon name="X" size={18} /></button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          placeholder="Название, например «Работа»"
          className="w-full bg-white/5 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/50 mb-3"
        />
        <div className="flex gap-1.5 flex-wrap mb-3">
          {FOLDER_ICONS.map((ic) => (
            <button key={ic} onClick={() => setIcon(ic)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${icon === ic ? "grad-primary text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}>
              <Icon name={ic} fallback="Folder" size={16} />
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground mb-2">Чаты в папке · выбрано {sel.size}</div>
        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1 min-h-[120px]">
          {items.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Пока нет чатов</div>}
          {items.map((it) => {
            const on = sel.has(it.key);
            return (
              <button key={it.key} onClick={() => toggle(it.key)} className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left ${on ? "bg-violet-500/15" : "hover:bg-white/5"}`}>
                {it.avatar ? (
                  <img src={it.avatar} alt="" className={`w-9 h-9 object-cover flex-shrink-0 ${it.group ? "rounded-xl" : "rounded-full"}`} />
                ) : (
                  <div className={`w-9 h-9 grad-primary flex items-center justify-center flex-shrink-0 text-white text-sm font-bold ${it.group ? "rounded-xl" : "rounded-full"}`}>
                    {it.group ? <Icon name="Users" size={15} /> : (it.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-sm truncate">{it.name}</span>
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${on ? "grad-primary border-transparent" : "border-white/20"}`}>
                  {on && <Icon name="Check" size={12} className="text-white" />}
                </span>
              </button>
            );
          })}
        </div>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        <div className="flex gap-2 mt-3">
          {folder && (
            <button onClick={remove} disabled={busy} className="px-4 py-3 rounded-2xl bg-red-500/15 text-red-400 text-sm font-semibold">
              Удалить
            </button>
          )}
          <button onClick={save} disabled={busy} className="flex-1 py-3 rounded-2xl grad-primary text-white font-bold disabled:opacity-50">
            {busy ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useChatFolder(): [FolderId, (f: FolderId) => void] {
  const [folder, setFolder] = useState<FolderId>("all");
  useEffect(() => { setFolder(getStoredFolder()); }, []);
  return [folder, setFolder];
}
