import { useEffect } from "react";
import Icon from "@/components/ui/icon";

/**
 * Макет обложки для карточки приложения в магазине.
 * Два формата: широкая обложка 1024×500 и квадратная 512×512.
 * Открывается по адресу /banner — только для съёмки.
 */

export default function Banner() {
  useEffect(() => {
    document.title = "Nova — обложка";
  }, []);

  return (
    <div className="bg-[#07080f]">
      <Wide />
      <Square />
      <WideAlt />
    </div>
  );
}

/** Широкая обложка 1024×500 — шапка карточки в магазине */
function Wide() {
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: 1024, height: 500, fontFamily: '"Golos Text", sans-serif' }}
    >
      <Backdrop />

      <div className="relative h-full flex items-center px-16">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-[74px] h-[74px] rounded-[22px] bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-xl shadow-violet-900/50">
              <Icon name="Zap" size={38} className="text-white" />
            </div>
            <span className="text-white text-[52px] font-bold tracking-tight">Nova</span>
          </div>

          <h1 className="text-white text-[46px] font-bold leading-[1.15] mb-4">
            Мессенджер,<br />который бережёт<br />вашу переписку
          </h1>

          <p className="text-slate-400 text-[21px] leading-relaxed mb-7 max-w-[440px]">
            Сообщения, звонки и файлы под сквозным шифрованием.
            Без рекламы и слежки.
          </p>

          <div className="flex gap-3">
            {[
              { i: "Lock", t: "Шифрование" },
              { i: "Zap", t: "Быстро" },
              { i: "Wallet", t: "Кошелёк" },
            ].map((f) => (
              <div
                key={f.t}
                className="flex items-center gap-2 bg-white/[0.06] border border-white/12 rounded-2xl px-4 py-2.5"
              >
                <Icon name={f.i} size={19} className="text-violet-300" />
                <span className="text-slate-200 text-[18px]">{f.t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative shrink-0 w-[400px] h-full flex items-center justify-center">
          <Phone />
        </div>
      </div>
    </div>
  );
}

/** Второй вариант обложки — акцент на защите */
function WideAlt() {
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: 1024, height: 500, fontFamily: '"Golos Text", sans-serif' }}
    >
      <Backdrop />

      <div className="relative h-full flex flex-col items-center justify-center px-16 text-center">
        <div className="flex items-center gap-4 mb-7">
          <div className="w-[84px] h-[84px] rounded-[26px] bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-xl shadow-violet-900/50">
            <Icon name="Zap" size={44} className="text-white" />
          </div>
          <span className="text-white text-[62px] font-bold tracking-tight">Nova</span>
        </div>

        <h1 className="text-white text-[42px] font-bold mb-4">
          Переписка, которая остаётся вашей
        </h1>

        <p className="text-slate-400 text-[22px] max-w-[620px] leading-relaxed mb-8">
          Сквозное шифрование, звонки, группы и каналы.
          Российский мессенджер без рекламы.
        </p>

        <div className="flex gap-4">
          {[
            { i: "ShieldCheck", t: "Защита данных" },
            { i: "Users", t: "Группы и каналы" },
            { i: "Phone", t: "Звонки" },
            { i: "Bot", t: "Боты" },
          ].map((f) => (
            <div
              key={f.t}
              className="flex items-center gap-2.5 bg-white/[0.06] border border-white/12 rounded-2xl px-5 py-3"
            >
              <Icon name={f.i} size={21} className="text-violet-300" />
              <span className="text-slate-200 text-[19px]">{f.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Квадратная обложка 512×512 */
function Square() {
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: 512, height: 512, fontFamily: '"Golos Text", sans-serif' }}
    >
      <Backdrop />
      <div className="relative h-full flex flex-col items-center justify-center px-10 text-center">
        <div className="w-[132px] h-[132px] rounded-[38px] bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-2xl shadow-violet-900/60 mb-7">
          <Icon name="Zap" size={68} className="text-white" />
        </div>
        <div className="text-white text-[54px] font-bold tracking-tight mb-3">Nova</div>
        <div className="text-slate-400 text-[21px] leading-relaxed max-w-[340px]">
          Защищённый мессенджер
        </div>
        <div className="flex gap-2.5 mt-7">
          {["Lock", "Phone", "Users"].map((i) => (
            <div
              key={i}
              className="w-[52px] h-[52px] rounded-2xl bg-white/[0.07] border border-white/12 flex items-center justify-center"
            >
              <Icon name={i} size={24} className="text-violet-300" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Backdrop() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(760px 520px at 18% 0%, rgba(124,58,237,0.34), transparent 62%)," +
            "radial-gradient(620px 480px at 96% 100%, rgba(37,99,235,0.26), transparent 60%)," +
            "linear-gradient(135deg, #12132a 0%, #0c0d1d 50%, #080910 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
    </>
  );
}

/** Телефон с экраном чатов — показывает настоящий интерфейс */
function Phone() {
  const rows = [
    { n: "Команда Nova", m: "Обновление готово", t: "14:32", u: 3, c: "from-violet-500 to-purple-700", g: true },
    { n: "Алексей", m: "Отправил файл", t: "13:20", c: "from-sky-500 to-blue-700" },
    { n: "Мария", m: "Спасибо, всё получила", t: "10:47", c: "from-pink-500 to-rose-700" },
    { n: "Дизайн-студия", m: "Макеты на согласовании", t: "09:15", u: 1, c: "from-emerald-500 to-teal-700", g: true },
  ];

  return (
    <div
      className="w-[236px] rounded-[34px] border-[8px] border-[#1b1c2e] bg-[#0a0b14] overflow-hidden shadow-2xl"
      style={{ height: 430, transform: "rotate(-5deg)" }}
    >
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <Icon name="Zap" size={16} className="text-white" />
            </div>
            <span className="text-white text-[19px] font-bold">Nova</span>
          </div>
          <Icon name="Search" size={17} className="text-slate-500" />
        </div>

        <div className="flex gap-1.5 mb-3.5">
          {["Все", "Личные", "Группы"].map((t, i) => (
            <div
              key={t}
              className={`px-2.5 py-1 rounded-lg text-[11px] ${
                i === 0
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                  : "bg-white/[0.06] text-slate-500"
              }`}
            >
              {t}
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          {rows.slice(0, 4).map((r, i) => (
            <div
              key={r.n}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-2xl border ${
                i === 0
                  ? "bg-violet-600/[0.12] border-violet-500/25"
                  : "bg-white/[0.035] border-white/8"
              }`}
            >
              <div className={`w-[38px] h-[38px] rounded-full bg-gradient-to-br ${r.c} flex items-center justify-center text-white text-[15px] font-bold shrink-0`}>
                {r.g ? <Icon name="Users" size={17} /> : r.n.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-white text-[13px] font-medium truncate">{r.n}</div>
                <div className="text-slate-500 text-[11px] truncate">{r.m}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-slate-600 text-[10px]">{r.t}</span>
                {r.u && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {r.u}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto mb-3 flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/25 rounded-full px-3 py-2 justify-center">
          <Icon name="Lock" size={13} className="text-violet-300" />
          <span className="text-violet-300 text-[11px]">Сквозное шифрование</span>
        </div>
      </div>
    </div>
  );
}
