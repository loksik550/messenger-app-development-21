import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";
import { useState } from "react";

export interface InlineButton {
  text: string;
  callback_data?: string | null;
  url?: string | null;
}

export default function BotInlineButtons({
  rows,
  chatId,
  messageId,
  currentUserId,
}: {
  rows: InlineButton[][];
  chatId: number;
  messageId: number;
  currentUserId: number;
}) {
  const [busy, setBusy] = useState<string>("");
  const [done, setDone] = useState<string>("");

  const click = async (btn: InlineButton) => {
    if (btn.url) {
      if (!/^https?:\/\//i.test(btn.url)) return;
      window.open(btn.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!btn.callback_data) return;
    const key = `${btn.callback_data}:${btn.text}`;
    setBusy(key);
    const r = await api(
      "bot_callback",
      { chat_id: chatId, message_id: messageId, callback_data: btn.callback_data },
      currentUserId,
    );
    setBusy("");
    if (r && !r.error) {
      setDone(key);
      setTimeout(() => setDone(""), 800);
    }
  };

  return (
    <div className="flex flex-col gap-1 mt-1.5 max-w-[72%]">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((btn, bi) => {
            const key = `${btn.callback_data}:${btn.text}`;
            const isBusy = busy === key;
            const isDone = done === key;
            return (
              <button
                key={bi}
                onClick={() => click(btn)}
                disabled={isBusy}
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 transition text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {isDone ? (
                  <Icon name="Check" size={12} className="text-emerald-400" />
                ) : btn.url ? (
                  <Icon name="ExternalLink" size={11} className="text-violet-400" />
                ) : isBusy ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                <span className="truncate">{btn.text}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
