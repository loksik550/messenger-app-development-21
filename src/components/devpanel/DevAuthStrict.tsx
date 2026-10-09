import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi } from "@/lib/devApi";
import { Note } from "./DevSettingsSections";

interface StrictInfo { enabled: boolean; with_key: number; without_key: number }

export default function DevAuthStrict({ editable }: { editable: boolean }) {
  const [info, setInfo] = useState<StrictInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => devApi<StrictInfo>("auth_strict_get").then(setInfo).catch(() => {});
  useEffect(() => { load(); }, []);

  const apply = async (enabled: boolean) => {
    if (enabled && info && info.without_key > 0 &&
      !confirm(`${info.without_key} чел. ещё на старой версии. После включения им нужно будет войти заново. Включить?`)) return;
    setBusy(true);
    setMsg("");
    try {
      await devApi("auth_strict_save", { enabled });
      setMsg(enabled ? "Строгая проверка включена" : "Строгая проверка выключена");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const on = !!info?.enabled;

  return (
    <div className={`border rounded-2xl p-5 ${on ? "bg-emerald-500/[0.06] border-emerald-500/25" : "bg-white/[0.03] border-white/10"}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${on ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
          <Icon name={on ? "ShieldCheck" : "ShieldAlert"} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{on ? "Аккаунты защищены" : "Строгая проверка входа"}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {on
              ? "Сервер принимает запросы только с секретным ключом, выданным при входе"
              : "Пока выключено, старые версии приложения работают без ключа — включите, когда все обновятся"}
          </p>
        </div>
      </div>

      {info && (
        <div className="grid grid-cols-2 gap-2 mb-1">
          <div className="rounded-xl bg-black/20 border border-white/5 px-3 py-2.5">
            <div className="text-lg font-bold text-emerald-400">{info.with_key}</div>
            <div className="text-[11px] text-slate-500">на новой версии (за сутки)</div>
          </div>
          <div className="rounded-xl bg-black/20 border border-white/5 px-3 py-2.5">
            <div className={`text-lg font-bold ${info.without_key ? "text-amber-400" : "text-slate-300"}`}>{info.without_key}</div>
            <div className="text-[11px] text-slate-500">ещё без ключа (за сутки)</div>
          </div>
        </div>
      )}

      {msg && <Note text={msg} />}

      {editable && (
        <button
          onClick={() => apply(!on)}
          disabled={busy || !info}
          className={`w-full mt-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 ${
            on ? "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10" : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          {busy ? "Сохраняем…" : on ? "Выключить строгую проверку" : "Включить строгую проверку"}
        </button>
      )}
    </div>
  );
}
