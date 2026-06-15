import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import type { IconName } from "@/lib/api";

const EMOJI_CATEGORIES: { id: string; icon: IconName; label: string; emojis: string[] }[] = [
  {
    id: "smileys", icon: "Smile", label: "Смайлы",
    emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","😵","🤯","🥳","🥺","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤐","😶","😐","😑","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾"],
  },
  {
    id: "people", icon: "User", label: "Люди",
    emojis: ["👋","🤚","🖐","✋","🖖","👌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦿","🦶","👂","🦻","👃","🧠","🦷","🦴","👀","👁","👅","👄","👶","🧒","👦","👧","🧑","👱","👨","🧔","👩","🧓","👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷"],
  },
  {
    id: "animals", icon: "PawPrint", label: "Природа",
    emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐽","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🕷","🕸","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐈","🐓","🦃","🦚","🦜","🦢","🦩","🕊","🐇","🦝","🦨","🦡","🦦","🦥","🐁","🐀","🐿","🦔","🌵","🎄","🌲","🌳","🌴","🌱","🌿","☘️","🍀","🎍","🎋","🍃","🍂","🍁","🍄","🐚","🌾","💐","🌷","🌹","🥀","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌙","🌎","🌍","🌏","💫","⭐️","🌟","✨","⚡️","☄️","💥","🔥","🌪","🌈","☀️","🌤","⛅️","🌥","☁️","🌦","🌧","⛈","🌩","🌨","❄️","☃️","⛄️","🌬","💨","💧","💦","☔️","☂️","🌊","🌫"],
  },
  {
    id: "food", icon: "Pizza", label: "Еда",
    emojis: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","🫖","☕️","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾"],
  },
  {
    id: "activity", icon: "Trophy", label: "Активность",
    emojis: ["⚽️","🏀","🏈","⚾️","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳️","🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸","🥌","🎿","⛷","🏂","🪂","🏋️","🤼","🤸","⛹️","🤺","🤾","🏌️","🏇","🧘","🏄","🏊","🤽","🚣","🧗","🚵","🚴","🏆","🥇","🥈","🥉","🏅","🎖","🏵","🎗","🎫","🎟","🎪","🤹","🎭","🩰","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🪘","🎷","🎺","🎸","🪕","🎻","🎲","♟","🎯","🎳","🎮","🎰","🧩"],
  },
  {
    id: "travel", icon: "Plane", label: "Путешествия",
    emojis: ["🚗","🚕","🚙","🚌","🚎","🏎","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🦯","🦽","🦼","🛴","🚲","🛵","🏍","🛺","🚨","🚔","🚍","🚘","🚖","🚡","🚠","🚟","🚃","🚋","🚞","🚝","🚄","🚅","🚈","🚂","🚆","🚇","🚊","🚉","✈️","🛫","🛬","🛩","💺","🛰","🚀","🛸","🚁","🛶","⛵️","🚤","🛥","🛳","⛴","🚢","⚓️","⛽️","🚧","🚦","🚥","🚏","🗺","🗿","🗽","🗼","🏰","🏯","🏟","🎡","🎢","🎠","⛲️","⛱","🏖","🏝","🏜","🌋","⛰","🏔","🗻","🏕","⛺️","🏠","🏡","🏘","🏚","🏗","🏭","🏢","🏬","🏣","🏤","🏥","🏦","🏨","🏪","🏫","🏩","💒","🏛","⛪️","🕌","🕍","🛕","🕋"],
  },
  {
    id: "objects", icon: "Lightbulb", label: "Объекты",
    emojis: ["⌚️","📱","📲","💻","⌨️","🖥","🖨","🖱","🖲","🕹","🗜","💽","💾","💿","📀","📼","📷","📸","📹","🎥","📽","🎞","📞","☎️","📟","📠","📺","📻","🎙","🎚","🎛","🧭","⏱","⏲","⏰","🕰","⌛️","⏳","📡","🔋","🔌","💡","🔦","🕯","🪔","🧯","🛢","💸","💵","💴","💶","💷","🪙","💰","💳","💎","⚖️","🪜","🧰","🪛","🔧","🔨","⚒","🛠","⛏","🪚","🔩","⚙️","🪤","🧱","⛓","🧲","🔫","💣","🧨","🪓","🔪","🗡","⚔️","🛡","🚬","⚰️","🪦","⚱️","🏺","🔮","📿","🧿","💈","⚗️","🔭","🔬","🕳","🩹","🩺","💊","💉","🩸","🧬","🦠","🧫","🧪","🌡","🧹","🪠","🧺","🧻","🚽","🚰","🚿","🛁","🛀","🧼","🪥","🪒","🧽","🪣","🧴","🛎","🔑","🗝","🚪","🪑","🛋","🛏","🛌","🧸","🪆","🖼","🪞","🪟","🛍","🛒","🎁","🎈","🎏","🎀","🪄","🪅","🎊","🎉","🎎","🏮","🎐","🧧","✉️","📩","📨","📧","💌","📥","📤","📦","🏷","🪧","📪","📫","📬","📭","📮","📯","📜","📃","📄","📑","🧾","📊","📈","📉","🗒","🗓","📆","📅","🗑","📇","🗃","🗳","🗄","📋","📁","📂","🗂","🗞","📰","📓","📔","📒","📕","📗","📘","📙","📚","📖","🔖","🧷","🔗","📎","🖇","📐","📏","🧮","📌","📍","✂️","🖊","🖋","✒️","🖌","🖍","📝","✏️","🔍","🔎","🔏","🔐","🔒","🔓"],
  },
  {
    id: "symbols", icon: "Heart", label: "Символы",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈️","♉️","♊️","♋️","♌️","♍️","♎️","♏️","♐️","♑️","♒️","♓️","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚️","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕️","🛑","⛔️","📛","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🚭","❗️","❕","❓","❔","‼️","⁉️","🔅","🔆","〽️","⚠️","🚸","🔱","⚜️","🔰","♻️","✅","🈯️","💹","❇️","✳️","❎","🌐","💠","Ⓜ️","🌀","💤","🏧","🚾","♿️","🅿️","🛗","🈳","🈂️","🛂","🛃","🛄","🛅","🚹","🚺","🚼","⚧","🚻","🚮","🎦","📶","🈁","🔣","ℹ️","🔤","🔡","🔠","🆖","🆗","🆙","🆒","🆕","🆓","0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","🔢","#️⃣","*️⃣","⏏️","▶️","⏸","⏯","⏹","⏺","⏭","⏮","⏩","⏪","⏫","⏬","◀️","🔼","🔽","➡️","⬅️","⬆️","⬇️","↗️","↘️","↙️","↖️","↕️","↔️","↪️","↩️","⤴️","⤵️","🔀","🔁","🔂","🔄","🔃","🎵","🎶","➕","➖","➗","✖️","♾","💲","💱","™️","©️","®️","〰️","➰","➿","🔚","🔙","🔛","🔝","🔜","✔️","☑️","🔘","🔴","🟠","🟡","🟢","🔵","🟣","⚫️","⚪️","🟤","🔺","🔻","🔸","🔹","🔶","🔷","🔳","🔲","▪️","▫️","◾️","◽️","◼️","◻️","🟥","🟧","🟨","🟩","🟦","🟪","⬛️","⬜️","🟫","🔈","🔇","🔉","🔊","🔔","🔕","📣","📢","💬","💭","🗯","♠️","♣️","♥️","♦️","🃏","🎴","🀄️","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚","🕛"],
  },
];

// «Стикер»-паки на основе крупных эмодзи
const STICKER_PACKS: { id: string; name: string; emojis: string[] }[] = [
  { id: "love",   name: "Любовь",   emojis: ["😍","🥰","😘","💋","💖","💕","💞","💓","❤️","🌹","💐","🥺","😊"] },
  { id: "fire",   name: "Огонь",    emojis: ["🔥","💥","⚡️","🌟","✨","💫","⭐️","🚀","🎯","💯","🏆","👑","🎉"] },
  { id: "lol",    name: "Смех",     emojis: ["😂","🤣","😆","😅","😹","😄","😁","🙃","😜","🤪","😝","😎","🤩"] },
  { id: "sad",    name: "Грусть",   emojis: ["😢","😭","🥺","😔","😞","😟","😩","😫","💔","😿","😪","🥲","😣"] },
  { id: "ok",     name: "ОК",       emojis: ["👍","👌","✌️","🤝","🙏","💪","🫡","✅","🆗","👏","🤘","🤞","🙌"] },
  { id: "party",  name: "Праздник", emojis: ["🎉","🎊","🎂","🎁","🎈","🥳","🎆","🎇","🪅","🎄","🎃","🍾","🥂"] },
];

export function EmojiStickerPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (text: string) => void;
}) {
  const [tab, setTab] = useState<"emoji" | "stickers">("emoji");
  const [cat, setCat] = useState<string>(EMOJI_CATEGORIES[0].id);
  const [recent, setRecent] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem("nova_recent_emoji") || "[]");
      if (Array.isArray(r)) setRecent(r);
    } catch { /* ignore */ }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selected = EMOJI_CATEGORIES.find(c => c.id === cat) || EMOJI_CATEGORIES[0];

  const pick = (emoji: string) => {
    onPick(emoji);
    const next = [emoji, ...recent.filter(r => r !== emoji)].slice(0, 32);
    setRecent(next);
    try { localStorage.setItem("nova_recent_emoji", JSON.stringify(next)); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 animate-fade-in" />
      <div
        ref={ref}
        onClick={e => e.stopPropagation()}
        className="relative w-full glass-strong rounded-t-3xl p-3 pt-2 shadow-2xl animate-slide-up"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex justify-center pb-2">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
      <div className="flex gap-1 mb-2 p-1 bg-white/5 rounded-xl">
        <button
          onClick={() => setTab("emoji")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${tab === "emoji" ? "grad-primary text-white" : "text-muted-foreground"}`}
        >Эмодзи</button>
        <button
          onClick={() => setTab("stickers")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${tab === "stickers" ? "grad-primary text-white" : "text-muted-foreground"}`}
        >Стикеры</button>
      </div>

      {tab === "emoji" ? (
        <>
          {recent.length > 0 && (
            <>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">Недавние</div>
              <div className="grid grid-cols-8 gap-0.5 mb-2 max-h-20 overflow-y-auto">
                {recent.map((e, i) => (
                  <button key={i} onClick={() => pick(e)} className="text-xl p-1.5 rounded-lg hover:bg-white/10">{e}</button>
                ))}
              </div>
            </>
          )}
          <div className="grid grid-cols-8 gap-0.5 max-h-[40vh] overflow-y-auto">
            {selected.emojis.map((e, i) => (
              <button key={i} onClick={() => pick(e)} className="text-xl p-1.5 rounded-lg hover:bg-white/10 transition">{e}</button>
            ))}
          </div>
          <div className="flex gap-1 mt-2 pt-2 border-t border-white/5 overflow-x-auto no-scrollbar">
            {EMOJI_CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`p-1.5 rounded-lg flex-shrink-0 ${cat === c.id ? "bg-violet-500/20 text-violet-400" : "text-muted-foreground hover:bg-white/8"}`}
                title={c.label}
              >
                <Icon name={c.icon} size={16} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="max-h-[44vh] overflow-y-auto space-y-3">
          {STICKER_PACKS.map(p => (
            <div key={p.id}>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">{p.name}</div>
              <div className="grid grid-cols-5 gap-1">
                {p.emojis.map((e, i) => (
                  <button
                    key={i}
                    onClick={() => pick(e)}
                    className="text-4xl aspect-square rounded-2xl hover:bg-white/10 hover:scale-110 transition flex items-center justify-center"
                  >{e}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

export default EmojiStickerPicker;