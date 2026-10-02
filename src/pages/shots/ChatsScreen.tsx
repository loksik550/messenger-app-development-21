import Icon from "@/components/ui/icon";
import { Chip, TabBar } from "@/pages/shots/ShotsAtoms";

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

export function ChatsScreen() {
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
