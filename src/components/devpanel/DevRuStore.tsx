import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Loading, ErrorBox } from "./DevDashboard";
import { rustoreCall, fmtDate, type Rating, type Screen, type StoreScreen, type SavedIcon, type Version } from "./rustoreApi";
import RuStoreRating from "./RuStoreRating";
import RuStoreScreens from "./RuStoreScreens";
import RuStoreIcon from "./RuStoreIcon";
import RuStoreVersions from "./RuStoreVersions";

const LS_AUTO_PUBLISH = "nova_rustore_auto_publish";
const LS_WHATS_NEW = "nova_rustore_whats_new";

interface StatusData {
  configured: boolean;
  release: { tag?: string; published_at?: string; aab_name?: string | null; aab_size?: number; error?: string } | null;
  versions: Version[];
  rating?: Rating | null;
  screens?: Screen[];
  store_screens?: StoreScreen[];
  icon?: SavedIcon | null;
  has_release?: boolean;
}

const call = rustoreCall;

export default function DevRuStore({ onOpenReviews }: { onOpenReviews?: () => void }) {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [whatsNew, setWhatsNew] = useState(() => localStorage.getItem(LS_WHATS_NEW) || "");
  const [autoPublish, setAutoPublish] = useState(() => localStorage.getItem(LS_AUTO_PUBLISH) !== "0");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  const load = () => {
    setLoading(true);
    call<StatusData>("status")
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    localStorage.setItem(LS_AUTO_PUBLISH, autoPublish ? "1" : "0");
  }, [autoPublish]);

  useEffect(() => {
    if (whatsNew) localStorage.setItem(LS_WHATS_NEW, whatsNew);
    else localStorage.removeItem(LS_WHATS_NEW);
  }, [whatsNew]);

  const publish = async () => {
    setConfirm(false);
    setSending(true);
    setResult(null);
    try {
      const r = await call<{ tag: string; version_id: number; screens: number; icon: boolean }>("publish", { whats_new: whatsNew, auto_publish: autoPublish });
      const shots = (r.screens ? ` Скриншоты обновлены (${r.screens} шт.).` : "") + (r.icon ? " Иконка обновлена." : "");
      setResult({ ok: true, text: `Версия ${r.tag} отправлена в RuStore на проверку.${shots} Обычно модерация занимает до 3 рабочих дней.` });
      setWhatsNew("");
      load();
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "Не удалось отправить" });
    } finally {
      setSending(false);
    }
  };

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox text={error} onRetry={load} />;
  if (!data) return null;

  const rel = data.release;
  const screens = data.screens || [];
  const screensBad = screens.length > 0 && screens.length < 3;
  const hasRelease = !!data.has_release;
  const already = data.versions.some((v) => v.name && rel?.tag && String(v.name) === rel.tag.replace(/^v/, "") && v.status !== "DELETED_DRAFT" && v.status !== "DRAFT");

  return (
    <div className="space-y-5 max-w-3xl">
      {!data.configured && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 flex gap-3">
          <Icon name="KeyRound" size={18} className="flex-shrink-0 mt-0.5" />
          <div>Ключи RuStore ещё не добавлены. Добавьте ID ключа и приватный ключ в настройках проекта — после этого кнопка заработает.</div>
        </div>
      )}

      <RuStoreRating rating={data.rating} onOpenReviews={onOpenReviews} />

      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <Icon name="Package" size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500">Последняя сборка в GitHub</div>
            {rel?.error ? (
              <div className="text-red-300 text-sm">{rel.error}</div>
            ) : (
              <>
                <div className="text-lg font-bold text-white">{rel?.tag || "—"}</div>
                <div className="text-xs text-slate-400">
                  {rel?.aab_name ? `${rel.aab_name} · ${Math.round((rel.aab_size || 0) / 1048576)} МБ` : "Файл .aab не найден"}
                  {rel?.published_at && ` · собрана ${fmtDate(rel.published_at)}`}
                </div>
              </>
            )}
          </div>
          <button onClick={load} className="p-2 rounded-xl hover:bg-white/5 text-slate-400" title="Обновить">
            <Icon name="RefreshCw" size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <label className="block text-xs text-slate-400 mb-1.5">Что нового (увидят пользователи в RuStore)</label>
        <textarea
          value={whatsNew}
          onChange={(e) => setWhatsNew(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Например: журнал звонков, ответ прямо из уведомления, Избранное для заметок и файлов."
          className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 resize-none"
        />

        <label className="flex items-center gap-2 mt-3 text-sm text-slate-300 cursor-pointer select-none">
          <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} className="accent-violet-500 w-4 h-4" />
          Опубликовать сразу после одобрения модератором
        </label>

        <div className={`mt-3 rounded-xl px-3 py-2.5 text-xs flex gap-2 ${hasRelease ? "bg-sky-500/10 text-sky-200" : "bg-amber-500/10 text-amber-200"}`}>
          <Icon name={hasRelease ? "Rocket" : "FlaskConical"} size={15} className="flex-shrink-0 mt-0.5" />
          {hasRelease ? (
            <div>Версия уйдёт как <b>обновление релиза</b> — после одобрения её увидят все пользователи RuStore.</div>
          ) : (
            <div>
              Сейчас приложение в RuStore есть только в <b>закрытом тесте (альфа)</b>, публичной версии ещё нет.
              Через панель RuStore разрешает отправлять только обновления, поэтому первую публичную версию нужно один раз
              загрузить вручную в{" "}
              <a href="https://console.rustore.ru/" target="_blank" rel="noreferrer" className="underline">консоли RuStore</a>{" "}
              (тип — «Релиз»). После её одобрения кнопка ниже будет отправлять обновления сразу в релиз.
            </div>
          )}
        </div>

        {screensBad && (
          <div className="mt-3 text-xs text-amber-300">Загружено {screens.length} скриншота из минимум 3 — добавьте ещё ниже или удалите все.</div>
        )}

        {already && (
          <div className="mt-3 text-xs text-amber-300">Похоже, {rel?.tag} уже отправлялась в RuStore. Соберите новый релиз в GitHub перед отправкой.</div>
        )}

        <button
          disabled={!data.configured || sending || !rel?.aab_name || screensBad}
          onClick={() => setConfirm(true)}
          className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Отправляем — это займёт до минуты…</>
          ) : (
            <><Icon name="Send" size={16} /> Отправить {rel?.tag || ""} в RuStore на проверку</>
          )}
        </button>

        {result && (
          <div className={`mt-3 rounded-xl px-3 py-2.5 text-sm flex gap-2 ${result.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
            <Icon name={result.ok ? "CheckCircle2" : "AlertTriangle"} size={16} className="flex-shrink-0 mt-0.5" />
            {result.text}
          </div>
        )}
      </div>

      <RuStoreIcon icon={data.icon || null} onChange={(next) => setData((d) => (d ? { ...d, icon: next } : d))} />

      <RuStoreScreens
        screens={screens}
        storeScreens={data.store_screens || []}
        onChange={(next) => setData((d) => (d ? { ...d, screens: next } : d))}
      />

      <RuStoreVersions versions={data.versions} onChange={(next) => setData((d) => (d ? { ...d, versions: next } : d))} />

      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#14141f] border border-white/10 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-white mb-2">Отправить {rel?.tag} в RuStore?</div>
            <div className="text-sm text-slate-400 mb-4">
              Версия уйдёт на модерацию{data.icon ? " вместе с новой иконкой" : ""}{screens.length >= 3 ? ` и ${screens.length} скриншотами` : ""}. {autoPublish ? "После одобрения она сразу станет доступна пользователям." : "После одобрения её нужно будет опубликовать вручную в консоли RuStore."}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(false)} className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:bg-white/5">Отмена</button>
              <button onClick={publish} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-sky-500 to-blue-600 text-white">Отправить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}