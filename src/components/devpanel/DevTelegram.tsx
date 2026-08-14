import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, downloadCsv } from "@/lib/devApi";

const EVENTS = [
  { key: "report", label: "Жалобы на пользователей", icon: "Flag" },
  { key: "support", label: "Обращения в поддержку", icon: "LifeBuoy" },
  { key: "pay", label: "Оплаты и подписки", icon: "Wallet" },
];

/** Настройка уведомлений в Telegram */
export default function DevTelegram() {
  const [enabled, setEnabled] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [help, setHelp] = useState(false);

  useEffect(() => {
    devApi<{
      enabled: boolean; has_token: boolean; chat_id: string; events: string[];
    }>("tg_get")
      .then((r) => {
        setEnabled(r.enabled);
        setHasToken(r.has_token);
        setChatId(r.chat_id);
        setEvents(r.events);
      })
      .catch(() => {});
  }, []);

  const save = async (on?: boolean) => {
    setBusy(true);
    setErr("");
    try {
      const next = on ?? enabled;
      await devApi("tg_save", {
        enabled: next,
        events,
        ...(token ? { token } : {}),
        chat_id: chatId,
      });
      if (token) setHasToken(true);
      setToken("");
      setEnabled(next);
      setMsg("Сохранено");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setErr("");
    try {
      await devApi("tg_test");
      setMsg("Отправил проверочное сообщение — проверьте Telegram");
      setTimeout(() => setMsg(""), 5000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setBusy(false);
    }
  };

  const toggleEvent = (k: string) => {
    setEvents((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
          <Icon name="Send" size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Уведомления в Telegram</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Жалобы, оплаты и обращения приходят вам на телефон
          </p>
        </div>
        <button
          onClick={() => save(!enabled)}
          disabled={busy || (!hasToken && !token)}
          title={!hasToken && !token ? "Сначала укажите ключ бота" : ""}
          className={`w-11 h-6 rounded-full transition relative shrink-0 disabled:opacity-40 ${
            enabled ? "bg-sky-500" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
              enabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <button
        onClick={() => setHelp(!help)}
        className="w-full flex items-center gap-2 text-xs text-sky-400 mb-3"
      >
        <Icon name={help ? "ChevronDown" : "ChevronRight"} size={14} />
        Как это настроить за 2 минуты
      </button>

      {help && (
        <div className="bg-black/25 border border-white/8 rounded-xl p-3.5 mb-4 text-xs text-slate-400 leading-relaxed space-y-2">
          <div><b className="text-slate-300">1.</b> В Telegram найдите бота @BotFather</div>
          <div><b className="text-slate-300">2.</b> Отправьте ему команду /newbot и придумайте имя</div>
          <div><b className="text-slate-300">3.</b> Он выдаст длинный ключ — вставьте его ниже</div>
          <div><b className="text-slate-300">4.</b> Найдите бота @userinfobot, он покажет ваш номер получателя</div>
          <div><b className="text-slate-300">5.</b> Напишите своему новому боту любое сообщение</div>
          <div className="text-slate-500 pt-1">Всё бесплатно, ограничений нет.</div>
        </div>
      )}

      <label className="text-xs text-slate-500 mb-1.5 block">
        Ключ бота {hasToken && <span className="text-emerald-400">· сохранён</span>}
      </label>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder={hasToken ? "Оставьте пустым, чтобы не менять" : "123456:AAxxxxxxxxxxxxxxxxxx"}
        className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500/50 transition mb-3 placeholder-slate-600"
      />

      <label className="text-xs text-slate-500 mb-1.5 block">Кому отправлять</label>
      <input
        value={chatId}
        onChange={(e) => setChatId(e.target.value)}
        placeholder="Ваш номер получателя, например 123456789"
        className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500/50 transition mb-4 placeholder-slate-600"
      />

      <label className="text-xs text-slate-500 mb-2 block">О чём сообщать</label>
      <div className="space-y-1.5 mb-4">
        {EVENTS.map((e) => (
          <button
            key={e.key}
            onClick={() => toggleEvent(e.key)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition ${
              events.includes(e.key)
                ? "bg-sky-500/12 border-sky-500/30"
                : "bg-white/[0.03] border-white/8"
            }`}
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                events.includes(e.key) ? "bg-sky-500 border-sky-500" : "border-white/20"
              }`}
            >
              {events.includes(e.key) && <Icon name="Check" size={11} className="text-white" />}
            </span>
            <Icon name={e.icon} size={14} className="text-slate-400 shrink-0" />
            <span className="text-xs">{e.label}</span>
          </button>
        ))}
      </div>

      {msg && (
        <div className="text-xs text-emerald-400 mb-3 flex items-center gap-1.5">
          <Icon name="CircleCheck" size={14} />
          {msg}
        </div>
      )}
      {err && (
        <div className="text-xs text-red-400 mb-3 flex items-start gap-1.5">
          <Icon name="CircleAlert" size={14} className="mt-0.5 shrink-0" />
          {err}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => save()}
          disabled={busy}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white text-sm font-semibold disabled:opacity-40"
        >
          Сохранить
        </button>
        <button
          onClick={test}
          disabled={busy || (!hasToken && !token) || !chatId}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm disabled:opacity-40"
        >
          Проверить
        </button>
      </div>
    </div>
  );
}

/** Резервная копия основных данных */
export function DevBackup() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const download = async () => {
    setBusy(true);
    try {
      const r = await devApi<{
        backup: Record<string, unknown>;
        made_at: number;
        counts: Record<string, number>;
      }>("backup_export");

      const blob = new Blob([JSON.stringify(r.backup, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `nova-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);

      setMsg(
        `Скачано: ${r.counts.users} пользователей, ${r.counts.orders} платежей, ` +
        `${r.counts.groups} сообществ`,
      );
      setTimeout(() => setMsg(""), 6000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Не удалось скачать");
    } finally {
      setBusy(false);
    }
  };

  const downloadTable = async () => {
    setBusy(true);
    try {
      const r = await devApi<{ backup: { users: Record<string, string | number>[] } }>(
        "backup_export",
      );
      downloadCsv(
        `nova-backup-${new Date().toISOString().slice(0, 10)}.csv`,
        ["ID", "Имя", "Телефон", "Premium до", "Кошелёк", "Проверен"],
        r.backup.users.map((u) => [
          u.id, u.name, u.phone,
          u.pro_until ? new Date(Number(u.pro_until) * 1000).toLocaleDateString("ru") : "",
          String(u.wallet).replace(".", ","),
          u.verified ? "Да" : "Нет",
        ]),
      );
      setMsg("Таблица скачана");
      setTimeout(() => setMsg(""), 4000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Не удалось скачать");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
          <Icon name="DatabaseBackup" size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold">Резервная копия</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Скачайте данные к себе — пользователи, платежи, сообщества и настройки
          </p>
        </div>
      </div>

      {msg && (
        <div className="text-xs text-emerald-400 mb-3 flex items-start gap-1.5">
          <Icon name="CircleCheck" size={14} className="mt-0.5 shrink-0" />
          {msg}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={download}
          disabled={busy}
          className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Icon name="Download" size={15} />
          Полная копия
        </button>
        <button
          onClick={downloadTable}
          disabled={busy}
          className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Icon name="Table" size={15} />
          Таблицей
        </button>
      </div>

      <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
        Храните копию в надёжном месте. Файл содержит личные данные —
        не пересылайте его посторонним.
      </p>
    </div>
  );
}
