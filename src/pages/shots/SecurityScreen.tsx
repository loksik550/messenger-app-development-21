import Icon from "@/components/ui/icon";
import { TabBar } from "@/pages/shots/ShotsAtoms";

/* ──────────────────────── Экран 3: безопасность ──────────────────────── */

export function SecurityScreen() {
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
