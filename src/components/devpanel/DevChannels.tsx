import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs, formatNum } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";

interface Channel {
  id: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  is_channel: boolean;
  owner_id: number;
  owner_name: string;
  created_at: number;
  last_message_at: number | null;
  members: number;
  messages: number;
}

export default function DevChannels({ can }: { can: (p: string) => boolean }) {
  const [items, setItems] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "channels" | "groups">("all");
  const [edit, setEdit] = useState<Channel | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await devApi<{ channels: Channel[] }>("channels");
      setItems(res.channels);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (c: Channel) => {
    setEdit(c);
    setName(c.name);
    setDesc(c.description || "");
  };

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await devApi("channel_update", { channel_id: edit.id, name, description: desc });
      setEdit(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Channel) => {
    if (!confirm(`Удалить «${c.name}»? Все сообщения будут скрыты.`)) return;
    setBusy(true);
    try {
      await devApi("channel_delete", { channel_id: c.id });
      setEdit(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} onRetry={load} />;

  const filtered = items.filter((c) =>
    filter === "all" ? true : filter === "channels" ? c.is_channel : !c.is_channel,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {([["all", "Все"], ["channels", "Каналы"], ["groups", "Группы"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition ${
              filter === k
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                : "bg-white/[0.04] border border-white/10 text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 transition"
        >
          <Icon name="RefreshCw" size={16} className="text-slate-400" />
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">Ничего нет</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <div className="flex items-start gap-3 mb-3">
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0">
                    <Icon name={c.is_channel ? "Radio" : "Users"} size={18} className="text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm truncate">{c.name}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${
                        c.is_channel ? "bg-cyan-500/20 text-cyan-400" : "bg-violet-500/20 text-violet-400"
                      }`}
                    >
                      {c.is_channel ? "канал" : "группа"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    Владелец: {c.owner_name}
                  </div>
                </div>
              </div>

              {c.description && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{c.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                <span className="flex items-center gap-1">
                  <Icon name="Users" size={12} />
                  {formatNum(c.members)}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="MessageSquare" size={12} />
                  {formatNum(c.messages)}
                </span>
                <span className="text-slate-600 ml-auto">{formatTs(c.last_message_at)}</span>
              </div>

              {can("channels") && (
                <button
                  onClick={() => openEdit(c)}
                  className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition"
                >
                  Управление
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-[#12131f] border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">{edit.is_channel ? "Канал" : "Группа"}</h3>
              <button onClick={() => setEdit(null)} className="text-slate-500 hover:text-slate-300">
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Название</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Описание</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/50 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-semibold disabled:opacity-50"
              >
                Сохранить
              </button>
              <button
                onClick={() => remove(edit)}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm hover:bg-red-500/25 disabled:opacity-50"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
