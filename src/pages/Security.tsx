import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

// ── Подставь свои ссылки ──────────────────────────────────────────────
// Ссылка на отчёт VirusTotal (скопируй из адресной строки на странице отчёта)
const VIRUSTOTAL_URL = "https://www.virustotal.com/gui/file/027218c606dcf810baf3db48982258124b2b984a6d3c6e1f6b1b22863050dcca/detection";
// Ссылка на публичный репозиторий GitHub (после подключения через «Скачать → Подключить GitHub»)
const GITHUB_URL = "https://github.com/loksik550/messenger-app-development-21";
// ──────────────────────────────────────────────────────────────────────

const UPDATED = "3 августа 2026 г.";
const SUPPORT_EMAIL = "Feeldex@mail.ru";

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
            Приложение запрашивает только те разрешения, которые необходимы для
            его основных функций:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1 mt-2">
            <li><strong>Интернет</strong> — для обмена сообщениями и звонков;</li>
            <li><strong>Микрофон</strong> — только во время голосовых сообщений и звонков, по явному действию пользователя;</li>
            <li><strong>Камера</strong> — только во время видеозвонков и отправки фото, по явному действию пользователя;</li>
            <li><strong>Уведомления</strong> — для оповещений о новых сообщениях и звонках.</li>
          </ul>
          <p className="mt-2">
            Приложение <strong>не запрашивает</strong> доступ к геолокации,
            контактам, SMS и не собирает данные в фоновом режиме. Доступ к камере
            и микрофону активируется исключительно в момент соответствующего
            действия и не используется скрыто.
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
            <li>Аудио- и видеозвонки передаются по технологии WebRTC с обязательным шифрованием медиапотока (DTLS-SRTP);</li>
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
          <p className="mt-2">
            Правила использования и перечень запрещённого контента изложены в
            Пользовательском соглашении:
          </p>
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline break-all mt-1 inline-block">
            https://novaa.pro/terms
          </a>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">6. Модерация контента и защита пользователей</h3>
          <p>
            В приложении реализованы механизмы защиты пользователей от
            нежелательного контента:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1 mt-2">
            <li>Возможность пожаловаться на пользователя или сообщение;</li>
            <li>Блокировка нежелательных собеседников;</li>
            <li>Удаление собственных сообщений и полное удаление аккаунта;</li>
            <li>Жалобы рассматриваются в течение 24 часов, нарушители блокируются.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">7. Связь с разработчиком</h3>
          <p>
            По вопросам безопасности, жалобам и запросам на удаление данных:
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-violet-400 underline break-all mt-1 inline-block">
            {SUPPORT_EMAIL}
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