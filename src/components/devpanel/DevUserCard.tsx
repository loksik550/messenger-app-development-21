import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatTs, timeAgo, formatNum } from "@/lib/devApi";
import DevUserBilling from "@/components/devpanel/DevUserBilling";
import DevUserHistory from "./DevUserHistory";
import { DevUserChatsTab, DevUserMediaTab } from "./DevUserTabs";

const BAN_REASONS = [
  "Спам и массовые рассылки",
  "Оскорбления и травля",
  "Мошенничество",
  "Запрещённый контент",
  "Обход блокировки",
];

interface UserDetail {
  id: number;
  name: string;
  phone: string;
  created_at: number;
  last_seen: number | null;
  avatar_url: string | null;
  about: string | null;
  banned_until: number | null;
  banned_reason: string | null;
  messages: number;
  contacts: number;
  wallet_balance?: number;
  verified?: boolean;
}

interface Device {
  id: number;
  kind: string;
  created_at: number;
}




type Tab = "profile" | "history" | "billing" | "chats" | "media";

interface Props {
  userId: number;
  onClose: () => void;
  onChanged: () => void;
  can: (p: string) => boolean;
}

export default function DevUserCard({ userId, onClose, onChanged, can }: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const [banDialog, setBanDialog] = useState<null | { days: number }>(null);
  const [banReason, setBanReason] = useState("");
  const [user, setUser] = useState<UserDetail | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [topup, setTopup] = useState("");

  const loadUser = async () => {
    const res = await devApi<{ user: UserDetail }>("user_detail", { user_id: userId });
    setUser(res.user);
    setNewName(res.user.name || "");
  };

  useEffect(() => {
    loadUser().catch(() => undefined);
    devApi<{ devices: Device[] }>("user_devices", { user_id: userId })
      .then((r) => setDevices(r.devices))
      .catch(() => undefined);
  }, [userId]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось выполнить");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <Overlay onClose={onClose}>
        <div className="flex items-center justify-center py-16">
          <Icon name="Loader2" size={24} className="animate-spin text-violet-400" />
        </div>
      </Overlay>
    );
  }

  const banned = !!user.banned_until && user.banned_until > Date.now() / 1000;

  return (
    <Overlay onClose={onClose} wide>
      <div className="flex items-start gap-4 mb-5">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-lg font-bold shrink-0">
            {(user.name || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 bg-black/30 border border-white/15 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-violet-500/50"
              />
              <button
                onClick={() =>
                  run(async () => {
                    await devApi("rename_user", { user_id: user.id, name: newName });
                    await loadUser();
                    setRenaming(false);
                  })
                }
                disabled={busy}
                className="px-2.5 py-1.5 rounded-lg bg-violet-600 text-xs font-medium disabled:opacity-50"
              >
                Сохранить
              </button>
              <button onClick={() => setRenaming(false)} className="text-slate-500 hover:text-slate-300">
                <Icon name="X" size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg truncate">{user.name || "Без имени"}</h3>
              {user.verified && (
                <Icon name="BadgeCheck" size={17} className="text-sky-400 shrink-0" />
              )}
              {can("user_write") && (
                <button
                  onClick={() => setRenaming(true)}
                  className="text-slate-500 hover:text-violet-400 transition"
                  title="Изменить имя"
                >
                  <Icon name="Pencil" size={14} />
                </button>
              )}
              {banned && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                  заблокирован
                </span>
              )}
            </div>
          )}
          <p className="text-sm text-slate-400 mt-0.5">{user.phone}</p>
          <p className="text-xs text-slate-600">ID {user.id}</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 shrink-0">
          <Icon name="X" size={18} />
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-black/30 rounded-xl mb-4">
        {(
          [
            ["profile", "Профиль", "User"],
            ["history", "История", "History"],
            ["billing", "Оплаты", "Receipt"],
            ["chats", "Переписка", "MessagesSquare"],
            ["media", "Файлы", "Image"],
          ] as const
        ).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
              tab === k ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon name={icon} size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="max-h-[52vh] overflow-y-auto pr-1">
        {tab === "history" && <DevUserHistory userId={user.id} />}

        {tab === "billing" && (
          <DevUserBilling
            userId={user.id}
            canEdit={can("settings")}
            onChanged={loadUser}
          />
        )}

        {tab === "profile" && (
          <div className="space-y-4">
            {banned && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <Icon name="Ban" size={16} className="mt-0.5 shrink-0" />
                <div>
                  <div>Заблокирован до {formatTs(user.banned_until)}</div>
                  {user.banned_reason && <div className="text-xs opacity-70 mt-0.5">{user.banned_reason}</div>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Info label="Сообщений" value={formatNum(user.messages)} />
              <Info label="Контактов" value={formatNum(user.contacts)} />
              <Info label="Регистрация" value={formatTs(user.created_at)} />
              <Info label="Был в сети" value={timeAgo(user.last_seen)} />
              <Info label="Кошелёк" value={`${formatNum(user.wallet_balance || 0)} ₽`} />
              <Info label="Устройств" value={String(devices.length)} />
            </div>

            {user.about && (
              <div className="text-sm text-slate-400 bg-white/[0.03] rounded-xl px-3 py-2.5">{user.about}</div>
            )}

            <Section title="Устройства и сессии">
              {devices.length === 0 ? (
                <p className="text-xs text-slate-600 py-2">Активных устройств нет</p>
              ) : (
                <div className="space-y-1.5">
                  {devices.map((d) => (
                    <div key={d.id} className="flex items-center gap-2.5 bg-white/[0.03] rounded-lg px-3 py-2">
                      <Icon name="Smartphone" size={14} className="text-slate-500" />
                      <span className="text-xs flex-1">{d.kind}</span>
                      <span className="text-[10px] text-slate-600">{formatTs(d.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {can("wallet") && (
              <Section title="Пополнить кошелёк">
                <div className="flex items-center gap-2">
                  <input
                    value={topup}
                    onChange={(e) => setTopup(e.target.value.replace(/[^\d-]/g, ""))}
                    placeholder="Сумма, ₽"
                    className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50 placeholder-slate-600"
                  />
                  <button
                    onClick={() =>
                      run(async () => {
                        await devApi("topup_wallet", { user_id: user.id, amount: Number(topup) });
                        setTopup("");
                        await loadUser();
                      })
                    }
                    disabled={busy || !topup}
                    className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-xs font-medium disabled:opacity-40"
                  >
                    Начислить
                  </button>
                </div>
                <p className="text-[10px] text-slate-600 mt-1.5">
                  Отрицательная сумма спишет средства
                </p>
              </Section>
            )}

            {can("user_write") && (
              <Section title="Действия">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      run(async () => {
                        await devApi("force_logout", { user_id: user.id });
                        alert("Выполнен выход со всех устройств");
                        setDevices([]);
                      })
                    }
                    disabled={busy}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition disabled:opacity-50"
                  >
                    Выйти со всех устройств
                  </button>

                  <button
                    onClick={() =>
                      run(async () => {
                        await devApi("set_verified", { user_id: user.id, verified: !user.verified });
                        await loadUser();
                      })
                    }
                    disabled={busy}
                    className={`px-3 py-2 rounded-xl border text-xs transition disabled:opacity-50 ${
                      user.verified
                        ? "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                        : "bg-sky-500/15 border-sky-500/25 text-sky-400 hover:bg-sky-500/25"
                    }`}
                  >
                    {user.verified ? "Снять галочку" : "Выдать галочку"}
                  </button>

                  {banned ? (
                    <button
                      onClick={() =>
                        run(async () => {
                          await devApi("ban_user", { user_id: user.id, days: 0 });
                          await loadUser();
                        })
                      }
                      disabled={busy}
                      className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs hover:bg-emerald-500/25 transition disabled:opacity-50"
                    >
                      Разблокировать
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => { setBanDialog({ days: 7 }); setBanReason(""); }}
                        disabled={busy}
                        className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs hover:bg-amber-500/25 transition disabled:opacity-50"
                      >
                        Бан 7 дней
                      </button>
                      <button
                        onClick={() => { setBanDialog({ days: 3650 }); setBanReason(""); }}
                        disabled={busy}
                        className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs hover:bg-red-500/25 transition disabled:opacity-50"
                      >
                        Бан навсегда
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      if (!confirm(`Удалить аккаунт «${user.name}»? Данные будут обезличены, восстановить нельзя.`)) return;
                      run(async () => {
                        await devApi("delete_user", { user_id: user.id });
                        alert("Аккаунт удалён");
                        onClose();
                      });
                    }}
                    disabled={busy}
                    className="px-3 py-2 rounded-xl bg-red-600/20 border border-red-600/30 text-red-300 text-xs hover:bg-red-600/30 transition disabled:opacity-50"
                  >
                    Удалить аккаунт
                  </button>
                </div>
              </Section>
            )}
          </div>
        )}

        {tab === "chats" && <DevUserChatsTab userId={userId} can={can} run={run} />}

        {tab === "media" && <DevUserMediaTab userId={userId} can={can} run={run} />}
      </div>

      {banDialog && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setBanDialog(null)}
        >
          <div
            className="bg-[#12131f] border border-white/10 rounded-2xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-semibold mb-1">
              {banDialog.days >= 3650 ? "Блокировка навсегда" : `Блокировка на ${banDialog.days} дней`}
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              Причину увидит пользователь на экране блокировки
            </p>

            <div className="space-y-1.5 mb-3">
              {BAN_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setBanReason(r)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs border transition ${
                    banReason === r
                      ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                      : "bg-white/[0.03] border-white/8 text-slate-400 hover:bg-white/[0.06]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Или своя формулировка"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-violet-500/50 placeholder-slate-600 mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setBanDialog(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs"
              >
                Отмена
              </button>
              <button
                onClick={() =>
                  run(async () => {
                    await devApi("ban_user", {
                      user_id: user.id,
                      days: banDialog.days,
                      reason: banReason.trim() || "Нарушение правил сервиса",
                    });
                    setBanDialog(null);
                    await loadUser();
                  })
                }
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-medium disabled:opacity-50"
              >
                Заблокировать
              </button>
            </div>
          </div>
        </div>
      )}
    </Overlay>
  );
}

function Overlay({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`bg-[#12131f] border border-white/10 rounded-2xl p-6 w-full ${wide ? "max-w-2xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-400 mb-2">{title}</div>
      {children}
    </div>
  );
}
