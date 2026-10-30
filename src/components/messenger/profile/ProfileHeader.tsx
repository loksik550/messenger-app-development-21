import ProName from "@/components/messenger/ProName";
import Icon from "@/components/ui/icon";
import { type User, type IconName } from "@/lib/api";
import ProfileBackdrop from "@/components/messenger/profile/ProfileBackdrop";
import AvatarVideo from "@/components/messenger/AvatarVideo";
import { useState } from "react";
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
  videoInputRef,
  onVideoFile,
  removeVideo,
  onOpenPro,
  onPickBg,
}: {
  currentUser: User;
  onBack?: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
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
  videoInputRef?: React.RefObject<HTMLInputElement | null>;
  onVideoFile?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeVideo?: () => void;
  onOpenPro?: () => void;
  onPickBg?: () => void;
}) {
  const [avatarMenu, setAvatarMenu] = useState(false);
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
        <ProfileBackdrop bg={currentUser.profile_bg} />
        {onPickBg && (
          <button
            onClick={onPickBg}
            className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-black/40 backdrop-blur border border-white/15 text-white hover:bg-black/55"
          >
            <Icon name="Paintbrush" fallback="Palette" size={13} />
            Фон
          </button>
        )}
        <div className="relative z-[1] inline-block mb-5">
          <button
            type="button"
            onClick={() => setAvatarMenu(true)}
            disabled={uploadingAvatar}
            className="relative w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-4xl font-bold text-white overflow-hidden animate-pulse-glow"
            aria-label="Фото профиля"
          >
            {currentUser.avatar_video_url ? (
              <AvatarVideo src={currentUser.avatar_video_url} />
            ) : currentUser.avatar_url ? (
              <img src={currentUser.avatar_url} alt={currentUser.name} className="w-full h-full object-cover" />
            ) : (
              currentUser.name[0]?.toUpperCase() || "Я"
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </button>
          <button
            onClick={() => setAvatarMenu(true)}
            disabled={uploadingAvatar}
            title="Изменить фото"
            className="absolute bottom-0 right-0 w-8 h-8 grad-primary rounded-full flex items-center justify-center text-white shadow-lg ring-2 ring-[hsl(var(--background))] disabled:opacity-60"
          >
            <Icon name="Camera" size={14} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarFile} />
          {videoInputRef && <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={onVideoFile} />}
        </div>
        {avatarMenu && (
          <div className="fixed inset-0 z-[270] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 animate-fade-in" onClick={() => setAvatarMenu(false)}>
            <div className="w-full max-w-sm glass-strong rounded-3xl p-2 animate-scale-in text-left" onClick={(e) => e.stopPropagation()} style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
              <div className="px-3 pt-2 pb-1 text-xs text-muted-foreground">Фото профиля</div>
              {([
                { show: true, icon: "Image", label: currentUser.avatar_url ? "Сменить фото" : "Загрузить фото", act: onPickAvatar },
                { show: !!videoInputRef, icon: currentUser.is_pro ? "Video" : "Lock", label: currentUser.avatar_video_url ? "Сменить видео" : "Видео вместо фото", pro: true,
                  act: () => (currentUser.is_pro ? videoInputRef?.current?.click() : onOpenPro?.()) },
                { show: !!currentUser.avatar_video_url && !!removeVideo, icon: "VideoOff", label: "Убрать видео", red: true, act: () => removeVideo?.() },
                { show: !!currentUser.avatar_url, icon: "Trash2", label: "Убрать фото", red: true, act: removeAvatar },
              ] as { show: boolean; icon: string; label: string; act: () => void; red?: boolean; pro?: boolean }[]).filter((x) => x.show).map((x) => (
                <button
                  key={x.label}
                  onClick={() => { setAvatarMenu(false); x.act(); }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/8 text-sm font-medium ${x.red ? "text-red-400" : ""}`}
                >
                  <Icon name={x.icon} fallback="Circle" size={18} className={x.red ? "text-red-400" : "text-violet-400"} />
                  <span className="flex-1">{x.label}</span>
                  {x.pro && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}>PRO</span>
                  )}
                </button>
              ))}
              <button onClick={() => setAvatarMenu(false)} className="w-full mt-1 py-3 rounded-2xl glass text-sm font-semibold">Отмена</button>
            </div>
          </div>
        )}
        <div className="relative z-[1]">
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
            <h2 className="text-2xl font-bold min-w-0"><ProName name={currentUser.name} isPro={!!currentUser.is_pro} emoji={currentUser.emoji_status} color={currentUser.name_color} effect={currentUser.name_effect} badges={currentUser.badges} maxBadges={6} badgeSize={18} /></h2>
            {currentUser.verified && (
              <Icon name="BadgeCheck" size={20} className="text-sky-400 flex-shrink-0" />
            )}
            <button onClick={() => { setEditName(currentUser.name); setEditing(true); }} className="p-1 text-muted-foreground hover:text-violet-400 transition-colors">
              <Icon name="Pencil" size={14} />
            </button>
          </div>
        )}
        <p className="text-muted-foreground text-sm mt-1">{String(currentUser.phone || "").startsWith("vk") ? "" : formatPhone(currentUser.phone)}</p>
        {currentUser.nova_id && (
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(currentUser.nova_id || "").catch(() => {}); }}
            className="mt-1 inline-flex items-center gap-1 text-xs text-violet-300/90 font-mono px-2 py-0.5 rounded-full bg-violet-500/10 hover:bg-violet-500/20"
            title="Ваш уникальный ID в Nova — нажмите, чтобы скопировать"
          >
            ID {currentUser.nova_id}
          </button>
        )}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("nova:open-nova-id"))}
          className="mt-1 ml-1 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white"
          style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)" }}
        >
          <Icon name="Sparkles" size={11} /> Красивый ID
        </button>
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
      </div>
    </>
  );
}

export default ProfileHeader;
export type { IconName };