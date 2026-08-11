import Icon from "@/components/ui/icon";
import { type User, type IconName } from "@/lib/api";
import { formatBirthdate, calcAge, parseBd, formatPhone } from "@/components/messenger/profileUtils";

const MAX_ABOUT_LEN = 200;

export function ProfileHeader({
  currentUser,
  onBack,
  fileInputRef,
  uploadingAvatar,
  avatarError,
  onPickAvatar,
  onAvatarFile,
  removeAvatar,
  editing,
  editName,
  setEditName,
  saving,
  saveName,
  setEditing,
  editingAbout,
  setEditingAbout,
  aboutDraft,
  setAboutDraft,
  savingAbout,
  saveAbout,
  savingMeta,
  updateField,
  setBdDay,
  setBdMonth,
  setBdYear,
  setBdayPickerOpen,
}: {
  currentUser: User;
  onBack?: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  uploadingAvatar: boolean;
  avatarError: string;
  onPickAvatar: () => void;
  onAvatarFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeAvatar: () => void;
  editing: boolean;
  editName: string;
  setEditName: (v: string) => void;
  saving: boolean;
  saveName: () => void;
  setEditing: (v: boolean) => void;
  editingAbout: boolean;
  setEditingAbout: (v: boolean) => void;
  aboutDraft: string;
  setAboutDraft: (v: string) => void;
  savingAbout: boolean;
  saveAbout: () => void;
  savingMeta: boolean;
  updateField: (field: "gender" | "birthdate", value: string | null) => void;
  setBdDay: (v: number) => void;
  setBdMonth: (v: number) => void;
  setBdYear: (v: number) => void;
  setBdayPickerOpen: (v: boolean) => void;
}) {
  return (
    <>
      {onBack && (
        <div className="md:hidden px-3 pt-3 flex items-center" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/8 transition-colors">
            <Icon name="ChevronLeft" size={20} />
          </button>
          <span className="text-sm text-muted-foreground ml-1">Назад</span>
        </div>
      )}
      <div className="relative px-6 pt-4 pb-6 text-center">
        <div className="relative inline-block mb-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-4xl font-bold text-white overflow-hidden animate-pulse-glow">
            {currentUser.avatar_url ? (
              <img src={currentUser.avatar_url} alt={currentUser.name} className="w-full h-full object-cover" />
            ) : (
              currentUser.name[0]?.toUpperCase() || "Я"
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={onPickAvatar}
            disabled={uploadingAvatar}
            title="Загрузить фото"
            className="absolute bottom-0 right-0 w-8 h-8 grad-primary rounded-full flex items-center justify-center text-white shadow-lg disabled:opacity-60"
          >
            <Icon name="Camera" size={14} />
          </button>
          {currentUser.avatar_url && !uploadingAvatar && (
            <button
              onClick={removeAvatar}
              title="Убрать фото"
              className="absolute -top-1 -right-1 w-6 h-6 bg-black/70 hover:bg-red-500 rounded-full flex items-center justify-center text-white"
            >
              <Icon name="X" size={12} />
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarFile} />
        </div>
        {avatarError && <p className="text-red-400 text-xs mb-2">{avatarError}</p>}
        {editing ? (
          <div className="flex items-center justify-center gap-2 mt-1">
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditing(false); }}
              className="text-xl font-bold bg-transparent border-b-2 border-violet-500 outline-none text-center w-48"
            />
            <button onClick={saveName} disabled={saving} className="p-1.5 grad-primary rounded-lg text-white">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name="Check" size={14} />}
            </button>
            <button onClick={() => setEditing(false)} className="p-1.5 glass rounded-lg text-muted-foreground">
              <Icon name="X" size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mt-1">
            <h2 className="text-2xl font-bold" style={{ color: currentUser.name_color || undefined }}>{currentUser.name}</h2>
            {currentUser.verified && (
              <Icon name="BadgeCheck" size={20} className="text-sky-400 flex-shrink-0" />
            )}
            <button onClick={() => { setEditName(currentUser.name); setEditing(true); }} className="p-1 text-muted-foreground hover:text-violet-400 transition-colors">
              <Icon name="Pencil" size={14} />
            </button>
          </div>
        )}
        <p className="text-muted-foreground text-sm mt-1">{formatPhone(currentUser.phone)}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-medium">В сети</span>
        </div>
        {editingAbout ? (
          <div className="mt-3 glass rounded-2xl p-3 text-left">
            <textarea
              autoFocus
              value={aboutDraft}
              maxLength={MAX_ABOUT_LEN}
              onChange={(e) => setAboutDraft(e.target.value)}
              placeholder="Расскажи о себе…"
              rows={3}
              className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-muted-foreground">{aboutDraft.length}/{MAX_ABOUT_LEN}</span>
              <div className="flex gap-2">
                <button onClick={() => setEditingAbout(false)} className="px-3 py-1.5 rounded-lg text-xs hover:bg-white/8">Отмена</button>
                <button onClick={saveAbout} disabled={savingAbout} className="px-3 py-1.5 grad-primary rounded-lg text-xs text-white font-semibold disabled:opacity-50">
                  {savingAbout ? "Сохраняем..." : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setAboutDraft(currentUser.about || ""); setEditingAbout(true); }}
            className="mt-3 w-full px-4 py-2.5 glass rounded-2xl text-sm text-left hover:bg-white/8 transition-colors group flex items-start gap-2"
          >
            <span className={`flex-1 ${currentUser.about ? "text-foreground" : "text-muted-foreground italic"}`}>
              {currentUser.about || "Расскажи о себе — это увидят твои контакты"}
            </span>
            <Icon name="Pencil" size={13} className="text-muted-foreground group-hover:text-violet-400 mt-0.5 flex-shrink-0" />
          </button>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="glass rounded-2xl p-3">
            <div className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Icon name="User" size={11} />
              Пол
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => updateField("gender", currentUser.gender === "male" ? null : "male")}
                disabled={savingMeta}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${currentUser.gender === "male" ? "grad-primary text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}
              >
                <Icon name="Mars" size={12} className="inline mr-1" fallback="User" />
                М
              </button>
              <button
                onClick={() => updateField("gender", currentUser.gender === "female" ? null : "female")}
                disabled={savingMeta}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${currentUser.gender === "female" ? "bg-pink-500 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}
              >
                <Icon name="Venus" size={12} className="inline mr-1" fallback="User" />
                Ж
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              const b = parseBd(currentUser.birthdate);
              setBdDay(b.d); setBdMonth(b.mo); setBdYear(b.y);
              setBdayPickerOpen(true);
            }}
            className="glass rounded-2xl p-3 text-left active:scale-[0.98] transition"
          >
            <div className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Icon name="Cake" size={11} />
              Дата рождения
            </div>
            <div className="text-xs font-semibold text-foreground truncate">
              {formatBirthdate(currentUser.birthdate)}
            </div>
            {calcAge(currentUser.birthdate) !== null && (
              <div className="text-[10px] text-violet-400 mt-0.5">
                {calcAge(currentUser.birthdate)} {(() => {
                  const a = calcAge(currentUser.birthdate)!;
                  const m = a % 100;
                  if (m >= 11 && m <= 14) return "лет";
                  const l = a % 10;
                  if (l === 1) return "год";
                  if (l >= 2 && l <= 4) return "года";
                  return "лет";
                })()}
              </div>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export default ProfileHeader;
export type { IconName };