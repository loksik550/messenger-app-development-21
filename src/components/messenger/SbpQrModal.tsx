import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { YOOKASSA_PAY_API } from "@/lib/api";

/**
 * Оплата по QR-коду СБП. Пользователь сканирует код банковским приложением,
 * а мы раз в 3 секунды спрашиваем у платёжной системы, прошёл ли платёж.
 */
export default function SbpQrModal({
  qrData, paymentId, amount, userId, onPaid, onClose,
}: {
  qrData: string;
  paymentId: string;
  amount: number;
  userId: number;
  onPaid: () => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"waiting" | "paid" | "failed">("waiting");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (status !== "waiting") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== "waiting") return;
    let alive = true;

    const check = async () => {
      try {
        const res = await fetch(YOOKASSA_PAY_API, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Id": String(userId) },
          body: JSON.stringify({ action: "check_status", payment_id: paymentId }),
        });
        const d = await res.json();
        if (!alive) return;
        if (d.status === "succeeded" || d.paid) {
          setStatus("paid");
          setTimeout(onPaid, 1800);
        } else if (d.status === "canceled") {
          setStatus("failed");
        }
      } catch {
        /* сеть моргнула — попробуем на следующем круге */
      }
    };

    const t = setInterval(check, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [status, paymentId, userId, onPaid]);

  // Бесплатный генератор картинки QR — данные строки уходят как параметр ссылки
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(qrData)}`;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[#12131f] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5 sm:hidden" />

        {status === "paid" ? (
          <div className="text-center py-6">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
              <Icon name="CircleCheck" size={40} className="text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold mb-1">Оплата прошла</h3>
            <p className="text-sm text-muted-foreground">Premium уже активен</p>
          </div>
        ) : status === "failed" ? (
          <div className="text-center py-6">
            <div className="w-20 h-20 rounded-3xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Icon name="CircleX" size={40} className="text-red-400" />
            </div>
            <h3 className="text-xl font-bold mb-1">Платёж отменён</h3>
            <p className="text-sm text-muted-foreground mb-5">Попробуйте ещё раз</p>
            <button onClick={onClose} className="w-full py-3 glass rounded-2xl font-semibold">
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg">Оплата через СБП</h3>
                <p className="text-xs text-muted-foreground">Отсканируйте код в банке</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8 transition text-muted-foreground">
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="bg-white rounded-2xl p-4 mb-4 flex items-center justify-center">
              <img src={qrImg} alt="QR-код для оплаты" className="w-full max-w-[240px]" />
            </div>

            <div className="text-center mb-4">
              <div className="text-2xl font-black">{amount} ₽</div>
              <div className="text-xs text-muted-foreground mt-0.5">Nova Premium</div>
            </div>

            <a
              href={qrData}
              className="block w-full py-3.5 grad-primary rounded-2xl text-white font-bold text-center mb-3 sm:hidden"
            >
              Открыть банк на телефоне
            </a>

            <div className="glass rounded-2xl p-3.5 flex items-start gap-2.5">
              <Icon name="Loader2" size={15} className="text-violet-400 mt-0.5 shrink-0 animate-spin" />
              <div className="flex-1">
                <div className="text-xs font-medium">Ждём подтверждение банка</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Обычно занимает несколько секунд · {seconds} с
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center mt-4 leading-relaxed">
              Откройте приложение банка, выберите «Оплата по QR»
              и наведите камеру на код
            </p>
          </>
        )}
      </div>
    </div>
  );
}
