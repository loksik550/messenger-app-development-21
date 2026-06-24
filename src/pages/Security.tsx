import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

// ── Подставь свои ссылки ──────────────────────────────────────────────
// Ссылка на отчёт VirusTotal (скопируй из адресной строки на странице отчёта)
const VIRUSTOTAL_URL = "https://www.virustotal.com/";
// Ссылка на публичный репозиторий GitHub (после подключения через «Скачать → Подключить GitHub»)
const GITHUB_URL = "https://github.com/";
// ──────────────────────────────────────────────────────────────────────

const UPDATED = "24 июня 2026 г.";

export default function Security() {
  const navigate = useNavigate();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Заявление о безопасности — Nova";
    return () => { document.title = prevTitle; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header
        className="flex items-center gap-3 px-4 pb-3 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10 print:hidden"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
          className="p-2 -ml-2 rounded-full hover:bg-accent transition"
          aria-label="Назад"
        >
          <Icon name="ArrowLeft" size={20} />
        </button>
        <h1 className="text-lg font-semibold flex-1">Заявление о безопасности</h1>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/15 text-violet-400 text-sm font-medium hover:bg-violet-500/25 transition"
        >
          <Icon name="Download" size={16} /> PDF
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 text-sm leading-relaxed space-y-6">
        <section>
          <h2 className="text-xl font-bold mb-1">Заявление о безопасности приложения Nova</h2>
          <p className="text-muted-foreground">Дата: {UPDATED}</p>
          <p className="mt-3">
            Настоящим подтверждаем безопасность и надёжность мобильного приложения
            Nova. Ниже приведены меры защиты и независимые доказательства,
            подтверждающие отсутствие вредоносного или скрытого функционала.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">1. Минимальные разрешения</h3>
          <p>
            Приложение запрашивает только доступ в интернет (разрешение INTERNET).
            Оно <strong>не запрашивает</strong> доступ к камере, микрофону,
            геолокации, контактам, файловой системе, SMS и иным чувствительным
            данным устройства.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">2. Открытый исходный код</h3>
          <p>
            Исходный код приложения опубликован в открытом репозитории и доступен
            для независимой проверки любым экспертом:
          </p>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-violet-400 underline break-all mt-1 inline-block">
            {GITHUB_URL}
          </a>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">3. Меры безопасности</h3>
          <ul className="list-disc list-inside space-y-1 ml-1 mt-2">
            <li>Все соединения с сервером работают только по защищённому протоколу HTTPS (TLS 1.2+);</li>
            <li>Пароли пользователей хранятся исключительно в зашифрованном виде (хеширование PBKDF2 с уникальной солью), в открытом виде не сохраняются;</li>
            <li>Персональные данные не продаются и не передаются третьим лицам в рекламных или коммерческих целях;</li>
            <li>Реализована функция полного удаления аккаунта и связанных данных по запросу пользователя;</li>
            <li>Данные обрабатываются и хранятся на серверах на территории РФ в соответствии с Федеральным законом № 152-ФЗ.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">4. Независимая проверка на вредоносный код</h3>
          <p>
            Приложение просканировано сервисом VirusTotal (более 70 антивирусных
            движков) — угроз не обнаружено. Отчёт доступен по ссылке:
          </p>
          <a href={VIRUSTOTAL_URL} target="_blank" rel="noopener noreferrer" className="text-violet-400 underline break-all mt-1 inline-block">
            {VIRUSTOTAL_URL}
          </a>
          <p className="mt-2">
            Дополнительно проведено автоматическое сканирование безопасности
            инструментом Mobile Security Framework (MobSF); отчёт прилагается к
            заявке.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">5. Политика конфиденциальности</h3>
          <p>
            Полная политика конфиденциальности с описанием обрабатываемых данных
            доступна по адресу:
          </p>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline break-all mt-1 inline-block">
            https://novaa.pro/privacy
          </a>
        </section>

        <section className="pt-2 border-t border-border">
          <p className="text-muted-foreground">
            Готовы предоставить любую дополнительную информацию. Спасибо за рассмотрение.
          </p>
        </section>
      </main>
    </div>
  );
}
