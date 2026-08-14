import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const LABELS: Record<string, string> = {
  delete_user: "Удаление пользователя",
  delete_chat: "Удаление переписки",
  bulk_action: "Действие сразу для нескольких",
  team_update: "Изменение прав сотрудника",
  team_remove: "Удаление сотрудника",
  wallet_set: "Изменение кошелька",
  payment_refund: "Возврат денег",
  settings_save: "Изменение настроек",
  broadcast_send: "Рассылка пользователям",
  channel_delete: "Удаление канала",
  create_invite: "Создание кода доступа",
};

/** Окно подтверждения паролем перед важным действием */
export default function DevConfirm({
  action, onSubmit, onCancel,
}: {
  action: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);

  const submit = () => {
    if (pwd.trim()) onSubmit(pwd);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12131f] border border-white/12 rounded-2xl p-5 w-full max-w-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Icon name="ShieldAlert" size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold leading-tight">Подтвердите паролем</h3>
            <p className="text-xs text-slate-500 mt-1">
              {LABELS[action] || "Важное действие"} — введите свой пароль от панели
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 mb-3 focus-within:border-violet-500/50 transition">
          <Icon name="Lock" size={15} className="text-slate-500 shrink-0" />
          <input
            ref={ref}
            type={show ? "text" : "password"}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Ваш пароль"
            className="flex-1 bg-transparent outline-none text-sm placeholder-slate-600"
          />
          <button
            onClick={() => setShow(!show)}
            className="text-slate-500 hover:text-slate-300 shrink-0"
            title={show ? "Скрыть" : "Показать"}
          >
            <Icon name={show ? "EyeOff" : "Eye"} size={15} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm"
          >
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={!pwd.trim()}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold disabled:opacity-40 transition"
          >
            Подтвердить
          </button>
        </div>

        <p className="text-[11px] text-slate-600 mt-3 text-center">
          Так мы защищаем данные, если панель осталась открытой
        </p>
      </div>
    </div>
  );
}

/** Всплывающее приветствие после входа — видно, откуда и когда зашли */
export function DevLoginToast({
  notice, onClose,
}: {
  notice: { name: string; role: string; device: string; ip: string; when: string };
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 9000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-16 right-4 z-[150] w-[290px] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-[#12131f]/95 backdrop-blur-md border border-emerald-500/25 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <Icon name="ShieldCheck" size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Вы вошли в панель</div>
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              {notice.name} · {notice.role}
            </div>
            <div className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
              {notice.device} · IP {notice.ip}
              <br />
              {notice.when}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-400 shrink-0">
            <Icon name="X" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
