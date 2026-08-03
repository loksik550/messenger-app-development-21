import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

const UPDATED = "3 августа 2026 г.";
const VERSION = "1.0";
const SUPPORT_EMAIL = "support@novaa.pro";

export default function Terms() {
  const navigate = useNavigate();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Пользовательское соглашение — Nova";
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") || "";
    meta?.setAttribute(
      "content",
      "Пользовательское соглашение мессенджера Nova: правила использования, запрещённый контент, модерация, ответственность и порядок рассмотрения жалоб.",
    );
    return () => {
      document.title = prevTitle;
      meta?.setAttribute("content", prevDesc);
    };
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
        <h1 className="text-lg font-semibold flex-1">Пользовательское соглашение</h1>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/15 text-violet-400 text-sm font-medium hover:bg-violet-500/25 transition"
        >
          <Icon name="Download" size={16} /> PDF
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 text-sm leading-relaxed space-y-6">
        <section>
          <h2 className="text-xl font-bold mb-1">Nova — мессенджер для общения</h2>
          <p className="text-muted-foreground">
            Действует с {UPDATED}. Версия документа {VERSION}.
          </p>
          <p className="mt-3">
            Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует
            отношения между администрацией мессенджера Nova (далее — «Сервис», «мы»)
            и пользователем (далее — «Пользователь», «вы») при использовании
            мобильного приложения и веб-сервиса Nova.
          </p>
          <p className="mt-2">
            Регистрируясь и используя Сервис, вы подтверждаете, что полностью
            прочитали и принимаете условия настоящего Соглашения. Если вы не
            согласны с его условиями — пожалуйста, не используйте Сервис.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">1. Общие положения</h3>
          <ul className="list-disc list-inside space-y-1 ml-1 mt-2">
            <li>Сервис предоставляет возможность обмена личными и групповыми сообщениями, аудио- и видеозвонков, отправки фото, видео и голосовых сообщений;</li>
            <li>Использование Сервиса допускается лицами, достигшими 14 лет;</li>
            <li>Пользователь самостоятельно несёт ответственность за сохранность данных для доступа к своей учётной записи;</li>
            <li>Сервис предоставляется на условиях «как есть».</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">2. Запрещённый контент и действия</h3>
          <p>
            Пользователю категорически запрещается создавать, размещать, пересылать
            или распространять через Сервис следующий контент:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1 mt-2">
            <li>материалы, содержащие насилие, призывы к насилию, терроризму или экстремизму;</li>
            <li>порнографию, а также любые материалы с участием несовершеннолетних сексуального характера;</li>
            <li>материалы, пропагандирующие наркотические средства, их изготовление и сбыт;</li>
            <li>оскорбления, угрозы, травлю (буллинг), разжигание ненависти по национальному, религиозному, расовому или иному признаку;</li>
            <li>спам, массовые рассылки, мошеннические схемы и фишинг;</li>
            <li>материалы, нарушающие авторские и иные права третьих лиц;</li>
            <li>вредоносное программное обеспечение, вирусы, ссылки на опасные ресурсы;</li>
            <li>персональные данные третьих лиц без их согласия;</li>
            <li>любую иную информацию, запрещённую законодательством Российской Федерации.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">3. Модерация и жалобы</h3>
          <ul className="list-disc list-inside space-y-1 ml-1 mt-2">
            <li>В Сервисе доступна функция подачи жалобы на пользователя или сообщение;</li>
            <li>Пользователь может заблокировать любого нежелательного собеседника;</li>
            <li>Жалобы рассматриваются администрацией в течение 24 часов;</li>
            <li>При выявлении нарушений администрация вправе удалить контент и заблокировать учётную запись нарушителя без предупреждения;</li>
            <li>Администрация не осуществляет предварительную цензуру личной переписки, но реагирует на поступающие жалобы.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">4. Ответственность пользователя</h3>
          <ul className="list-disc list-inside space-y-1 ml-1 mt-2">
            <li>Пользователь несёт полную ответственность за размещаемый им контент и совершаемые действия;</li>
            <li>Пользователь обязуется не использовать Сервис для совершения противоправных действий;</li>
            <li>За нарушение настоящего Соглашения учётная запись может быть заблокирована или удалена.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">5. Права пользователя</h3>
          <ul className="list-disc list-inside space-y-1 ml-1 mt-2">
            <li>Удалять свои сообщения и полностью удалить учётную запись в любой момент;</li>
            <li>Блокировать нежелательных пользователей;</li>
            <li>Подавать жалобы на нарушения;</li>
            <li>Обращаться в поддержку по вопросам работы Сервиса.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">6. Персональные данные</h3>
          <p>
            Обработка персональных данных осуществляется в соответствии с
            Политикой конфиденциальности, доступной по адресу{" "}
            <a href="/privacy" className="text-violet-400 underline">novaa.pro/privacy</a>,
            и Федеральным законом № 152-ФЗ «О персональных данных».
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">7. Изменение условий</h3>
          <p>
            Администрация вправе вносить изменения в настоящее Соглашение.
            Актуальная версия всегда доступна в приложении. Продолжение
            использования Сервиса после изменений означает согласие с новой
            редакцией.
          </p>
        </section>

        <section>
          <h3 className="font-semibold text-base mb-1">8. Контакты</h3>
          <p>
            По всем вопросам, связанным с работой Сервиса, жалобами и нарушениями:
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-violet-400 underline break-all mt-1 inline-block">
            {SUPPORT_EMAIL}
          </a>
        </section>

        <section className="pt-2 border-t border-border">
          <p className="text-muted-foreground">
            Используя Nova, вы подтверждаете согласие с настоящим Пользовательским
            соглашением.
          </p>
        </section>
      </main>
    </div>
  );
}
