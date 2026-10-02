import Icon from "@/components/ui/icon";
import {
  RINGTONES, NOTIFY_SOUNDS,
  setRingtoneId, setNotifyId,
  previewRingtone, previewNotifySound, stopRingtone,
  clearCustomRingtone, clearCustomNotify,
} from "@/lib/sounds";
import type { SettingsSounds } from "./useSettingsSounds";

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

  return (
    <>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mt-4 mb-1 px-1">Звуки</div>
        {soundError && (
          <div className="px-4 py-2 glass rounded-xl border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <Icon name="AlertCircle" size={14} />
            <span>{soundError}</span>
          </div>
        )}

        <div className="px-4 py-3 glass rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Phone" size={16} className="text-violet-400" />
            <span className="text-sm font-medium">Мелодия звонка</span>
          </div>
          <div className="space-y-1.5">
            {RINGTONES.map((r) => (
              <div key={r.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${ringtone === r.id ? "border-violet-500 bg-violet-500/10" : "border-white/5 hover:bg-white/5"}`}>
                <button
                  onClick={() => { setRingtone(r.id); setRingtoneId(r.id); }}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className={`w-5 h-5 rounded-full border-2 ${ringtone === r.id ? "border-violet-500" : "border-white/20"} flex items-center justify-center flex-shrink-0`}>
                    {ringtone === r.id && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{r.name}</div>
                    {r.id === "custom" && customMeta && <div className="text-[11px] text-muted-foreground truncate">{customMeta.name}</div>}
                    {r.id === "custom" && !customMeta && <div className="text-[11px] text-muted-foreground">Файл не загружен</div>}
                  </div>
                </button>
                {r.id === "custom" ? (
                  <>
                    <button onClick={onPickRingFile} className="p-1.5 rounded-lg hover:bg-white/8" title="Загрузить">
                      <Icon name="Upload" size={14} className="text-violet-400" />
                    </button>
                    {customMeta && (
                      <>
                        <button onClick={() => previewRingtone("custom")} className="p-1.5 rounded-lg hover:bg-white/8" title="Прослушать">
                          <Icon name="Play" size={14} />
                        </button>
                        <button onClick={async () => { await clearCustomRingtone(); setCustomMeta(null); if (ringtone === "custom") { setRingtone("nova"); setRingtoneId("nova"); } }} className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-400" title="Удалить">
                          <Icon name="Trash2" size={14} />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => previewRingtone(r.id)} className="p-1.5 rounded-lg hover:bg-white/8" title="Прослушать">
                      <Icon name="Play" size={14} />
                    </button>
                    <button onClick={() => stopRingtone()} className="p-1.5 rounded-lg hover:bg-white/8" title="Остановить">
                      <Icon name="Square" size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <input ref={ringFileRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac" className="hidden" onChange={onRingFile} />
          <p className="text-[11px] text-muted-foreground mt-2">Загрузи MP3, WAV или другой аудиофайл — он будет играть как в Telegram при входящем звонке.</p>
        </div>

        <div className="px-4 py-3 glass rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Bell" size={16} className="text-violet-400" />
            <span className="text-sm font-medium">Звук уведомлений</span>
          </div>
          <div className="space-y-1.5">
            {NOTIFY_SOUNDS.map((s) => (
              <div key={s.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${notifySnd === s.id ? "border-violet-500 bg-violet-500/10" : "border-white/5 hover:bg-white/5"}`}>
                <button
                  onClick={() => {
                    if (s.id === "custom" && !customNotifyMeta) { onPickNotifyFile(); return; }
                    setNotifySnd(s.id); setNotifyId(s.id); previewNotifySound(s.id);
                  }}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className={`w-5 h-5 rounded-full border-2 ${notifySnd === s.id ? "border-violet-500" : "border-white/20"} flex items-center justify-center flex-shrink-0`}>
                    {notifySnd === s.id && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{s.name}</div>
                    {s.id === "custom" && customNotifyMeta && <div className="text-[11px] text-muted-foreground truncate">{customNotifyMeta.name}</div>}
                    {s.id === "custom" && !customNotifyMeta && <div className="text-[11px] text-muted-foreground">Файл не загружен</div>}
                  </div>
                </button>
                {s.id === "custom" ? (
                  <>
                    <button onClick={onPickNotifyFile} className="p-1.5 rounded-lg hover:bg-white/8" title="Загрузить">
                      <Icon name="Upload" size={14} className="text-violet-400" />
                    </button>
                    {customNotifyMeta && (
                      <>
                        <button onClick={() => previewNotifySound("custom")} className="p-1.5 rounded-lg hover:bg-white/8" title="Прослушать">
                          <Icon name="Play" size={14} />
                        </button>
                        <button onClick={async () => { await clearCustomNotify(); setCustomNotifyMeta(null); if (notifySnd === "custom") { setNotifySnd("ping"); setNotifyId("ping"); } }} className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-400" title="Удалить">
                          <Icon name="Trash2" size={14} />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <button onClick={() => previewNotifySound(s.id)} className="p-1.5 rounded-lg hover:bg-white/8">
                    <Icon name="Play" size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <input ref={notifyFileRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac" className="hidden" onChange={onNotifyFile} />
          <p className="text-[11px] text-muted-foreground mt-2">Можно загрузить свой короткий звук для входящих сообщений.</p>
        </div>
    </>
  );
}

export default SoundsSection;
