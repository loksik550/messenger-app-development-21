import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "nova_chunk_reloaded_at";

/**
 * Обёртка над lazy() для экранов, которые подгружаются по мере надобности.
 *
 * Зачем: после выхода новой версии сайта браузер может держать в памяти
 * старую страницу и просить файлы, которых на сервере уже нет —
 * пользователь видит ошибку вместо окна. Здесь мы делаем две вещи:
 * 1) пробуем загрузить ещё раз (вдруг просто моргнула связь);
 * 2) если не вышло — один раз обновляем страницу, чтобы взять свежую версию.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      // Вторая попытка — помогает при коротком обрыве связи
      try {
        await new Promise((r) => setTimeout(r, 700));
        return await factory();
      } catch {
        /* переходим к обновлению страницы */
      }

      // Обновляемся не чаще раза в 10 секунд, чтобы не зациклиться,
      // если файл действительно недоступен
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        // Возвращаем заглушку — страница уже перезагружается
        return { default: (() => null) as unknown as T };
      }

      throw err;
    }
  });
}