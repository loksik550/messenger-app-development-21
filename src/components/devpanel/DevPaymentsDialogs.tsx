import { useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";
import { Field, Inp } from "./DevPlans";

export interface Payment {
  id: number;
  order_number: string;
  email: string;
  amount: number;
  status: string;
  payment_id: string;
  created_at: string | null;
  paid_at: string | null;
  user_id: number | null;
  user_name: string;
  purpose: string;
  method: string;
  refunded: number;
  refunded_at: string | null;
  refund_reason: string;
  cancel_reason: string;
}

interface ExportRow {
  created: string;
  paid: string;
  order: string;
  amount: number;
  status: string;
  method: string;
  purpose: string;
  email: string;
  name: string;
  phone: string;
  user_id: number | null;
  refunded: number;
  payment_id: string;
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [from, setFrom] = useState(iso(monthAgo));
  const [to, setTo] = useState(iso(today));
  const [onlyPaid, setOnlyPaid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  const download = async () => {
    setBusy(true);
    setErr("");
    setDone("");
    try {
      const r = await devApi<{ rows: ExportRow[]; total: number; total_refunded: number; count: number }>(
        "payments_export", { from, to, only_paid: onlyPaid },
      );
      if (r.count === 0) {
        setErr("За выбранный период платежей нет");
        return;
      }

      const headers = [
        "Дата создания", "Дата оплаты", "Номер заказа", "Сумма, руб",
        "Статус", "Способ оплаты", "Назначение", "Возврат, руб",
        "Имя", "Телефон", "Email", "ID пользователя", "ID платежа",
      ];
      const esc = (v: string | number | null) => {
        const t = String(v ?? "");
        return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
      };
      const lines = [headers.join(";")];
      for (const row of r.rows) {
        lines.push([
          row.created, row.paid, row.order,
          String(row.amount).replace(".", ","),
          row.status, row.method, row.purpose,
          String(row.refunded).replace(".", ","),
          row.name, row.phone, row.email,
          row.user_id ?? "", row.payment_id,
        ].map(esc).join(";"));
      }
      lines.push("");
      lines.push(`Итого получено;${String(r.total).replace(".", ",")}`);
      lines.push(`Итого возвращено;${String(r.total_refunded).replace(".", ",")}`);
      lines.push(`Всего строк;${r.count}`);

      // BOM нужен, чтобы Excel правильно показал русские буквы
      const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
        type: "text/csv;charset=utf-8",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `nova-payments-${from}_${to}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      setDone(`Готово: ${r.count} строк, ${formatNum(r.total)} ₽`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось выгрузить");
    } finally {
      setBusy(false);
    }
  };

  const quick = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    setFrom(iso(start));
    setTo(iso(end));
  };

  const thisMonth = () => {
    const now = new Date();
    setFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
    setTo(iso(now));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#12131f] border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold">Выгрузка платежей</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <Icon name="X" size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Файл откроется в Excel или Google Таблицах</p>

        <div className="flex gap-1.5 mb-3">
          <button onClick={thisMonth} className="flex-1 py-2 rounded-xl bg-white/[0.03] border border-white/8 text-xs text-slate-400 hover:bg-white/[0.06] transition">
            Этот месяц
          </button>
          <button onClick={() => quick(30)} className="flex-1 py-2 rounded-xl bg-white/[0.03] border border-white/8 text-xs text-slate-400 hover:bg-white/[0.06] transition">
            30 дней
          </button>
          <button onClick={() => quick(365)} className="flex-1 py-2 rounded-xl bg-white/[0.03] border border-white/8 text-xs text-slate-400 hover:bg-white/[0.06] transition">
            Год
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="С даты">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
          </Field>
          <Field label="По дату">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
          </Field>
        </div>

        <button onClick={() => setOnlyPaid(!onlyPaid)} className="flex items-center gap-2 text-xs mb-4">
          <span className={`w-9 h-5 rounded-full transition relative ${onlyPaid ? "bg-violet-500" : "bg-white/10"}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${onlyPaid ? "translate-x-4" : "translate-x-0.5"}`} />
          </span>
          <span className="text-slate-400">Только успешные платежи</span>
        </button>

        {err && (
          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 mb-3">
            <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}
        {done && (
          <div className="flex items-start gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5 mb-3">
            <Icon name="CircleCheck" size={16} className="mt-0.5 shrink-0" />
            <span>{done}</span>
          </div>
        )}

        <button
          onClick={download}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-bold disabled:opacity-50"
        >
          {busy ? "Собираем данные..." : "Скачать таблицу"}
        </button>
      </div>
    </div>
  );
}

export function RefundDialog({
  payment, onClose, onDone,
}: {
  payment: Payment;
  onClose: () => void;
  onDone: () => void;
}) {
  const max = payment.amount - payment.refunded;
  const [amount, setAmount] = useState(String(max));
  const [reason, setReason] = useState("Возврат по обращению пользователя");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doRefund = async () => {
    setBusy(true);
    setErr("");
    try {
      await devApi("payment_refund", {
        order_id: payment.id,
        amount: Number(amount) || max,
        reason,
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось оформить возврат");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#12131f] border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-1">Возврат платежа</h3>
        <p className="text-xs text-slate-500 mb-4">
          {payment.user_name} · {formatNum(payment.amount)} ₽ · {payment.order_number}
        </p>

        <div className="space-y-3">
          <Field label={`Сумма возврата (не больше ${formatNum(max)} ₽)`}>
            <Inp value={amount} onChange={(v) => setAmount(v.replace(/[^\d.]/g, ""))} />
          </Field>
          <Field label="Причина — увидит пользователь">
            <Inp value={reason} onChange={setReason} />
          </Field>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mt-3">
          <Icon name="TriangleAlert" size={14} className="mt-0.5 shrink-0" />
          <span>Деньги вернутся на карту покупателя за 3–5 рабочих дней. Отменить возврат нельзя.</span>
        </div>

        {err && (
          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 mt-3">
            <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">
            Отмена
          </button>
          <button
            onClick={doRefund}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-300 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Оформляем..." : "Вернуть деньги"}
          </button>
        </div>
      </div>
    </div>
  );
}
