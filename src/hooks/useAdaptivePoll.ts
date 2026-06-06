import { useEffect, useRef } from "react";

/**
 * Адаптивный опрос сервера.
 * Когда данные приходят (активный диалог) — опрашиваем часто (minMs).
 * Когда тишина — интервал плавно растёт до maxMs, экономя запросы и серверные ресурсы.
 * Любая активность мгновенно сбрасывает интервал обратно к minMs.
 * Опрос не выполняется, если вкладка свёрнута; при возврате на вкладку — мгновенный опрос.
 *
 * @param poll функция опроса. Должна вернуть true, если были изменения (новые данные).
 * @param deps зависимости, при смене которых опрос перезапускается (например, id чата).
 * @param minMs минимальный интервал (активность). По умолчанию 3000 мс.
 * @param maxMs максимальный интервал (тишина). По умолчанию 10000 мс.
 */
export function useAdaptivePoll(
  poll: () => Promise<boolean | void> | boolean | void,
  deps: ReadonlyArray<unknown>,
  minMs = 3000,
  maxMs = 10000,
) {
  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let currentDelay = minMs;

    const schedule = (delay: number) => {
      if (cancelled) return;
      timer = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") {
        // Вкладка свёрнута — не дёргаем сервер, проверим позже по максимальному интервалу.
        schedule(maxMs);
        return;
      }
      let changed: boolean | void = false;
      try {
        changed = await pollRef.current();
      } catch {
        changed = false;
      }
      if (changed) {
        // Есть активность — опрашиваем часто.
        currentDelay = minMs;
      } else {
        // Тишина — плавно замедляемся до потолка.
        currentDelay = Math.min(maxMs, Math.round(currentDelay * 1.5));
      }
      schedule(currentDelay);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        // Вернулись на вкладку — мгновенный опрос и сброс к частому интервалу.
        if (timer) clearTimeout(timer);
        currentDelay = minMs;
        tick();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    schedule(minMs);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default useAdaptivePoll;
