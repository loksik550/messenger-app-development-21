import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs, formatNum } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";
import DevChannelView, { type DevChannel } from "./DevChannelView";

type Channel = DevChannel;

export default function DevChannels({ can }: { can: (p: string) => boolean }) {
  const [items, setItems] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "channels" | "groups">("all");
  const [edit, setEdit] = useState<Channel | null>(null);

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

  const openEdit = (c: Channel) => setEdit(c);

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
                    {c.verified && (
                      <Icon name="BadgeCheck" size={14} className="text-sky-400 shrink-0" />
                    )}
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${
                        c.is_channel ? "bg-cyan-500/20 text-cyan-400" : "bg-violet-500/20 text-violet-400"
                      }`}
                    >
                      {c.is_channel ? "канал" : "группа"}
                    </span>
                    {c.is_test && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0 bg-amber-500/20 text-amber-400">тест</span>
                    )}
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
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(c)}
                    className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition"
                  >
                    Открыть
                  </button>
                  <button
                    onClick={async () => {
                      await devApi("set_channel_verified", { channel_id: c.id, verified: !c.verified });
                      load();
                    }}
                    className={`px-3 py-2 rounded-xl border text-xs transition ${
                      c.verified
                        ? "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                        : "bg-sky-500/15 border-sky-500/25 text-sky-400 hover:bg-sky-500/25"
                    }`}
                  >
                    {c.verified ? "Снять" : "Галочка"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {edit && (
        <DevChannelView channel={edit} canEdit={can("channels")} onClose={() => setEdit(null)} onChanged={load} />
      )}
    </div>
  );
}
