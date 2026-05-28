import Icon from "@/components/ui/icon";

interface Props {
  onBack: () => void;
}

export default function PrivacyPolicyPanel({ onBack }: Props) {
  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-background z-10">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-accent transition"
          aria-label="Назад"
        >
          <Icon name="ArrowLeft" size={20} />
        </button>
        <h1 className="text-lg font-semibold">Политика конфиденциальности</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed space-y-5">
        <section>
          <h2 className="text-base font-semibold mb-1">Nova Messenger</h2>
          <p className="text-muted-foreground">
            Действует с 1 января 2025 г. Версия документа 1.0.
          </p>
        </section>

        <section>
          <h3 className="font-semibold mb-1">1. Общие положения</h3>
          <p>
            Настоящая Политика определяет порядок обработки персональных данных
            (далее — ПД) пользователей мессенджера Nova в соответствии с
            Федеральным законом № 152-ФЗ «О персональных данных».
          </p>
        </section>

        <section>
          <h3 className="font-semibold mb-1">2. Какие данные мы собираем</h3>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Номер мобильного телефона (для регистрации и авторизации)</li>
            <li>Имя, фамилия, аватар, информация «О себе» (заполняете сами)</li>
            <li>Содержимое отправляемых сообщений, файлов, голосовых</li>
            <li>Список контактов (только если вы дали согласие)</li>
            <li>Геолокация (только если вы отправляете её в чат)</li>
            <li>IP-адрес и информация об устройстве (для безопасности)</li>
            <li>Push-токен устройства (для доставки уведомлений)</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold mb-1">3. Цели обработки</h3>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Регистрация и авторизация в приложении</li>
            <li>Передача сообщений и файлов между пользователями</li>
            <li>Отправка push-уведомлений о новых сообщениях</li>
            <li>Защита от мошенничества и спама</li>
            <li>Техническая поддержка</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold mb-1">4. Где хранятся данные</h3>
          <p>
            Все ПД хранятся на серверах, физически расположенных на территории
            Российской Федерации, в соответствии с требованиями ст. 18 152-ФЗ.
            Шифрование передачи: TLS 1.2+. Доступ к базам данных ограничен и
            журналируется.
          </p>
        </section>

        <section>
          <h3 className="font-semibold mb-1">5. Передача третьим лицам</h3>
          <p>
            Мы не передаём ваши ПД третьим лицам, за исключением случаев,
            предусмотренных законом (запросы уполномоченных госорганов с
            соблюдением установленной процедуры). Для отправки push-уведомлений
            используется сервис FCM (Google) — передаётся только обезличенный
            токен устройства, без содержимого сообщений.
          </p>
        </section>

        <section>
          <h3 className="font-semibold mb-1">6. Ваши права</h3>
          <p>В любой момент вы можете:</p>
          <ul className="list-disc list-inside space-y-1 ml-1 mt-1">
            <li>Получить информацию о хранящихся о вас ПД</li>
            <li>Потребовать исправления неточных данных</li>
            <li>
              <strong>Удалить аккаунт</strong> прямо в приложении: Настройки →
              Аккаунт → Удалить аккаунт
            </li>
            <li>Отозвать согласие на обработку ПД</li>
            <li>Обратиться с жалобой в Роскомнадзор</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold mb-1">7. Возрастные ограничения</h3>
          <p>
            Сервис предназначен для лиц старше 14 лет. Регистрируясь, вы
            подтверждаете соответствие этому условию.
          </p>
        </section>

        <section>
          <h3 className="font-semibold mb-1">8. Срок хранения</h3>
          <p>
            ПД хранятся до удаления аккаунта пользователем. После удаления
            данные стираются безвозвратно в течение 24 часов. Резервные копии
            ротируются и полностью обновляются в течение 30 дней.
          </p>
        </section>

        <section>
          <h3 className="font-semibold mb-1">9. Cookies и аналитика</h3>
          <p>
            Приложение не использует рекламные cookies и не передаёт данные
            рекламным сетям. Используется только техническое локальное хранилище
            для сохранения сессии и настроек.
          </p>
        </section>

        <section>
          <h3 className="font-semibold mb-1">10. Контакты</h3>
          <p>
            По вопросам обработки ПД и для отзыва согласия пишите в Поддержку
            прямо из приложения: Настройки → Поддержка.
          </p>
        </section>

        <section className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          Регистрируясь в Nova, вы подтверждаете, что ознакомились с настоящей
          Политикой и даёте согласие на обработку ваших ПД в указанных целях и
          объёме.
        </section>
      </div>
    </div>
  );
}
