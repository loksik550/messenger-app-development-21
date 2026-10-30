import { useState } from "react";
import Icon from "@/components/ui/icon";
import {
  RINGTONES, NOTIFY_SOUNDS,
  setRingtoneId, setNotifyId,
  previewRingtone, previewNotifySound, stopRingtone,
  clearCustomRingtone, clearCustomNotify,
} from "@/lib/sounds";
import type { SettingsSounds } from "./useSettingsSounds";
import { SettingsGroup, SettingsIcon } from "./SettingsUI";

type Item = { id: string; name: string };

function SoundPicker({
  icon, color, label, items, value, open, onOpen, onPick, onPreview, onStop, customName, onUpload, onClearCustom,
}: {
  icon: string; color: string; label: string; items: Item[]; value: string; open: boolean; onOpen: () => void;
  onPick: (id: string) => void; onPreview: (id: string) => void; onStop?: () => void;
  customName?: string | null; onUpload: () => void; onClearCustom: () => void;
}) {
  const current = items.find(i => i.id === value);
  return (
    <div>
      <button type="button" onClick={onOpen} className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-white/5 transition text-left">
        <SettingsIcon icon={icon} color={color} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-xs text-muted-foreground truncate">{value === "custom" && customName ? customName : current?.name || "—"}</div>
        </div>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1">
          {items.map(it => {
            const isCustom = it.id === "custom";
            const active = value === it.id;
            return (
              <div key={it.id} className={`flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl ${active ? "bg-violet-500/15" : "hover:bg-white/5"}`}>
                <button
                  type="button"
                  onClick={() => (isCustom && !customName ? onUpload() : onPick(it.id))}
                  className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? "border-violet-400" : "border-white/25"}`}>
                    {active && <span className="w-2 h-2 rounded-full bg-violet-400" />}
                  </span>
                  <span className="text-sm truncate">{isCustom ? (customName ? `Свой: ${customName}` : "Загрузить свой звук") : it.name}</span>
                </button>
                {isCustom ? (
                  <>
                    <button type="button" onClick={onUpload} className="p-1.5 rounded-lg hover:bg-white/8" aria-label="Загрузить">
                      <Icon name="Upload" size={14} className="text-violet-400" />
                    </button>
                    {customName && (
                      <>
                        <button type="button" onClick={() => onPreview("custom")} className="p-1.5 rounded-lg hover:bg-white/8" aria-label="Прослушать">
                          <Icon name="Play" size={14} />
                        </button>
                        <button type="button" onClick={onClearCustom} className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-400" aria-label="Удалить">
                          <Icon name="Trash2" size={14} />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => onPreview(it.id)} className="p-1.5 rounded-lg hover:bg-white/8" aria-label="Прослушать">
                      <Icon name="Play" size={14} />
                    </button>
                    {onStop && (
                      <button type="button" onClick={onStop} className="p-1.5 rounded-lg hover:bg-white/8" aria-label="Остановить">
                        <Icon name="Square" size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SoundsSection({ sounds }: { sounds: SettingsSounds }) {
  const {
    ringtone, setRingtone,
    notifySnd, setNotifySnd,
    customMeta, setCustomMeta,
    customNotifyMeta, setCustomNotifyMeta,
    ringFileRef, notifyFileRef,
    soundError,
    onPickRingFile, onRingFile,
    onPickNotifyFile, onNotifyFile,
  } = sounds;
  const [open, setOpen] = useState<"ring" | "notify" | null>(null);

  return (
    <>
      {soundError && (
        <div className="px-4 py-2 glass rounded-xl border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <Icon name="AlertCircle" size={14} />
          <span>{soundError}</span>
        </div>
      )}
      <SettingsGroup title="Звуки" footer="Свой звук — любой аудиофайл до 10 МБ (MP3, WAV, M4A).">
        <SoundPicker
          icon="Bell" color="#f97316" label="Звук сообщений"
          items={NOTIFY_SOUNDS} value={notifySnd}
          open={open === "notify"} onOpen={() => setOpen(o => (o === "notify" ? null : "notify"))}
          onPick={(id) => { setNotifySnd(id as typeof notifySnd); setNotifyId(id as typeof notifySnd); previewNotifySound(id as typeof notifySnd); }}
          onPreview={(id) => previewNotifySound(id as typeof notifySnd)}
          customName={customNotifyMeta?.name}
          onUpload={onPickNotifyFile}
          onClearCustom={async () => { await clearCustomNotify(); setCustomNotifyMeta(null); if (notifySnd === "custom") { setNotifySnd("ping"); setNotifyId("ping"); } }}
        />
        <SoundPicker
          icon="Phone" color="#10b981" label="Мелодия звонка"
          items={RINGTONES} value={ringtone}
          open={open === "ring"} onOpen={() => setOpen(o => (o === "ring" ? null : "ring"))}
          onPick={(id) => { setRingtone(id as typeof ringtone); setRingtoneId(id as typeof ringtone); }}
          onPreview={(id) => previewRingtone(id as typeof ringtone)}
          onStop={() => stopRingtone()}
          customName={customMeta?.name}
          onUpload={onPickRingFile}
          onClearCustom={async () => { await clearCustomRingtone(); setCustomMeta(null); if (ringtone === "custom") { setRingtone("nova"); setRingtoneId("nova"); } }}
        />
      </SettingsGroup>
      <input ref={ringFileRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac" className="hidden" onChange={onRingFile} />
      <input ref={notifyFileRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac" className="hidden" onChange={onNotifyFile} />
    </>
  );
}

export default SoundsSection;
