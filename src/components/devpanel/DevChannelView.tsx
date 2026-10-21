import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs } from "@/lib/devApi";

export interface DevChannel {
  id: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  is_channel: boolean;
  verified?: boolean;
  is_test?: boolean;
  only_admins_post?: boolean;
  owner_id: number;
  owner_name: string;
  created_at: number;
  last_message_at: number | null;
  invite_link?: string | null;
  members: number;
  messages: number;
}

interface Msg {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_avatar: string;
  text: string;
  media_type: string | null;
  media_url: string | null;
  kind: string;
  file_name: string | null;
  created_at: number;
  removed: boolean;
  edited: boolean;
}

interface Member {
  id: number;
  name: string;
  avatar_url: string;
  role: string;
  joined_at: number;
}

const ROLE_LABEL: Record<string, string> = { owner: "владелец", admin: "админ", member: "участник" };

function Media({ m }: { m: Msg }) {
  if (!m.media_url) return null;
  const t = m.media_type || "";
  if (t.startsWith("image") || t === "photo" || t === "sticker" || t === "gif")
    return <img src={m.media_url} alt="" className="mt-1.5 max-h-56 rounded-lg object-cover" />;
  if (t.startsWith("video")) return <video src={m.media_url} controls className="mt-1.5 max-h-56 rounded-lg" />;
  if (t.startsWith("audio") || t === "voice") return <audio src={m.media_url} controls className="mt-1.5 w-full" />;
  return (
    <a href={m.media_url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-violet-300 hover:underline">
      <Icon name="Paperclip" size={12} />
      {m.file_name || "Файл"}
    </a>
  );
}

export default function DevChannelView({
  channel, onClose, onChanged, canEdit,
}: {
  channel: DevChannel;
  onClose: () => void;
  onChanged: () => void;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<"feed" | "members" | "settings">("feed");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(channel.name);
  const [desc, setDesc] = useState(channel.description || "");
  const [onlyAdmins, setOnlyAdmins] = useState(!!channel.only_admins_post);
  const [isTest, setIsTest] = useState(!!channel.is_test);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const [post, setPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState("");

  const publish = async () => {
    const text = post.trim();
    if (!text || posting) return;
    if (!confirm(`Опубликовать в «${channel.name}» от имени Nova? Участники получат уведомление.`)) return;
    setPosting(true);
    setPostErr("");
    try {
      await devApi("channel_post", { channel_id: channel.id, text });
      setPost("");
      await loadMsgs();
      onChanged();
    } catch (e) {
      setPostErr(e instanceof Error ? e.message : "Не удалось опубликовать");
    } finally {
      setPosting(false);
    }
  };

  const loadMsgs = async (before = 0) => {
    const r = await devApi<{ messages: Msg[]; has_more: boolean }>("channel_messages", { channel_id: channel.id, before });
    setMsgs((prev) => (before ? [...r.messages, ...prev] : r.messages));
    setHasMore(r.has_more);
    if (!before) setTimeout(() => feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight }), 50);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadMsgs(),
      devApi<{ members: Member[] }>("channel_members", { channel_id: channel.id }).then((r) => setMembers(r.members)),
    ]).catch(() => { /* ignore */ }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  const delMsg = async (m: Msg) => {
    if (!confirm("Удалить это сообщение у всех участников?")) return;
    await devApi("channel_message_delete", { message_id: m.id });
    setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, removed: true, text: "", media_url: null } : x)));
    onChanged();
  };

  const save = async () => {
    setBusy(true);
    try {
      await devApi("channel_update", { channel_id: channel.id, name, description: desc, only_admins_post: onlyAdmins });
      if (isTest !== !!channel.is_test) await devApi("channel_set_test", { channel_id: channel.id, is_test: isTest });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Удалить «${channel.name}»? Все сообщения будут скрыты, участники потеряют доступ.`)) return;
    setBusy(true);
    try {
      await devApi("channel_delete", { channel_id: channel.id });
      onChanged();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  };

  const tabs: [typeof tab, string, string][] = [
    ["feed", "Публикации", "MessageSquare"],
    ["members", `Участники · ${members.length}`, "Users"],
    ...(canEdit ? [["settings", "Настройки", "Settings"] as [typeof tab, string, string]] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-[#12131f] border border-white/10 sm:rounded-2xl w-full max-w-2xl flex flex-col sm:max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
          {channel.avatar_url ? (
            <img src={channel.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <Icon name={channel.is_channel ? "Radio" : "Users"} size={17} className="text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate">{channel.name}</div>
            <div className="text-xs text-slate-500 truncate">
              {channel.is_channel ? "Канал" : "Группа"} · владелец {channel.owner_name} · создан {formatTs(channel.created_at)}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-200">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="flex gap-1.5 px-5 pt-3">
          {tabs.map(([k, label, icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                tab === k ? "bg-violet-600 text-white" : "bg-white/[0.04] text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon name={icon} size={13} />
              {label}
            </button>
          ))}
        </div>

        <div ref={feedRef} className="flex-1 overflow-y-auto px-5 py-4 min-h-[300px]">
          {loading ? (
            <div className="flex justify-center py-12"><Icon name="Loader2" size={22} className="animate-spin text-slate-500" /></div>
          ) : tab === "feed" ? (
            msgs.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-12">Пока ничего не опубликовано</p>
            ) : (
              <div className="space-y-2.5">
                {hasMore && (
                  <button onClick={() => loadMsgs(msgs[0]?.id || 0)} className="w-full text-xs text-violet-300 py-2 hover:underline">
                    Показать раньше
                  </button>
                )}
                {msgs.map((m) => (
                  <div key={m.id} className={`group flex gap-2.5 ${m.removed ? "opacity-50" : ""}`}>
                    {m.sender_avatar ? (
                      <img src={m.sender_avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">
                        {m.sender_name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-300 truncate">{m.sender_name}</span>
                        <span>{formatTs(m.created_at)}</span>
                        {m.edited && <span>· изменено</span>}
                        {canEdit && !m.removed && (
                          <button onClick={() => delMsg(m)} title="Удалить" className="ml-auto text-slate-500 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition">
                            <Icon name="Trash2" size={13} />
                          </button>
                        )}
                      </div>
                      {m.removed ? (
                        <div className="text-xs italic text-slate-500 mt-0.5">Сообщение удалено</div>
                      ) : (
                        <>
                          {m.text && <div className="text-sm whitespace-pre-wrap break-words mt-0.5">{m.text}</div>}
                          <Media m={m} />
                          {!m.text && !m.media_url && m.kind && <div className="text-xs text-slate-500 mt-0.5">[{m.kind}]</div>}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab === "members" ? (
            <div className="space-y-1">
              {members.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.03]">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                      {(u.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{u.name}</div>
                    <div className="text-[11px] text-slate-500">ID {u.id} · с {formatTs(u.joined_at)}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.role === "owner" ? "bg-amber-500/20 text-amber-400" : u.role === "admin" ? "bg-violet-500/20 text-violet-300" : "bg-white/5 text-slate-400"}`}>
                    {ROLE_LABEL[u.role] || u.role}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Название</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Описание</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50 resize-none" />
              </div>
              <label className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-3.5 py-3 cursor-pointer">
                <span>
                  <span className="text-sm block">Писать могут только админы</span>
                  <span className="text-xs text-slate-500">Остальные участники только читают</span>
                </span>
                <input type="checkbox" checked={onlyAdmins} onChange={(e) => setOnlyAdmins(e.target.checked)} className="w-5 h-5 accent-violet-500" />
              </label>
              <label className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-3.5 py-3 cursor-pointer">
                <span>
                  <span className="text-sm block">Тестовая (скрыть от поиска)</span>
                  <span className="text-xs text-slate-500">Не находится в поиске и по ссылке, видна только в панели</span>
                </span>
                <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} className="w-5 h-5 accent-violet-500" />
              </label>
              <div className="flex gap-2 pt-2">
                <button onClick={save} disabled={busy || !name.trim()} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50">
                  {saved ? "Сохранено" : "Сохранить"}
                </button>
                <button onClick={remove} disabled={busy} className="px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm hover:bg-red-500/25 disabled:opacity-50">
                  Удалить
                </button>
              </div>
            </div>
          )}
        </div>

        {canEdit && tab === "feed" && (
          <div className="border-t border-white/8 px-5 py-3">
            <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[9px] font-bold text-white">N</div>
              Пост от имени <span className="text-slate-200 font-semibold">Nova</span>
              <Icon name="BadgeCheck" size={12} className="text-sky-400" />
            </div>
            <div className="flex gap-2 items-end">
              <textarea
                value={post}
                onChange={(e) => setPost(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) publish(); }}
                rows={post.split("\n").length > 2 ? 5 : 2}
                maxLength={4000}
                placeholder="Текст поста… (Ctrl+Enter — опубликовать)"
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50 resize-none"
              />
              <button
                onClick={publish}
                disabled={posting || !post.trim()}
                className="h-11 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
              >
                <Icon name={posting ? "Loader2" : "Send"} size={15} className={posting ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Опубликовать</span>
              </button>
            </div>
            {postErr && <p className="text-xs text-red-400 mt-1.5">{postErr}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
