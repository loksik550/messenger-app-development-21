import type { Message } from "@/lib/api";
import { cardById, type BirthdayPayload } from "./birthdayCards";

export default function BirthdayBubble({ msg }: { msg: Message }) {
  const p = (msg.payload || {}) as unknown as BirthdayPayload;
  const card = cardById(p.card);
  const qty = Number(p.quantity) || 0;

  return (
    <div
      className={`relative max-w-[290px] w-full rounded-3xl overflow-hidden text-white ${msg.out ? "ml-auto" : ""}`}
      style={{ background: card.gradient, boxShadow: "0 8px 24px rgba(139,92,246,0.35)" }}
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/15" />
      <div className="absolute -left-5 -bottom-5 w-20 h-20 rounded-full bg-white/10" />
      <div className="relative p-4">
        <div className="text-5xl mb-2">{card.emoji}</div>
        <div className="text-xl font-black leading-tight mb-1">{card.title}</div>
        <div className="text-sm text-white/90 mb-3">{p.message || card.wish}</div>
        {qty > 0 && (
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur rounded-full px-3 py-1 text-sm font-bold mb-2">
            ⚡ {qty} в подарок
          </div>
        )}
        <div className="flex items-center justify-between text-[10px] text-white/75">
          <span>от {msg.out ? "вас" : msg.sender_name || "друга"}</span>
          <span>{msg.time}</span>
        </div>
      </div>
    </div>
  );
}
