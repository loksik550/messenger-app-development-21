import Icon from "@/components/ui/icon";

export const AVATAR = "https://cdn.poehali.dev/projects/6364bfec-87ef-4e7b-8203-730d57164065/files/618891ed-5042-41ea-b070-6badef29080a.jpg";

export const W = 1080;
export const H = 1920;

/** Рамка ровно 1080×1920 — вертикальный формат для магазина */
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden shrink-0"
      style={{ width: W, height: H, background: "#0a0b14" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1000px 700px at 50% -8%, rgba(124,58,237,0.28), transparent 62%)," +
            "radial-gradient(760px 620px at 100% 100%, rgba(37,99,235,0.20), transparent 60%)," +
            "linear-gradient(180deg, #0d0e1c 0%, #0a0b14 55%, #07080f 100%)",
        }}
      />
      <div className="relative h-full flex flex-col" style={{ fontFamily: '"Golos Text", sans-serif' }}>
        <StatusBar />
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}

export function StatusBar() {
  return (
    <div className="flex items-center justify-between px-11 pt-8 pb-3 shrink-0">
      <span className="text-white text-[30px] font-semibold tracking-tight">9:41</span>
      <div className="flex items-center gap-3 text-white">
        <Icon name="Signal" size={27} />
        <Icon name="Wifi" size={27} />
        <Icon name="BatteryFull" size={31} />
      </div>
    </div>
  );
}

/* ───────────────────────────── общие части ───────────────────────────── */

export function Bubble({
  mine, text, time, read,
}: {
  mine: boolean;
  text: string;
  time: string;
  read?: boolean;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`px-7 py-5 max-w-[76%] ${
          mine
            ? "bg-gradient-to-br from-violet-600 to-purple-700 rounded-[28px] rounded-br-lg"
            : "bg-white/[0.07] border border-white/10 rounded-[28px] rounded-bl-lg"
        }`}
      >
        <div className="text-white text-[28px] leading-relaxed">{text}</div>
        <div className={`flex items-center gap-2 mt-2 ${mine ? "justify-end" : ""}`}>
          <span className={`text-[22px] ${mine ? "text-white/70" : "text-slate-500"}`}>{time}</span>
          {read && <Icon name="CheckCheck" size={23} className="text-white/80" />}
        </div>
      </div>
    </div>
  );
}

export function Chip({ icon }: { icon: string }) {
  return (
    <div className="w-[68px] h-[68px] rounded-[22px] bg-white/[0.06] border border-white/10 flex items-center justify-center">
      <Icon name={icon} size={32} className="text-slate-300" />
    </div>
  );
}

export function TabBar({ active }: { active: string }) {
  const tabs = [
    { k: "chats", i: "MessageCircle", l: "Чаты" },
    { k: "contacts", i: "Users", l: "Контакты" },
    { k: "search", i: "Search", l: "Поиск" },
    { k: "profile", i: "User", l: "Профиль" },
    { k: "security", i: "Shield", l: "Защита" },
  ];
  return (
    <div className="flex items-center justify-around border-t border-white/8 pt-5 pb-8">
      {tabs.map((t) => (
        <div key={t.k} className="flex flex-col items-center gap-2">
          <Icon
            name={t.i}
            size={34}
            className={active === t.k ? "text-violet-400" : "text-slate-600"}
          />
          <span
            className={`text-[22px] ${
              active === t.k ? "text-violet-400 font-medium" : "text-slate-600"
            }`}
          >
            {t.l}
          </span>
        </div>
      ))}
    </div>
  );
}
