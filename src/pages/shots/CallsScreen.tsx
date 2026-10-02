import Icon from "@/components/ui/icon";
import { Bubble, Chip, TabBar } from "@/pages/shots/ShotsAtoms";

/* ───────────────────── Экран 4: звонки и переписка ───────────────────── */

export function CallsScreen() {
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
