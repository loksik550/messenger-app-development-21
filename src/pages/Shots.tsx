import { useEffect } from "react";
import Icon from "@/components/ui/icon";

/**
 * Страница-макет для скриншотов в магазин приложений.
 * Показывает настоящие экраны Nova с нейтральными демо-данными:
 * без личных телефонов, без чужих фото и без посторонних элементов.
 * Открывается по адресу /shots — только для съёмки, в меню её нет.
 */

const AVATAR = "https://cdn.poehali.dev/projects/6364bfec-87ef-4e7b-8203-730d57164065/files/618891ed-5042-41ea-b070-6badef29080a.jpg";

const W = 1080;
const H = 1920;

export default function Shots() {
  useEffect(() => {
    document.title = "Nova — экраны";
  }, []);

  return (
    <div className="bg-[#07080f] min-h-screen">
      <Screen><ChatsScreen /></Screen>
      <Screen><ProfileScreen /></Screen>
      <Screen><SecurityScreen /></Screen>
      <Screen><CallsScreen /></Screen>
    </div>
  );
}

/** Рамка ровно 1080×1920 — вертикальный формат для магазина */
function Screen({ children }: { children: React.ReactNode }) {
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

function StatusBar() {
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

/* ─────────────────────────── Экран 1: чаты ─────────────────────────── */

const CHATS = [
  { n: "Команда Nova", m: "Обновление готово — выкатываем", t: "14:32", u: 3, g: true, c: "from-violet-500 to-purple-700", on: true },
  { n: "Алексей", m: "Отправил файл: отчёт.pdf", t: "13:20", g: false, c: "from-sky-500 to-blue-700", on: true },
  { n: "Дизайн-студия", m: "Макеты на согласовании", t: "11:05", u: 1, g: true, c: "from-emerald-500 to-teal-700" },
  { n: "Мария", m: "Спасибо, всё получила", t: "10:47", g: false, c: "from-pink-500 to-rose-700" },
  { n: "Служба поддержки", m: "Ваш вопрос решён", t: "Вчера", g: false, c: "from-amber-500 to-orange-700", v: true },
  { n: "Заметки", m: "Ссылка на встречу", t: "Вчера", g: false, c: "from-indigo-500 to-violet-700" },
  { n: "Проект «Весна»", m: "Голосование: выбираем логотип", t: "Вчера", u: 7, g: true, c: "from-cyan-500 to-sky-700" },
  { n: "Ольга", m: "Голосовое сообщение · 0:14", t: "Пн", g: false, c: "from-fuchsia-500 to-purple-700" },
  { n: "Новости Nova", m: "Что нового в этой версии", t: "Пн", g: true, c: "from-slate-500 to-slate-700", v: true },
  { n: "Дмитрий", m: "Фотография", t: "Вс", g: false, c: "from-lime-500 to-green-700" },
];

function ChatsScreen() {
  return (
    <div className="h-full flex flex-col px-8">
      <div className="flex items-center justify-between py-5">
        <div className="flex items-center gap-4">
          <div className="w-[68px] h-[68px] rounded-[22px] bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <Icon name="Zap" size={36} className="text-white" />
          </div>
          <span className="text-white text-[42px] font-bold tracking-tight">Nova</span>
        </div>
        <div className="flex items-center gap-3">
          <Chip icon="Search" />
          <Chip icon="Bell" />
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        {["Все", "Непрочитанные", "Избранное", "Личные", "Группы"].map((t, i) => (
          <div
            key={t}
            className={`px-6 py-3 rounded-2xl text-[26px] ${
              i === 0
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold"
                : "bg-white/[0.06] text-slate-400 border border-white/8"
            }`}
          >
            {t}
          </div>
        ))}
      </div>

      <div className="flex gap-5 mb-6 px-1">
        {[
          { n: "Моя", add: true, c: "from-slate-600 to-slate-800" },
          { n: "Анна", c: "from-violet-500 to-purple-700" },
          { n: "Игорь", c: "from-sky-500 to-blue-700" },
          { n: "Катя", c: "from-pink-500 to-rose-700" },
          { n: "Пётр", c: "from-emerald-500 to-teal-700" },
        ].map((st) => (
          <div key={st.n} className="flex flex-col items-center gap-2.5">
            <div
              className={`w-[104px] h-[104px] rounded-full p-[4px] ${
                st.add ? "bg-white/10" : "bg-gradient-to-tr from-violet-500 to-pink-500"
              }`}
            >
              <div className={`w-full h-full rounded-full bg-gradient-to-br ${st.c} flex items-center justify-center border-[4px] border-[#0a0b14]`}>
                {st.add ? (
                  <Icon name="Plus" size={36} className="text-white" />
                ) : (
                  <span className="text-white text-[34px] font-bold">{st.n.slice(0, 1)}</span>
                )}
              </div>
            </div>
            <span className="text-slate-400 text-[22px]">{st.n}</span>
          </div>
        ))}
      </div>

      <div className="text-slate-500 text-[24px] tracking-wide mb-3 px-1">Закреплённые</div>

      <div className="space-y-2.5">
        {CHATS.map((c, i) => (
          <div
            key={c.n}
            className={`flex items-center gap-5 px-6 py-4 rounded-[24px] border ${
              i === 0
                ? "bg-violet-600/[0.10] border-violet-500/25"
                : "bg-white/[0.035] border-white/8"
            }`}
          >
            <div className="relative shrink-0">
              <div className={`w-[86px] h-[86px] rounded-full bg-gradient-to-br ${c.c} flex items-center justify-center text-white text-[38px] font-bold`}>
                {c.g ? <Icon name="Users" size={40} /> : c.n.slice(0, 1)}
              </div>
              {c.on && (
                <span className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-400 border-[5px] border-[#0a0b14]" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="text-white text-[31px] font-semibold truncate">{c.n}</span>
                {c.v && <Icon name="BadgeCheck" size={28} className="text-sky-400 shrink-0" />}
                {i === 0 && <Icon name="Pin" size={24} className="text-slate-500 shrink-0" />}
              </div>
              <div className="text-slate-400 text-[26px] truncate mt-1.5">{c.m}</div>
            </div>

            <div className="flex flex-col items-end gap-2.5 shrink-0">
              <span className="text-slate-500 text-[24px]">{c.t}</span>
              {c.u ? (
                <span className="min-w-[42px] h-[42px] px-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[24px] font-bold flex items-center justify-center">
                  {c.u}
                </span>
              ) : (
                <Icon name="CheckCheck" size={27} className="text-violet-400" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <TabBar active="chats" />
      </div>
    </div>
  );
}

/* ────────────────────────── Экран 2: профиль ────────────────────────── */

function ProfileScreen() {
  return (
    <div className="h-full flex flex-col px-8">
      <div className="flex items-center gap-4 py-5">
        <Icon name="ChevronLeft" size={40} className="text-white" />
        <span className="text-white text-[34px] font-semibold">Профиль</span>
      </div>

      <div className="flex flex-col items-center pt-6 pb-8">
        <div className="relative">
          <img
            src={AVATAR}
            alt=""
            className="w-[220px] h-[220px] rounded-full object-cover border-4 border-violet-500/30"
          />
          <div className="absolute bottom-2 right-2 w-[62px] h-[62px] rounded-full bg-gradient-to-br from-violet-600 to-purple-700 border-4 border-[#0a0b14] flex items-center justify-center">
            <Icon name="Camera" size={28} className="text-white" />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <span className="text-white text-[46px] font-bold">Алексей</span>
          <Icon name="BadgeCheck" size={36} className="text-sky-400" />
        </div>
        <div className="flex items-center gap-2.5 mt-3">
          <span className="w-4 h-4 rounded-full bg-emerald-400" />
          <span className="text-emerald-400 text-[27px]">В сети</span>
        </div>
      </div>

      <div className="bg-white/[0.04] border border-white/8 rounded-[26px] px-7 py-6 mb-5">
        <div className="text-slate-500 text-[23px] mb-2">О себе</div>
        <div className="text-white text-[28px] leading-relaxed">
          Дизайнер интерфейсов. Люблю простые решения.
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { i: "Users", v: "128", l: "Контакты" },
          { i: "MessageSquare", v: "46", l: "Чаты" },
          { i: "Trophy", v: "12", l: "Уровень" },
        ].map((s) => (
          <div key={s.l} className="bg-white/[0.04] border border-white/8 rounded-[26px] py-7 text-center">
            <Icon name={s.i} size={34} className="text-violet-400 mx-auto mb-3" />
            <div className="text-white text-[40px] font-bold">{s.v}</div>
            <div className="text-slate-500 text-[23px] mt-1">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="rounded-[28px] p-7 mb-5 bg-gradient-to-r from-violet-600 to-purple-600 flex items-center gap-5">
        <div className="w-[76px] h-[76px] rounded-[22px] bg-white/20 flex items-center justify-center shrink-0">
          <Icon name="Wallet" size={36} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="text-white/80 text-[25px]">Nova Кошелёк</div>
          <div className="text-white text-[42px] font-bold mt-1">1 250 ₽</div>
        </div>
        <Icon name="ChevronRight" size={36} className="text-white/70" />
      </div>

      <div className="space-y-4">
        {[
          { i: "Crown", t: "Оформить Nova Pro", s: "Больше возможностей", c: "from-amber-500 to-orange-600" },
          { i: "Bot", t: "Мои боты", s: "Создавай ботов для автоматизации", c: "from-sky-500 to-blue-600" },
          { i: "LifeBuoy", t: "Поддержка Nova", s: "Помощь, баги, идеи", c: "from-pink-500 to-rose-600" },
          { i: "ShieldCheck", t: "Безопасность и приватность", s: "PIN, кто видит, сессии", c: "from-emerald-500 to-teal-600" },
        ].map((r) => (
          <div key={r.t} className="flex items-center gap-5 bg-white/[0.04] border border-white/8 rounded-[26px] px-7 py-6">
            <div className={`w-[72px] h-[72px] rounded-[22px] bg-gradient-to-br ${r.c} flex items-center justify-center shrink-0`}>
              <Icon name={r.i} size={34} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-[31px] font-semibold">{r.t}</div>
              <div className="text-slate-500 text-[24px] mt-1">{r.s}</div>
            </div>
            <Icon name="ChevronRight" size={32} className="text-slate-600" />
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <TabBar active="profile" />
      </div>
    </div>
  );
}

/* ──────────────────────── Экран 3: безопасность ──────────────────────── */

function SecurityScreen() {
  const rows = [
    { i: "Lock", t: "Сквозное шифрование", s: "E2E для всех чатов", on: true },
    { i: "KeyRound", t: "Двухфакторная защита", s: "PIN установлен", on: true },
    { i: "Fingerprint", t: "Биометрия", s: "Вход по Face ID / Touch ID", on: true },
    { i: "Bell", t: "Уведомления", s: "Показывать оповещения", on: true },
    { i: "Eye", t: "Предпросмотр сообщений", s: "Текст в уведомлениях", on: true },
    { i: "ShieldAlert", t: "Оповещать о входах", s: "Новое устройство в аккаунте", on: true },
  ];

  return (
    <div className="h-full flex flex-col px-8">
      <div className="flex items-center gap-4 py-5">
        <Icon name="ChevronLeft" size={40} className="text-white" />
        <div>
          <div className="text-white text-[38px] font-bold">Безопасность</div>
          <div className="text-slate-500 text-[25px] mt-0.5">Управление защитой аккаунта</div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-violet-600/20 to-purple-700/10 border border-violet-500/30 rounded-[30px] p-8 mb-7 mt-3">
        <div className="flex items-center gap-5">
          <div className="w-[92px] h-[92px] rounded-[26px] bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0">
            <Icon name="ShieldCheck" size={46} className="text-white" />
          </div>
          <div>
            <div className="text-white text-[36px] font-bold">Защита активна</div>
            <div className="text-violet-300 text-[27px] mt-1">Все данные зашифрованы</div>
          </div>
        </div>
        <div className="text-slate-400 text-[26px] leading-relaxed mt-6">
          Nova использует сквозное шифрование (E2E). Ваши сообщения не могут
          быть прочитаны третьими лицами.
        </div>
      </div>

      <div className="space-y-4">
        {rows.map((r) => (
          <div
            key={r.t}
            className="flex items-center gap-5 bg-white/[0.04] border border-white/8 rounded-[26px] px-7 py-6"
          >
            <div className="w-[74px] h-[74px] rounded-[22px] bg-violet-500/15 flex items-center justify-center shrink-0">
              <Icon name={r.i} size={34} className="text-violet-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-[30px] font-semibold">{r.t}</div>
              <div className="text-slate-500 text-[24px] mt-1">{r.s}</div>
            </div>
            <div
              className={`w-[96px] h-[54px] rounded-full relative shrink-0 ${
                r.on ? "bg-gradient-to-r from-violet-500 to-purple-600" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-[5px] w-[44px] h-[44px] rounded-full bg-white ${
                  r.on ? "left-[47px]" : "left-[5px]"
                }`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <TabBar active="security" />
      </div>
    </div>
  );
}

/* ───────────────────── Экран 4: звонки и переписка ───────────────────── */

function CallsScreen() {
  return (
    <div className="h-full flex flex-col px-8">
      <div className="flex items-center gap-5 py-5">
        <Icon name="ChevronLeft" size={40} className="text-white" />
        <div className="w-[78px] h-[78px] rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-[34px] font-bold">
          М
        </div>
        <div className="flex-1">
          <div className="text-white text-[34px] font-semibold">Мария</div>
          <div className="text-emerald-400 text-[25px] mt-0.5">в сети</div>
        </div>
        <Chip icon="Phone" />
        <Chip icon="Video" />
      </div>

      <div className="bg-violet-500/10 border border-violet-500/25 rounded-full px-6 py-3 self-center mt-4 mb-8 flex items-center gap-2.5">
        <Icon name="Lock" size={24} className="text-violet-300" />
        <span className="text-violet-300 text-[24px]">Сквозное шифрование</span>
      </div>

      <div className="space-y-4 flex-1">
        <Bubble mine={false} text="Привет! Посмотрела макеты — выглядит отлично" time="14:20" />
        <Bubble mine text="Спасибо! Внёс правки по цветам" time="14:22" read />
        <Bubble mine={false} text="Когда сможем созвониться?" time="14:24" />
        <Bubble mine text="Давай через полчаса, наберу" time="14:25" read />
        <Bubble mine={false} text="Договорились. Скинь потом презентацию" time="14:26" />

        <div className="flex justify-end">
          <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-[28px] rounded-br-lg px-6 py-5 max-w-[70%]">
            <div className="flex items-center gap-4">
              <div className="w-[62px] h-[62px] rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Icon name="Play" size={26} className="text-white" />
              </div>
              <div className="flex items-end gap-[5px] h-[44px]">
                {[14, 26, 38, 30, 42, 22, 34, 18, 40, 28, 16, 36, 24, 32, 20].map((h, i) => (
                  <span key={i} className="w-[6px] rounded-full bg-white/70" style={{ height: h }} />
                ))}
              </div>
              <span className="text-white/80 text-[24px] shrink-0">0:21</span>
            </div>
            <div className="flex items-center justify-end gap-2 mt-2.5">
              <span className="text-white/70 text-[22px]">14:28</span>
              <Icon name="CheckCheck" size={24} className="text-white/80" />
            </div>
          </div>
        </div>

        <div className="flex justify-start">
          <div className="bg-white/[0.06] border border-white/10 rounded-[28px] rounded-bl-lg px-7 py-6 max-w-[74%]">
            <div className="flex items-center gap-4">
              <div className="w-[68px] h-[68px] rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Icon name="PhoneIncoming" size={32} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-white text-[28px] font-medium">Входящий звонок</div>
                <div className="text-slate-500 text-[24px] mt-1">Длился 12 минут</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-[28px] rounded-br-lg px-7 py-6 max-w-[74%]">
            <div className="flex items-center gap-4">
              <div className="w-[64px] h-[64px] rounded-[18px] bg-white/20 flex items-center justify-center shrink-0">
                <Icon name="FileText" size={30} className="text-white" />
              </div>
              <div>
                <div className="text-white text-[27px] font-medium">Презентация.pdf</div>
                <div className="text-white/70 text-[23px] mt-1">2,4 МБ</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <span className="text-white/70 text-[22px]">14:31</span>
              <Icon name="CheckCheck" size={24} className="text-white/80" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white/[0.05] border border-white/10 rounded-[30px] px-7 py-5 mb-4">
        <Icon name="Paperclip" size={34} className="text-slate-500 shrink-0" />
        <span className="text-slate-500 text-[28px] flex-1">Сообщение...</span>
        <Icon name="Smile" size={34} className="text-slate-500 shrink-0" />
        <div className="w-[68px] h-[68px] rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shrink-0">
          <Icon name="Send" size={30} className="text-white" />
        </div>
      </div>

      <TabBar active="chats" />
    </div>
  );
}

/* ───────────────────────────── общие части ───────────────────────────── */

function Bubble({
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

function Chip({ icon }: { icon: string }) {
  return (
    <div className="w-[68px] h-[68px] rounded-[22px] bg-white/[0.06] border border-white/10 flex items-center justify-center">
      <Icon name={icon} size={32} className="text-slate-300" />
    </div>
  );
}

function TabBar({ active }: { active: string }) {
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