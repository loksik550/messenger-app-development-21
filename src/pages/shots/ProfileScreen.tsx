import Icon from "@/components/ui/icon";
import { AVATAR, TabBar } from "@/pages/shots/ShotsAtoms";

/* ────────────────────────── Экран 2: профиль ────────────────────────── */

export function ProfileScreen() {
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
