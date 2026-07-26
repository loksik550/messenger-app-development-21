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
  const [search, setSearch] = useState("");
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

  // Поиск по эмодзи: по названию категории (смайлы, люди, еда…)
  const q = search.trim().toLowerCase();
  const searchResults = q
    ? Array.from(new Set(
        EMOJI_CATEGORIES
          .filter(c => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
          .flatMap(c => c.emojis)
      ))
    : [];

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end" onClick={onClose}>
      <div
        ref={ref}
        onClick={e => e.stopPropagation()}
        className="relative w-full bg-background border-t border-white/10 rounded-t-2xl pt-2 shadow-2xl animate-slide-up flex flex-col"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))", height: "50vh" }}
      >
        {/* Ручка */}
        <div className="flex justify-center pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Поиск + категории-эмодзи сверху (как в Telegram) */}
        {tab === "emoji" && (
          <div className="px-3 flex-shrink-0">
            <div className="flex items-center gap-2 bg-white/8 rounded-2xl px-3 py-2 mb-2">
              <Icon name="Search" size={16} className="text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск"
                className="flex-1 bg-transparent outline-none text-sm placeholder-muted-foreground"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                  <Icon name="X" size={14} />
                </button>
              )}
            </div>
            {!q && (
              <div className="flex gap-1 mb-1 overflow-x-auto no-scrollbar pb-1">
                {EMOJI_CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCat(c.id)}
                    className={`p-2 rounded-xl flex-shrink-0 transition ${cat === c.id ? "bg-violet-500/20 text-violet-400" : "text-muted-foreground hover:bg-white/8"}`}
                    title={c.label}
                  >
                    <Icon name={c.icon} size={18} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Контент */}
        <div className="flex-1 overflow-y-auto px-3">
          {tab === "emoji" ? (
            q ? (
              <div className="grid grid-cols-8 gap-0.5 py-1">
                {searchResults.map((e, i) => (
                  <button key={i} onClick={() => pick(e)} className="text-2xl p-1.5 rounded-lg hover:bg-white/10 transition">{e}</button>
                ))}
              </div>
            ) : (
              <>
                {recent.length > 0 && (
                  <>
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1 mt-1">Недавние</div>
                    <div className="grid grid-cols-8 gap-0.5 mb-2">
                      {recent.map((e, i) => (
                        <button key={i} onClick={() => pick(e)} className="text-2xl p-1.5 rounded-lg hover:bg-white/10">{e}</button>
                      ))}
                    </div>
                  </>
                )}
                <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">{selected.label}</div>
                <div className="grid grid-cols-8 gap-0.5 pb-1">
                  {selected.emojis.map((e, i) => (
                    <button key={i} onClick={() => pick(e)} className="text-2xl p-1.5 rounded-lg hover:bg-white/10 transition">{e}</button>
                  ))}
                </div>
              </>
            )
          ) : (
            <div className="space-y-3 py-1">
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

        {/* Нижние вкладки — как в Telegram */}
        <div className="flex items-center justify-center gap-1 px-3 pt-2 mt-1 border-t border-white/5 flex-shrink-0">
          <button
            onClick={() => setTab("stickers")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition ${tab === "stickers" ? "bg-white/12 text-white" : "text-muted-foreground hover:bg-white/8"}`}
          >
            <Icon name="Sticker" size={16} /> Стикеры
          </button>
          <button
            onClick={() => setTab("emoji")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition ${tab === "emoji" ? "bg-white/12 text-white" : "text-muted-foreground hover:bg-white/8"}`}
          >
            <Icon name="Smile" size={16} /> Эмодзи
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmojiStickerPicker;