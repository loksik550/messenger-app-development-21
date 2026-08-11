import { api, type Chat, type User } from "@/lib/api";
import { GiftSendModal, FundraiserAttachModal } from "@/components/messenger/ChatGiftModals";
import { ForwardDialog } from "@/components/messenger/ForwardDialog";
import DisappearingModal from "@/components/messenger/DisappearingModal";
import ScheduleModal from "@/components/messenger/ScheduleModal";
import ScheduledList, { type ScheduledItem } from "@/components/messenger/ScheduledList";
import WallpaperPicker from "@/components/messenger/WallpaperPicker";
import VideoCircleRecorder from "@/components/messenger/VideoCircleRecorder";

// Все модальные окна чата. Разметка и вызовы перенесены
// из ChatComponents.tsx без изменений.
export function ChatModals({
  chat, currentUser, input, setInput,
  showGiftModal, setShowGiftModal,
  showFundModal, setShowFundModal,
  showDisappearing, setShowDisappearing,
  setDisappearingSec, disappearingSec,
  forwardMsgId, setForwardMsgId,
  showVideoCircle, setShowVideoCircle,
  showSchedule, setShowSchedule,
  showScheduledList, setShowScheduledList,
  showWallpaper, setShowWallpaper,
  wallpaper, setWallpaper,
  scheduled, reloadScheduled,
  setLastSince, onUserUpdate, onOpenFundraiser, sendFile,
}: {
  chat: Chat;
  currentUser: User;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  showGiftModal: boolean;
  setShowGiftModal: React.Dispatch<React.SetStateAction<boolean>>;
  showFundModal: boolean;
  setShowFundModal: React.Dispatch<React.SetStateAction<boolean>>;
  showDisappearing: boolean;
  setShowDisappearing: React.Dispatch<React.SetStateAction<boolean>>;
  setDisappearingSec: React.Dispatch<React.SetStateAction<number | null>>;
  disappearingSec: number | null;
  forwardMsgId: number | null;
  setForwardMsgId: React.Dispatch<React.SetStateAction<number | null>>;
  showVideoCircle: boolean;
  setShowVideoCircle: React.Dispatch<React.SetStateAction<boolean>>;
  showSchedule: boolean;
  setShowSchedule: React.Dispatch<React.SetStateAction<boolean>>;
  showScheduledList: boolean;
  setShowScheduledList: React.Dispatch<React.SetStateAction<boolean>>;
  showWallpaper: boolean;
  setShowWallpaper: React.Dispatch<React.SetStateAction<boolean>>;
  wallpaper: string | null;
  setWallpaper: React.Dispatch<React.SetStateAction<string | null>>;
  scheduled: ScheduledItem[];
  reloadScheduled: () => void;
  setLastSince: React.Dispatch<React.SetStateAction<number>>;
  onUserUpdate?: (u: User) => void;
  onOpenFundraiser?: (id: number) => void;
  sendFile: (file: File, extra?: { duration?: number; mediaTypeOverride?: "audio" | "video" | "image" | "file" }) => void;
}) {
  return (
    <>
      {showGiftModal && (
        <GiftSendModal
          currentUser={currentUser}
          chatId={chat.id}
          onClose={() => setShowGiftModal(false)}
          onSent={() => { setLastSince(0); }}
          onUserUpdate={onUserUpdate}
        />
      )}

      {showFundModal && (
        <FundraiserAttachModal
          currentUser={currentUser}
          chatId={chat.id}
          onClose={() => setShowFundModal(false)}
          onSent={() => { setLastSince(0); }}
          onCreate={() => { setShowFundModal(false); onOpenFundraiser?.(-1); }}
        />
      )}

      {showDisappearing && (
        <DisappearingModal
          current={disappearingSec}
          onClose={() => setShowDisappearing(false)}
          onSelect={async (sec) => {
            setShowDisappearing(false);
            const r = await api("chat_set_disappearing", { chat_id: chat.id, seconds: sec ?? 0 }, currentUser.id);
            if (r && !r.error) {
              setDisappearingSec(sec);
              setLastSince(0);
            }
          }}
        />
      )}

      {/* Forward dialog */}
      {forwardMsgId !== null && (
        <ForwardDialog
          messageId={forwardMsgId}
          currentUser={currentUser}
          currentChatId={chat.id}
          onClose={() => setForwardMsgId(null)}
        />
      )}

      {/* Video circle recorder */}
      <VideoCircleRecorder
        open={showVideoCircle}
        onClose={() => setShowVideoCircle(false)}
        onRecorded={(file, duration) => sendFile(file, { duration, mediaTypeOverride: "video" })}
      />

      <ScheduleModal
        open={showSchedule}
        hasContent={!!input.trim()}
        onClose={() => setShowSchedule(false)}
        onConfirm={async (ts) => {
          const r = await api("schedule_message", {
            chat_id: chat.id,
            text: input.trim(),
            scheduled_at: ts,
          }, currentUser.id);
          if (r?.error) throw new Error(r.error);
          setInput("");
          reloadScheduled();
        }}
      />

      <ScheduledList
        open={showScheduledList}
        items={scheduled}
        onClose={() => setShowScheduledList(false)}
        onCancel={async (id) => {
          await api("scheduled_cancel", { id }, currentUser.id);
          reloadScheduled();
        }}
      />

      <WallpaperPicker
        open={showWallpaper}
        current={wallpaper}
        onClose={() => setShowWallpaper(false)}
        onSelect={async (id) => {
          setWallpaper(id);
          if (id) localStorage.setItem(`nova_wp_${chat.id}`, id);
          else localStorage.removeItem(`nova_wp_${chat.id}`);
          await api("set_wallpaper", { chat_id: chat.id, wallpaper: id }, currentUser.id);
        }}
      />
    </>
  );
}

export default ChatModals;
