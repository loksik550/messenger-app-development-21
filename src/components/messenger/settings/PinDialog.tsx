import Icon from "@/components/ui/icon";

export type PinFlow = { step: "set" | "confirm" | "verify"; first?: string; value: string; error?: string };

export function PinDialog({
  pinFlow,
  setPinFlow,
  submitPin,
}: {
  pinFlow: PinFlow;
  setPinFlow: (v: PinFlow | null) => void;
  submitPin: () => void;
}) {
  return (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setPinFlow(null)}>
          <div className="glass-strong rounded-2xl p-5 w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl grad-primary flex items-center justify-center">
                <Icon name="KeyRound" size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">
                  {pinFlow.step === "set" && "Придумайте PIN-код"}
                  {pinFlow.step === "confirm" && "Повторите PIN-код"}
                  {pinFlow.step === "verify" && "Введите PIN-код"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {pinFlow.step === "verify" ? "Чтобы отключить 2FA" : "От 4 до 6 цифр"}
                </div>
              </div>
            </div>
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pinFlow.value}
              onChange={(e) => setPinFlow({ ...pinFlow, value: e.target.value.replace(/\D/g, ""), error: undefined })}
              onKeyDown={(e) => { if (e.key === "Enter") submitPin(); }}
              className="w-full text-center text-2xl tracking-[0.5em] font-bold bg-white/5 rounded-xl py-3 outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="••••"
            />
            {pinFlow.error && <p className="text-red-400 text-xs mt-2 text-center">{pinFlow.error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setPinFlow(null)} className="flex-1 px-4 py-2.5 rounded-xl hover:bg-white/8 text-sm">Отмена</button>
              <button onClick={submitPin} className="flex-1 grad-primary text-white rounded-xl py-2.5 text-sm font-semibold">
                {pinFlow.step === "verify" ? "Отключить" : pinFlow.step === "set" ? "Далее" : "Готово"}
              </button>
            </div>
          </div>
        </div>
  );
}

export default PinDialog;
