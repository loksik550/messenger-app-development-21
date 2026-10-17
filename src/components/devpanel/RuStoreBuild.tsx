import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { rustoreCall } from "./rustoreApi";

const LS_BUILD_TAG = "nova_rustore_build_tag";

type BuildState = "idle" | "starting" | "queued" | "building" | "success" | "failed" | "unknown";

export default function RuStoreBuild({
  hasToken,
  needNew,
  onReady,
}: {
  hasToken: boolean;
  needNew: boolean;
  onReady: () => void;
}) {
  const [tag, setTag] = useState<string>(() => localStorage.getItem(LS_BUILD_TAG) || "");
  const [state, setState] = useState<BuildState>(tag ? "queued" : "idle");
  const [runUrl, setRunUrl] = useState("");
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState(Date.now());
  const [, force] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [gh, setGh] = useState<{ ok: boolean; text: string; login?: string } | null>(null);

  useEffect(() => {
    if (!hasToken) return;
    rustoreCall<{ ok: boolean; text: string; login?: string }>("gh_check").then(setGh).catch(() => undefined);
  }, [hasToken]);

  useEffect(() => {
    if (!tag) return;
    const check = async () => {
      try {
        const r = await rustoreCall<{ state: BuildState; url?: string; ready: boolean }>("build_status", { tag });
        if (r.url) setRunUrl(r.url);
        if (r.ready) {
          setState("success");
          localStorage.removeItem(LS_BUILD_TAG);
          if (timer.current) clearInterval(timer.current);
          onReady();
          return;
        }
        if (r.state === "failed") {
          setState("failed");
          localStorage.removeItem(LS_BUILD_TAG);
          if (timer.current) clearInterval(timer.current);
          return;
        }
        setState(r.state === "success" ? "building" : r.state);
      } catch { /* попробуем ещё раз */ }
    };
    check();
    timer.current = setInterval(() => { check(); force((x) => x + 1); }, 20000);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  const start = async () => {
    setError("");
    setState("starting");
    try {
      const r = await rustoreCall<{ tag: string }>("bump");
      localStorage.setItem(LS_BUILD_TAG, r.tag);
      setStartedAt(Date.now());
      setTag(r.tag);
      setState("queued");
    } catch (e) {
      setState("idle");
      setError(e instanceof Error ? e.message : "Не удалось запустить сборку");
    }
  };

  const mins = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  const busy = state === "starting" || state === "queued" || state === "building";

  return (
    <div className="mb-4 rounded-xl border border-violet-500/25 bg-violet-500/[0.07] p-3.5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center flex-shrink-0">
          <Icon name={state === "success" ? "CircleCheck" : state === "failed" ? "CircleX" : "Hammer"} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">
            {state === "success" ? `Сборка ${tag} готова` :
             state === "failed" ? `Сборка ${tag} не удалась` :
             busy ? `Собираем ${tag || "новую версию"}…` :
             "Новая версия приложения"}
          </div>
          <div className="text-xs text-slate-400">
            {!hasToken ? "Нужен ключ GitHub в секретах проекта (GITHUB_RELEASE_TOKEN)" :
             state === "success" ? "Теперь нажмите «Отправить в RuStore» ниже" :
             state === "failed" ? "Откройте журнал сборки или попробуйте ещё раз" :
             busy ? `Номер версии повышен автоматически. Обычно 10–15 минут${mins ? ` · прошло ${mins} мин` : ""}` :
             needNew ? "Текущая сборка уже в RuStore — соберите новую с последними изменениями" :
             "Повысит номер версии и соберёт приложение с последними изменениями"}
          </div>
        </div>
        {busy ? (
          <div className="w-5 h-5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin flex-shrink-0" />
        ) : state !== "success" && (
          <button
            onClick={start}
            disabled={!hasToken || (gh !== null && !gh.ok)}
            className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-40 flex-shrink-0"
          >
            {state === "failed" ? "Ещё раз" : "Собрать"}
          </button>
        )}
      </div>
      {runUrl && (busy || state === "failed") && (
        <a href={runUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-violet-300 underline">
          Журнал сборки в GitHub
        </a>
      )}
      {gh && !gh.ok && !busy && state !== "success" && (
        <div className="mt-2.5 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-2 flex gap-2">
          <Icon name="KeyRound" size={13} className="shrink-0 mt-0.5" />
          <span>{gh.text}</span>
        </div>
      )}
      {gh?.ok && gh.login && !busy && state === "idle" && (
        <div className="mt-2 text-[11px] text-emerald-300/80">Ключ GitHub работает (аккаунт {gh.login})</div>
      )}
      {error && <div className="mt-2 text-xs text-red-300 break-words">{error}</div>}
    </div>
  );
}
