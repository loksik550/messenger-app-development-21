import type { Dispatch, SetStateAction } from "react";
import Icon from "@/components/ui/icon";
import type { Group } from "@/lib/api";
import type { VerifState } from "@/components/messenger/group-profile/useGroupProfileData";

interface Props {
  info: Group;
  isAdmin: boolean;
  isOwner: boolean;
  // описание
  editingDesc: boolean;
  setEditingDesc: (v: boolean) => void;
  editDesc: string;
  setEditDesc: (v: string) => void;
  saveDesc: () => void;
  // ссылка-приглашение
  fullInviteUrl: string;
  copyState: "idle" | "ok";
  copyInvite: () => void;
  regenBusy: boolean;
  regenerateInvite: () => void;
  // верификация
  verifState: VerifState;
  verifBusy: boolean;
  applyVerification: () => void;
  // только админы
  onlyAdmins: boolean;
  toggleOnlyAdmins: () => void;
  // уведомления
  muted: boolean;
  muteLabel: string;
  muteMenuOpen: boolean;
  setMuteMenuOpen: Dispatch<SetStateAction<boolean>>;
  applyMute: (mute: boolean, hours?: number) => void;
  // действия
  setConfirmClear: (v: boolean) => void;
  setConfirmLeave: (v: boolean) => void;
  setConfirmDelete: (v: boolean) => void;
}

const fmtDate = (ts: number) => ts ? new Date(ts * 1000).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" }) : "";

export function GroupInfoTab({
  info, isAdmin, isOwner,
  editingDesc, setEditingDesc, editDesc, setEditDesc, saveDesc,
  fullInviteUrl, copyState, copyInvite, regenBusy, regenerateInvite,
  verifState, verifBusy, applyVerification,
  onlyAdmins, toggleOnlyAdmins,
  muted, muteLabel, muteMenuOpen, setMuteMenuOpen, applyMute,
  setConfirmClear, setConfirmLeave, setConfirmDelete,
}: Props) {
  return (
          <div className="px-4 py-4 space-y-3 animate-fade-in">
            {/* Описание */}
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Описание</span>
                {isAdmin && !editingDesc && (
                  <button onClick={() => setEditingDesc(true)} className="text-xs text-violet-400 font-medium">
                    {info.description ? "Изменить" : "Добавить"}
                  </button>
                )}
              </div>
              {editingDesc ? (
                <>
                  <textarea
                    autoFocus
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    placeholder="Расскажите о группе..."
                    rows={4}
                    className="w-full glass rounded-xl px-3 py-2 text-sm outline-none resize-none mb-2"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveDesc} className="flex-1 grad-primary rounded-xl py-2 text-white text-xs font-bold">Сохранить</button>
                    <button onClick={() => { setEditDesc(info.description || ""); setEditingDesc(false); }} className="flex-1 glass rounded-xl py-2 text-xs">Отмена</button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                  {info.description || <span className="text-muted-foreground italic">Описания пока нет</span>}
                </p>
              )}
            </div>

            {/* Invite link */}
            {isAdmin && (
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Ссылка-приглашение</span>
                  <Icon name="Link" size={14} className="text-violet-400" />
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Поделись ссылкой, чтобы кто угодно мог присоединиться к {info.is_channel ? "каналу" : "группе"}.
                </p>
                <div className="flex items-center gap-2 glass rounded-xl px-3 py-2 mb-2">
                  <Icon name="Globe" size={14} className="text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-xs truncate font-mono">{fullInviteUrl || "—"}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyInvite}
                    disabled={!fullInviteUrl}
                    className="flex-1 grad-primary text-white rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {copyState === "ok"
                      ? <><Icon name="Check" size={12} /> Скопировано</>
                      : <><Icon name="Copy" size={12} /> Копировать</>}
                  </button>
                  <button
                    onClick={regenerateInvite}
                    disabled={regenBusy}
                    className="flex-1 glass rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    {regenBusy
                      ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Icon name="RefreshCw" size={12} /> Обновить</>}
                  </button>
                </div>
              </div>
            )}

            {/* Верификация канала/группы — только владелец */}
            {isOwner && (
              <div className="glass rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <Icon name="BadgeCheck" size={20} className="text-sky-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-0.5">
                      {verifState.verified ? "Подтверждён" : "Верификация"}
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      {verifState.verified
                        ? "Синяя галочка подтверждает подлинность"
                        : verifState.request?.status === "pending"
                          ? "Заявка на рассмотрении, обычно до трёх дней"
                          : "Синяя галочка защитит от подделок"}
                    </p>
                    {!verifState.verified && verifState.request?.status !== "pending" && (
                      <button
                        onClick={applyVerification}
                        disabled={verifBusy}
                        className="px-3 py-1.5 rounded-xl grad-primary text-white text-xs font-bold disabled:opacity-60"
                      >
                        {verifBusy ? "Отправляем..." : "Подать заявку"}
                      </button>
                    )}
                    {verifState.request?.status === "rejected" && !verifState.verified && (
                      <p className="text-[11px] text-red-400 mt-2">
                        Прошлая заявка отклонена{verifState.request.note ? `: ${verifState.request.note}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Только админы могут писать (для каналов и групп) */}
            {isOwner && (
              <div className="glass rounded-2xl p-4 flex items-center gap-3">
                <Icon name="ShieldCheck" size={20} className="text-violet-400" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">Писать могут только админы</div>
                  <p className="text-[11px] text-muted-foreground">
                    {info.is_channel ? "Стандартное поведение каналов" : "Превратит группу в анонс-канал"}
                  </p>
                </div>
                <button
                  onClick={toggleOnlyAdmins}
                  className={`w-11 h-6 rounded-full transition ${onlyAdmins ? "bg-violet-500" : "bg-white/10"}`}
                >
                  <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${onlyAdmins ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            )}

            {/* Уведомления (mute) */}
            <div className="glass rounded-2xl overflow-hidden relative">
              <button
                onClick={() => (muted ? applyMute(false) : setMuteMenuOpen(v => !v))}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left"
              >
                <Icon
                  name={muted ? "BellOff" : "Bell"}
                  size={18}
                  className={muted ? "text-amber-400" : "text-violet-400"}
                />
                <div className="flex-1">
                  <div className="font-semibold text-sm">
                    {muted ? "Уведомления отключены" : "Уведомления"}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{muteLabel}</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition ${muted ? "bg-amber-500/70" : "bg-white/10"}`}>
                  <span
                    className={`block w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${
                      muted ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </button>
              {muteMenuOpen && !muted && (
                <div className="border-t border-white/10 divide-y divide-white/5">
                  {[
                    { h: 1, label: "На 1 час" },
                    { h: 8, label: "На 8 часов" },
                    { h: 24 * 7, label: "На неделю" },
                    { h: 0, label: "Навсегда" },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => applyMute(true, opt.h || undefined)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Дата создания */}
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <Icon name="Calendar" size={16} className="text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Создано</div>
                  <div className="text-sm font-medium">{fmtDate(info.created_at as number) || "—"}</div>
                </div>
              </div>
            </div>

            {/* Действия */}
            <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
              <button
                onClick={() => setConfirmClear(true)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left"
              >
                <Icon name="Eraser" size={18} className="text-amber-400" />
                <span className="text-sm font-medium">Очистить переписку</span>
              </button>
              {!isOwner && (
                <button
                  onClick={() => setConfirmLeave(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition text-left"
                >
                  <Icon name="LogOut" size={18} className="text-red-400" />
                  <span className="text-sm font-medium text-red-400">
                    Покинуть {info.is_channel ? "канал" : "группу"}
                  </span>
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition text-left"
                >
                  <Icon name="Trash2" size={18} className="text-red-400" />
                  <span className="text-sm font-medium text-red-400">
                    Удалить {info.is_channel ? "канал" : "группу"}
                  </span>
                </button>
              )}
            </div>
          </div>
  );
}

export default GroupInfoTab;
