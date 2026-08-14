import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs, timeAgo, formatNum, downloadCsv } from "@/lib/devApi";
import { Loading, ErrorBox } from "./DevDashboard";
import DevUserCard from "./DevUserCard";
import { Empty } from "./DevAutoRules";

interface DevUser {
  id: number;
  name: string;
  phone: string;
  created_at: number;
  last_seen: number | null;
  avatar_url: string | null;
  online: boolean;
  verified?: boolean;
}

interface ExportRow {
  id: number;
  name: string;
  phone: string;
  premium: string;
  premium_until: number;
  wallet: number;
  verified: string;
  created_at: number;
  last_seen: number;
  banned: string;
}

export default function DevUsers({
  can, compact,
}: {
  can: (p: string) => boolean;
  compact?: boolean;
}) {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cardId, setCardId] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<{ id: number; name: string; filters: Record<string, string> }[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const canWrite = can("user_write");
  const pad = compact ? "px-3 py-1.5" : "px-4 py-3";
  const avatar = compact ? "w-7 h-7" : "w-9 h-9";

  const load = useCallback(async (q: string, f: Record<string, string> = {}) => {
    setLoading(true);
    try {
      const hasFilters = Object.keys(f).length > 0;
      const res = hasFilters
        ? await devApi<{ users: DevUser[]; total: number }>("users_filtered", { filters: f })
        : await devApi<{ users: DevUser[]; total: number }>("users", { query: q });
      setUsers(res.users);
      setTotal(res.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query, filters), 300);
    return () => clearTimeout(t);
  }, [query, filters, load]);

  useEffect(() => {
    devApi<{ items: { id: number; name: string; filters: Record<string, string> }[] }>("filters_list")
      .then((r) => setSaved(r.items))
      .catch(() => {});
  }, []);

  const saveFilter = async () => {
    const name = prompt("Название фильтра");
    if (!name?.trim()) return;
    await devApi("filter_save", { name, filters });
    const r = await devApi<{ items: typeof saved }>("filters_list");
    setSaved(r.items);
    setMsg("Фильтр сохранён");
    setTimeout(() => setMsg(""), 3000);
  };

  const toggle = (id: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

  const allPicked = users.length > 0 && users.every((u) => picked.has(u.id));
  const toggleAll = () => {
    setPicked(allPicked ? new Set() : new Set(users.map((u) => u.id)));
  };

  const runBulk = async (bulk: string, days?: number) => {
    setBusy(true);
    try {
      const r = await devApi<{ affected: number; label: string }>("bulk_action", {
        ids: [...picked], bulk, days,
      });
      setMsg(`${r.label} — ${r.affected} чел.`);
      setTimeout(() => setMsg(""), 4000);
      setPicked(new Set());
      setBulkOpen(false);
      await load(query, filters);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Не удалось выполнить");
    } finally {
      setBusy(false);
    }
  };

  const exportUsers = async () => {
    setBusy(true);
    try {
      const r = await devApi<{ rows: ExportRow[]; count: number }>("users_export");
      const fmt = (t: number) =>
        t ? new Date(t * 1000).toLocaleString("ru", {
          day: "2-digit", month: "2-digit", year: "numeric",
        }) : "";
      downloadCsv(
        `nova-users-${new Date().toISOString().slice(0, 10)}.csv`,
        ["ID", "Имя", "Телефон", "Premium", "Premium до", "Кошелёк, руб",
         "Проверен", "Регистрация", "Был в сети", "Заблокирован"],
        r.rows.map((u) => [
          u.id, u.name, u.phone, u.premium, fmt(u.premium_until),
          String(u.wallet).replace(".", ","), u.verified,
          fmt(u.created_at), fmt(u.last_seen), u.banned,
        ]),
        [`Всего пользователей;${r.count}`],
      );
      setMsg(`Выгружено ${formatNum(r.count)} человек`);
      setTimeout(() => setMsg(""), 4000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Не удалось выгрузить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 flex-1 min-w-[240px] focus-within:border-violet-500/40 transition">
          <Icon name="Search" size={16} className="text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или номеру"
            className="flex-1 bg-transparent outline-none text-sm placeholder-slate-600"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-500 hover:text-slate-300">
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
        <div className="text-sm text-slate-500">Всего: {formatNum(total)}</div>
        <button
          onClick={exportUsers}
          disabled={busy}
          className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 transition flex items-center gap-2 text-xs disabled:opacity-50"
        >
          <Icon name="Download" size={15} className="text-slate-400" />
          <span className="hidden sm:inline">Выгрузить</span>
        </button>
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          title="Фильтры"
          className={`px-3.5 py-2.5 rounded-xl border transition flex items-center gap-2 text-xs ${
            activeCount > 0 || filterOpen
              ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
              : "bg-white/[0.04] border-white/10 text-slate-400 hover:bg-white/10"
          }`}
        >
          <Icon name="SlidersHorizontal" size={15} />
          {activeCount > 0 && <span>{activeCount}</span>}
        </button>
        <button
          onClick={() => load(query, filters)}
          className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 transition"
          title="Обновить"
        >
          <Icon name="RefreshCw" size={16} className="text-slate-400" />
        </button>
      </div>

      {filterOpen && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Pick label="Premium" value={filters.premium} onPick={(v) => setFilters({ ...filters, premium: v })}
                  options={[["yes", "Есть"], ["no", "Нет"]]} />
            <Pick label="Блокировка" value={filters.banned} onPick={(v) => setFilters({ ...filters, banned: v })}
                  options={[["yes", "Заблокированы"]]} />
            <Pick label="Галочка" value={filters.verified} onPick={(v) => setFilters({ ...filters, verified: v })}
                  options={[["yes", "Проверенные"]]} />
            <Pick label="Не заходили" value={filters.inactive_days} onPick={(v) => setFilters({ ...filters, inactive_days: v })}
                  options={[["7", "неделю"], ["30", "месяц"], ["90", "3 месяца"]]} />
            <Pick label="Новые" value={filters.new_days} onPick={(v) => setFilters({ ...filters, new_days: v })}
                  options={[["1", "за сутки"], ["7", "за неделю"], ["30", "за месяц"]]} />
            <Pick label="Кошелёк" value={filters.has_wallet} onPick={(v) => setFilters({ ...filters, has_wallet: v })}
                  options={[["yes", "с деньгами"]]} />
          </div>

          {saved.length > 0 && (
            <div>
              <div className="text-[11px] text-slate-600 mb-1.5">Сохранённые</div>
              <div className="flex flex-wrap gap-1.5">
                {saved.map((f) => (
                  <div key={f.id} className="flex items-center bg-white/[0.04] border border-white/10 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setFilters(f.filters)}
                      className="px-2.5 py-1.5 text-[11px] hover:bg-white/10 transition"
                    >
                      {f.name}
                    </button>
                    <button
                      onClick={async () => {
                        await devApi("filter_delete", { id: f.id });
                        setSaved(saved.filter((x) => x.id !== f.id));
                      }}
                      className="px-1.5 py-1.5 text-slate-600 hover:text-red-400 transition"
                    >
                      <Icon name="X" size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {activeCount > 0 && (
              <>
                <button
                  onClick={saveFilter}
                  className="px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-200 text-xs"
                >
                  Сохранить фильтр
                </button>
                <button
                  onClick={() => setFilters({})}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs"
                >
                  Сбросить
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {msg && (
        <div className="flex items-start gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
          <Icon name="CircleCheck" size={16} className="mt-0.5 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {picked.size > 0 && canWrite && (
        <div className="sticky top-2 z-20 bg-violet-600/20 backdrop-blur-md border border-violet-500/35 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <Icon name="CircleCheck" size={16} className="text-violet-300 shrink-0" />
          <span className="text-sm font-medium">Выбрано: {picked.size}</span>
          <div className="flex gap-1.5 ml-auto flex-wrap">
            <button
              onClick={() => setBulkOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs hover:bg-white/15 transition"
            >
              Действие
            </button>
            <button
              onClick={() => setPicked(new Set())}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs"
            >
              Снять
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox text={error} onRetry={() => load(query, filters)} />
      ) : users.length === 0 ? (
        <Empty
          icon={activeCount > 0 ? "SlidersHorizontal" : "UserSearch"}
          title={activeCount > 0 ? "Под фильтры никто не подходит" : "Никого не найдено"}
          text={
            activeCount > 0
              ? "Попробуйте убрать часть условий"
              : query
                ? `По запросу «${query}» ничего нет. Проверьте имя или номер`
                : "Пользователи появятся здесь после первой регистрации"
          }
          action={
            activeCount > 0
              ? { label: "Сбросить фильтры", onClick: () => setFilters({}) }
              : query
                ? { label: "Очистить поиск", onClick: () => setQuery("") }
                : undefined
          }
        />
      ) : (
        <>
        {/* На телефоне — карточки: таблица не влезает в узкий экран */}
        <div className="sm:hidden space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className={`rounded-2xl border p-3 transition ${
                picked.has(u.id)
                  ? "bg-violet-600/10 border-violet-500/30"
                  : "bg-white/[0.03] border-white/10"
              }`}
            >
              <div className="flex items-center gap-3">
                {canWrite && (
                  <button onClick={() => toggle(u.id)} className="shrink-0">
                    <Box checked={picked.has(u.id)} />
                  </button>
                )}
                <div className="relative shrink-0">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-sm font-bold">
                      {(u.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  {u.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0a0b14]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate text-sm">{u.name || "Без имени"}</span>
                    {u.verified && <Icon name="BadgeCheck" size={13} className="text-sky-400 shrink-0" />}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{u.phone || `ID ${u.id}`}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {u.online ? (
                      <span className="text-emerald-400">в сети</span>
                    ) : (
                      timeAgo(u.last_seen)
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setCardId(u.id)}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 shrink-0"
                >
                  <Icon name="ChevronRight" size={15} className="text-slate-400" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden sm:block bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-white/8">
                  {canWrite && (
                    <th className={`${pad} w-10`}>
                      <button onClick={toggleAll} className="flex items-center">
                        <Box checked={allPicked} />
                      </button>
                    </th>
                  )}
                  <th className={`${pad} font-medium`}>Пользователь</th>
                  <th className={`${pad} font-medium`}>Телефон</th>
                  {!compact && <th className={`${pad} font-medium`}>Регистрация</th>}
                  <th className={`${pad} font-medium`}>Был в сети</th>
                  <th className={pad} />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-b border-white/5 last:border-0 transition ${
                      picked.has(u.id) ? "bg-violet-600/10" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    {canWrite && (
                      <td className={pad}>
                        <button onClick={() => toggle(u.id)} className="flex items-center">
                          <Box checked={picked.has(u.id)} />
                        </button>
                      </td>
                    )}
                    <td className={pad}>
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className={`${avatar} rounded-full object-cover`} />
                          ) : (
                            <div className={`${avatar} rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-xs font-bold`}>
                              {(u.name || "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          {u.online && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0a0b14]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="font-medium truncate">{u.name || "Без имени"}</div>
                            {u.verified && (
                              <Icon name="BadgeCheck" size={14} className="text-sky-400 shrink-0" />
                            )}
                          </div>
                          {!compact && <div className="text-xs text-slate-500">ID {u.id}</div>}
                        </div>
                      </div>
                    </td>
                    <td className={`${pad} text-slate-400 whitespace-nowrap`}>{u.phone}</td>
                    {!compact && (
                      <td className={`${pad} text-slate-500 whitespace-nowrap`}>{formatTs(u.created_at)}</td>
                    )}
                    <td className={`${pad} whitespace-nowrap`}>
                      {u.online ? (
                        <span className="text-emerald-400 text-xs">в сети</span>
                      ) : (
                        <span className="text-slate-500 text-xs">{timeAgo(u.last_seen)}</span>
                      )}
                    </td>
                    <td className={`${pad} text-right`}>
                      <button
                        onClick={() => setCardId(u.id)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition"
                      >
                        Подробнее
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {bulkOpen && (
        <BulkDialog
          count={picked.size}
          busy={busy}
          onRun={runBulk}
          onClose={() => setBulkOpen(false)}
        />
      )}

      {cardId !== null && (
        <DevUserCard
          userId={cardId}
          can={can}
          onClose={() => setCardId(null)}
          onChanged={() => load(query, filters)}
        />
      )}
    </div>
  );
}

function Pick({
  label, value, options, onPick,
}: {
  label: string;
  value?: string;
  options: [string, string][];
  onPick: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[11px] text-slate-600 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, t]) => (
          <button
            key={v}
            onClick={() => onPick(value === v ? "" : v)}
            className={`px-2 py-1 rounded-lg text-[11px] border transition ${
              value === v
                ? "bg-violet-600/25 border-violet-500/40 text-violet-200"
                : "bg-white/[0.03] border-white/8 text-slate-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Box({ checked }: { checked: boolean }) {
  return (
    <span
      className={`w-4 h-4 rounded border flex items-center justify-center transition ${
        checked ? "bg-violet-500 border-violet-500" : "border-white/20"
      }`}
    >
      {checked && <Icon name="Check" size={11} className="text-white" />}
    </span>
  );
}

function BulkDialog({
  count, busy, onRun, onClose,
}: {
  count: number;
  busy: boolean;
  onRun: (bulk: string, days?: number) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState(7);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#12131f] border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold">Действие для {count} чел.</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <Icon name="X" size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Применится сразу ко всем выбранным</p>

        <div className="mb-4">
          <label className="text-xs text-slate-500 mb-1.5 block">Срок, дней</label>
          <div className="flex gap-1.5">
            {[7, 30, 90, 365].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`flex-1 py-2 rounded-xl text-xs border transition ${
                  days === d
                    ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                    : "bg-white/[0.03] border-white/8 text-slate-400"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <BulkBtn
            icon="Crown" label={`Продлить Premium на ${days} дн.`}
            cls="bg-amber-500/15 border-amber-500/25 text-amber-300"
            disabled={busy}
            onClick={() => onRun("premium", days)}
          />
          <BulkBtn
            icon="LogOut" label="Выйти со всех устройств"
            cls="bg-white/5 border-white/10 text-slate-300"
            disabled={busy}
            onClick={() => onRun("logout")}
          />
          <BulkBtn
            icon="ShieldCheck" label="Снять блокировку"
            cls="bg-emerald-500/15 border-emerald-500/25 text-emerald-300"
            disabled={busy}
            onClick={() => onRun("unban")}
          />
          <BulkBtn
            icon="Ban" label={`Заблокировать на ${days} дн.`}
            cls="bg-red-500/15 border-red-500/25 text-red-300"
            disabled={busy}
            onClick={() => {
              if (!confirm(`Заблокировать ${count} чел. на ${days} дней?`)) return;
              onRun("ban", days);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function BulkBtn({
  icon, label, cls, disabled, onClick,
}: {
  icon: string;
  label: string;
  cls: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center gap-2 disabled:opacity-40 transition hover:brightness-125 ${cls}`}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
}
