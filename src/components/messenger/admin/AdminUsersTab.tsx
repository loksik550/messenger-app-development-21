import { useState } from "react";
import Icon from "@/components/ui/icon";
import { AdminUser, fmtDate, fmtTime } from "./AdminAPI";
import { DevRow, DevStat } from "./AdminStatsTab";

interface AdminUsersTabProps {
  visible: boolean;
  users: AdminUser[];
  usersTotal: number;
  search: string;
  onSearchChange: (q: string) => void;
  loading: boolean;
  onOpenUser: (u: AdminUser) => void;
  onDeleteUser: (userId: number) => void;

  // detail modal
  selectedUser: AdminUser | null;
  onCloseSelected: () => void;
  editName: string;
  setEditName: (v: string) => void;
  saving: boolean;
  onSaveUser: () => void;
  onTopup: (amount: number) => Promise<boolean>;

  showMessage: boolean;
  setShowMessage: (v: boolean) => void;
  messageText: string;
  setMessageText: (v: string) => void;
  messageSending: boolean;
  onSendMessage: () => void;

  // confirm delete
  confirmDelete: number | null;
  setConfirmDelete: (v: number | null) => void;
  onConfirmDelete: () => void;
}

export function AdminUsersTab({
  visible,
  users,
  usersTotal,
  search,
  onSearchChange,
  loading,
  onOpenUser,
  onDeleteUser,
  selectedUser,
  onCloseSelected,
  editName,
  setEditName,
  saving,
  onSaveUser,
  onTopup,
  showMessage,
  setShowMessage,
  messageText,
  setMessageText,
  messageSending,
  onSendMessage,
  confirmDelete,
  setConfirmDelete,
  onConfirmDelete,
}: AdminUsersTabProps) {
  const [topupAmount, setTopupAmount] = useState("");
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupDone, setTopupDone] = useState(false);

  const doTopup = async () => {
    const a = parseFloat(topupAmount.replace(",", "."));
    if (!a) return;
    setTopupBusy(true);
    const okr = await onTopup(a);
    setTopupBusy(false);
    if (okr) {
      setTopupAmount("");
      setTopupDone(true);
      setTimeout(() => setTopupDone(false), 1500);
    }
  };

  return (
    <>
      {visible && <div className="space-y-3 animate-fade-in">
        <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
          <Icon name="Search" size={15} className="text-muted-foreground" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Поиск по имени или номеру..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground px-1">Найдено: {usersTotal}</p>

        {loading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" /></div>}

        {users.map(u => (
          <div key={u.id} className="w-full glass rounded-2xl p-4 flex items-center gap-3 hover:bg-white/8 transition-colors group">
            <button onClick={() => onOpenUser(u)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-base flex-shrink-0 ${u.online ? "bg-gradient-to-br from-emerald-500 to-teal-500" : "bg-gradient-to-br from-violet-500 to-indigo-500"}`}>
                {u.avatar_url
                  ? <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" />
                  : u.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{u.name}</span>
                  {u.online && <span className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground">{u.phone}</p>
              </div>
            </button>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-muted-foreground">#{u.id}</p>
              <p className="text-[10px] text-muted-foreground">{fmtTime(u.last_seen || 0)}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteUser(u.id); }}
              title="Удалить пользователя"
              className="p-2 rounded-xl hover:bg-red-500/15 text-red-400 transition-colors flex-shrink-0"
            >
              <Icon name="Trash2" size={16} />
            </button>
          </div>
        ))}
      </div>}

      {/* User detail modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/60 animate-fade-in" onClick={onCloseSelected}>
          <div className="w-full max-w-lg glass-strong rounded-t-3xl p-6 animate-fade-in max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Пользователь #{selectedUser.id}</h3>
              <button onClick={onCloseSelected} className="p-2 glass rounded-xl text-muted-foreground">
                <Icon name="X" size={16} />
              </button>
            </div>

            {/* Шапка — аватар + имя + статус */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                {selectedUser.avatar_url
                  ? <img src={selectedUser.avatar_url} alt={selectedUser.name} className="w-full h-full object-cover" />
                  : selectedUser.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base truncate" style={selectedUser.name_color ? { color: selectedUser.name_color } : undefined}>
                    {selectedUser.name}
                  </span>
                  {selectedUser.emoji_status && <span className="text-base">{selectedUser.emoji_status}</span>}
                  {selectedUser.is_pro && <span className="text-[10px] grad-primary text-white px-2 py-0.5 rounded-full font-bold">PRO</span>}
                  {selectedUser.is_bot && <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-bold">BOT</span>}
                  {selectedUser.online && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">online</span>}
                  {selectedUser.incognito && <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-bold">incognito</span>}
                </div>
                <p className="text-xs text-muted-foreground font-mono">{selectedUser.phone}</p>
                {selectedUser.about && <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-2">«{selectedUser.about}»</p>}
              </div>
            </div>

            {/* Метрики */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <DevStat label="Сообщений" value={selectedUser.msg_count ?? 0} />
              <DevStat label="Чатов" value={selectedUser.chat_count ?? 0} />
              <DevStat label="Контактов" value={selectedUser.contacts_count ?? 0} />
              <DevStat label="Историй" value={selectedUser.active_stories ?? 0} />
              <DevStat label="Заблочил" value={selectedUser.blocks_out ?? 0} />
              <DevStat label="Заблочен" value={selectedUser.blocks_in ?? 0} />
            </div>

            {/* Прогресс */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              <DevStat label="Уровень" value={selectedUser.level ?? 1} accent="violet" />
              <DevStat label="XP" value={selectedUser.xp ?? 0} accent="violet" />
              <DevStat label="Стрик" value={`${selectedUser.daily_streak ?? 0} 🔥`} accent="amber" />
            </div>

            {/* Кошельки */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              <DevStat label="Баланс ₽" value={(selectedUser.wallet_balance ?? 0).toFixed(2)} accent="emerald" />
              <DevStat label="Молнии ⚡" value={selectedUser.lightning_balance ?? 0} accent="amber" />
            </div>

            {/* Пополнить баланс */}
            <div className="mb-4 glass rounded-xl p-3">
              <div className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                <Icon name="Wallet" size={13} /> Пополнить баланс
              </div>
              <div className="flex gap-2 mb-2">
                <div className="flex items-center gap-1 flex-1 glass rounded-xl px-3 py-2">
                  <input
                    type="number"
                    value={topupAmount}
                    onChange={e => setTopupAmount(e.target.value)}
                    placeholder="Сумма"
                    className="flex-1 bg-transparent outline-none text-sm w-full"
                  />
                  <span className="text-sm text-muted-foreground">₽</span>
                </div>
                <button
                  onClick={doTopup}
                  disabled={topupBusy || !topupAmount}
                  className="px-4 py-2 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-emerald-500/25 transition-colors"
                >
                  {topupBusy ? "..." : topupDone ? "✓" : "Зачислить"}
                </button>
              </div>
              <div className="flex gap-1.5">
                {[100, 300, 500, 1000].map(v => (
                  <button
                    key={v}
                    onClick={() => setTopupAmount(String(v))}
                    className="flex-1 py-1.5 glass rounded-lg text-xs font-semibold hover:bg-white/10 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Отрицательная сумма — списание.</p>
            </div>

            {/* Профиль и приватность */}
            <div className="space-y-1.5 mb-4 text-xs">
              <DevRow label="Зарегистрирован" value={fmtDate(selectedUser.created_at)} />
              <DevRow label="Последний вход" value={fmtTime(selectedUser.last_seen || 0)} />
              {selectedUser.last_message_at ? <DevRow label="Последнее сообщение" value={fmtTime(selectedUser.last_message_at)} /> : null}
              {selectedUser.gender && <DevRow label="Пол" value={selectedUser.gender === "male" ? "мужской" : "женский"} />}
              {selectedUser.birthdate && <DevRow label="Др" value={selectedUser.birthdate} />}
              <DevRow label="Кто пишет" value={selectedUser.who_can_message ?? "everyone"} />
              <DevRow label="Кто звонит" value={selectedUser.who_can_call ?? "everyone"} />
              <DevRow label="Push-устройств" value={selectedUser.push_subscriptions ?? 0} />
              {selectedUser.pro_until ? <DevRow label="PRO до" value={fmtDate(selectedUser.pro_until)} /> : null}
              <DevRow label="PRO trial использован" value={selectedUser.pro_trial_used ? "да" : "нет"} />
              {selectedUser.stickers_subscription_until ? <DevRow label="Стикеры до" value={fmtDate(selectedUser.stickers_subscription_until)} /> : null}
            </div>

            {/* BOT */}
            {selectedUser.is_bot && (
              <div className="mb-4 glass rounded-xl p-3 text-xs space-y-1.5">
                <div className="font-bold text-sky-300 mb-1 flex items-center gap-1.5">
                  <Icon name="Bot" size={13} /> Бот
                </div>
                {selectedUser.bot_username && <DevRow label="@" value={selectedUser.bot_username} />}
                {selectedUser.bot_owner_id && <DevRow label="Владелец" value={`#${selectedUser.bot_owner_id}`} />}
                {selectedUser.bot_webhook_url && <DevRow label="Webhook" value={selectedUser.bot_webhook_url} />}
                {selectedUser.bot_description && <p className="text-muted-foreground italic mt-1">{selectedUser.bot_description}</p>}
              </div>
            )}

            {/* Свои боты */}
            {selectedUser.owned_bots && selectedUser.owned_bots.length > 0 && (
              <div className="mb-4 glass rounded-xl p-3 text-xs">
                <div className="font-bold mb-1.5 flex items-center gap-1.5">
                  <Icon name="Bot" size={13} className="text-sky-300" /> Боты ({selectedUser.owned_bots.length})
                </div>
                <div className="space-y-1">
                  {selectedUser.owned_bots.map(b => (
                    <div key={b.id} className="flex justify-between">
                      <span>{b.name}</span>
                      <span className="text-muted-foreground font-mono">@{b.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 mb-2">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="flex-1 glass rounded-xl px-4 py-2.5 text-sm outline-none"
                placeholder="Новое имя"
              />
              <button onClick={onSaveUser} disabled={saving} className="px-4 py-2.5 grad-primary rounded-xl text-white text-sm font-bold disabled:opacity-50">
                {saving ? "..." : "Сохранить"}
              </button>
            </div>
            <button
              onClick={() => setShowMessage(true)}
              className="w-full py-2.5 mb-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl text-sm font-semibold hover:bg-violet-500/20 transition-colors"
            >
              ✉️ Написать сообщение
            </button>
            {showMessage && (
              <div className="mb-2 animate-fade-in">
                <textarea
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Текст сообщения от Nova Dev..."
                  className="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none resize-none mb-2"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowMessage(false); setMessageText(""); }}
                    className="flex-1 py-2 glass rounded-xl text-sm text-muted-foreground"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={onSendMessage}
                    disabled={messageSending || !messageText.trim()}
                    className="flex-1 py-2 grad-primary rounded-xl text-white text-sm font-bold disabled:opacity-50"
                  >
                    {messageSending ? "..." : "Отправить"}
                  </button>
                </div>
              </div>
            )}
            <button onClick={() => onDeleteUser(selectedUser.id)}
              className="w-full py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/20 transition-colors">
              Удалить пользователя
            </button>
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 animate-fade-in">
          <div className="glass-strong rounded-3xl p-6 w-full max-w-xs mx-4 animate-scale-in">
            <div className="w-12 h-12 bg-red-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-red-400" />
            </div>
            <h3 className="font-bold text-center mb-1">Удалить пользователя?</h3>
            <p className="text-xs text-muted-foreground text-center mb-5">Все сообщения и данные будут удалены. Это действие необратимо.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 glass rounded-xl text-sm font-semibold"
              >
                Отмена
              </button>
              <button
                onClick={onConfirmDelete}
                className="flex-1 py-3 bg-red-500 rounded-xl text-white text-sm font-bold hover:bg-red-600 transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AdminUsersTab;