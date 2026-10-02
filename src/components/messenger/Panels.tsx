import { useState, useEffect, useRef } from "react";
import { api, uploadMedia, type User } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { applyTheme, getStoredTheme, getStoredFontSize } from "@/lib/theme";
import { BirthdayPickerModal } from "@/components/messenger/BirthdayPickerModal";
import { ProfileHeader } from "@/components/messenger/profile/ProfileHeader";
import { ProfileMenu, type ProfileMenuActions } from "@/components/messenger/profile/ProfileMenu";
import { parseBd } from "@/components/messenger/profileUtils";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

// SearchPanel вынесен в отдельный файл, реэкспортируем для совместимости.
export { SearchPanel } from "@/components/messenger/SearchPanel";

// ─── ProfilePanel ─────────────────────────────────────────────────────────────

export function ProfilePanel({ currentUser, onUserUpdate, onBack, chatsCount = 0, ...actions }: ProfileMenuActions & {
  currentUser: User;
  onUserUpdate?: (u: User) => void;
  onBack?: () => void;
  chatsCount?: number;
}) {
  useEdgeSwipeBack(onBack);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(currentUser.name);
  const [saving, setSaving] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState(currentUser.about || "");
  const [savingAbout, setSavingAbout] = useState(false);

  const saveAbout = async () => {
    setSavingAbout(true);
    try {
      const data = await api("update_profile", { about: aboutDraft.trim() }, currentUser.id);
      if (data.user) {
        onUserUpdate?.(data.user);
        localStorage.setItem("nova_user", JSON.stringify(data.user));
        setEditingAbout(false);
      }
    } catch { /* ignore */ } finally { setSavingAbout(false); }
  };

  const [savingMeta, setSavingMeta] = useState(false);
  const updateField = async (field: "gender" | "birthdate", value: string | null) => {
    setSavingMeta(true);
    try {
      const data = await api("update_profile", { [field]: value }, currentUser.id);
      if (data.user) {
        onUserUpdate?.(data.user);
        localStorage.setItem("nova_user", JSON.stringify(data.user));
      }
    } catch { /* ignore */ } finally { setSavingMeta(false); }
  };
  const [bdayPickerOpen, setBdayPickerOpen] = useState(false);
  const initBd = parseBd(currentUser.birthdate);
  const [bdDay, setBdDay] = useState<number>(initBd.d);
  const [bdMonth, setBdMonth] = useState<number>(initBd.mo);
  const [bdYear, setBdYear] = useState<number>(initBd.y);
  const saveBirthdate = async () => {
    const iso = `${bdYear}-${String(bdMonth).padStart(2, "0")}-${String(bdDay).padStart(2, "0")}`;
    await updateField("birthdate", iso);
    setBdayPickerOpen(false);
  };
  const clearBirthdate = async () => {
    await updateField("birthdate", null);
    setBdayPickerOpen(false);
  };
  const [contactsCount, setContactsCount] = useState<number>(0);

  useEffect(() => { applyTheme(getStoredTheme(), getStoredFontSize()); }, []);

  useEffect(() => {
    let cancelled = false;
    api("get_contacts", {}, currentUser.id).then((d) => {
      if (cancelled) return;
      if (Array.isArray(d.contacts)) setContactsCount(d.contacts.length);
    }).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [currentUser.id]);

  const saveName = async () => {
    if (editName.trim().length < 2) return;
    setSaving(true);
    try {
      const data = await api("update_profile", { name: editName.trim() }, currentUser.id);
      if (data.user) {
        onUserUpdate?.(data.user);
        localStorage.setItem("nova_user", JSON.stringify(data.user));
        setEditing(false);
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const onPickAvatar = () => fileInputRef.current?.click();

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setAvatarError("Можно загрузить только изображение"); return; }
    if (file.size > MAX_AVATAR_SIZE) { setAvatarError("Файл слишком большой (макс 5 МБ)"); return; }
    setAvatarError("");
    setUploadingAvatar(true);
    try {
      const up = await uploadMedia(file, currentUser.id);
      const data = await api("update_profile", { avatar_url: up.url }, currentUser.id);
      if (data.user) {
        onUserUpdate?.(data.user);
        localStorage.setItem("nova_user", JSON.stringify(data.user));
      } else {
        setAvatarError(data.error || "Не удалось обновить аватар");
      }
    } catch (err) {
      setAvatarError((err as Error).message || "Ошибка загрузки");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const data = await api("update_profile", { avatar_url: null }, currentUser.id);
      if (data.user) {
        onUserUpdate?.(data.user);
        localStorage.setItem("nova_user", JSON.stringify(data.user));
      }
    } finally { setUploadingAvatar(false); }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in overflow-y-auto">
      <ProfileHeader
        currentUser={currentUser}
        onBack={onBack}
        fileInputRef={fileInputRef}
        uploadingAvatar={uploadingAvatar}
        avatarError={avatarError}
        onPickAvatar={onPickAvatar}
        onAvatarFile={onAvatarFile}
        removeAvatar={removeAvatar}
        editing={editing}
        editName={editName}
        setEditName={setEditName}
        saving={saving}
        saveName={saveName}
        setEditing={setEditing}
        editingAbout={editingAbout}
        setEditingAbout={setEditingAbout}
        aboutDraft={aboutDraft}
        setAboutDraft={setAboutDraft}
        savingAbout={savingAbout}
        saveAbout={saveAbout}
        savingMeta={savingMeta}
        updateField={updateField}
        setBdDay={setBdDay}
        setBdMonth={setBdMonth}
        setBdYear={setBdYear}
        setBdayPickerOpen={setBdayPickerOpen}
      />

      <ProfileMenu
        {...actions}
        currentUser={currentUser}
        chatsCount={chatsCount}
        contactsCount={contactsCount}
        onEditProfile={() => {
          setEditName(currentUser.name);
          setEditing(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      <BirthdayPickerModal
        open={bdayPickerOpen}
        bdDay={bdDay} bdMonth={bdMonth} bdYear={bdYear}
        setBdDay={setBdDay} setBdMonth={setBdMonth} setBdYear={setBdYear}
        hasBirthdate={!!currentUser.birthdate}
        savingMeta={savingMeta}
        onClose={() => setBdayPickerOpen(false)}
        onClear={clearBirthdate}
        onSave={saveBirthdate}
      />
    </div>
  );
}

// Re-export для обратной совместимости
export { SettingsPanel } from "@/components/messenger/SettingsPanel";