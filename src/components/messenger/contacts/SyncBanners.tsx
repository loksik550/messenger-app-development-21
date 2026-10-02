import Icon from "@/components/ui/icon";
import { api, type Chat } from "@/lib/api";
import { Avatar } from "@/components/messenger/ChatAtoms";
import type { FoundFriend, SyncResult } from "@/components/messenger/contacts/useContactsImport";

export function SyncBanners({
  currentUserId,
  onStartChat,
  syncResult,
  onDismissResult,
  foundFriends,
  onDismissFriends,
  syncError,
  onDismissError,
}: {
  currentUserId: number;
  onStartChat: (chat: Chat) => void;
  syncResult: SyncResult | null;
  onDismissResult: () => void;
  foundFriends: FoundFriend[];
  onDismissFriends: () => void;
  syncError: string;
  onDismissError: () => void;
}) {
  return (
    <>
      {syncResult && (
        <div className="mt-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2 animate-fade-in">
          <Icon name="CheckCircle2" size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            Добавлено {syncResult.added} из {syncResult.total}.{" "}
            {syncResult.not_registered > 0 && (
              <span className="text-emerald-300/70">{syncResult.not_registered} ещё не в Nova.</span>
            )}
          </div>
          <button onClick={onDismissResult} className="text-emerald-300/60 hover:text-emerald-300">
            <Icon name="X" size={12} />
          </button>
        </div>
      )}
      {foundFriends.length > 0 && (
        <div className="mt-2 rounded-2xl glass p-3 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-violet-300">Уже в Nova из ваших контактов: {foundFriends.length}</div>
            <button onClick={onDismissFriends} className="text-muted-foreground hover:text-foreground"><Icon name="X" size={12} /></button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {foundFriends.slice(0, 30).map(f => (
              <button
                key={f.id}
                onClick={async () => {
                  const r = await api("get_or_create_chat", { partner_id: f.id }, currentUserId);
                  if (r?.chat_id) onStartChat({
                    id: r.chat_id, name: f.name, avatar: (f.name || "?")[0].toUpperCase(),
                    avatar_url: f.avatar_url || null, lastMsg: "", time: "", partner_id: f.id,
                  } as Chat);
                }}
                className="flex flex-col items-center gap-1 w-16 flex-shrink-0"
              >
                <Avatar label={(f.name || "?")[0].toUpperCase()} id={f.id} src={f.avatar_url || undefined} />
                <span className="text-[11px] truncate w-full text-center">{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {syncError && (
        <div className="mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2 animate-fade-in">
          <Icon name="AlertTriangle" size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">{syncError}</div>
          <button onClick={onDismissError} className="text-amber-300/60 hover:text-amber-300">
            <Icon name="X" size={12} />
          </button>
        </div>
      )}
    </>
  );
}

export default SyncBanners;
