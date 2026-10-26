import { createFileRoute, Link } from "@tanstack/react-router";
import Icon from "@/components/ui/icon";

const RUSTORE_URL = "https://www.rustore.ru/catalog/app/ru.nova.messenger";
const TITLE = "О мессенджере Nova — чаты, звонки и голосовые";
const DESCRIPTION =
  "Nova — российский мессенджер: личные и групповые чаты, аудио- и видеозвонки, голосовые и видео-кружки, файлы, истории. Бесплатно для Android в RuStore.";

const FEATURES = [
  { icon: "MessagesSquare", title: "Личные и групповые чаты", text: "Общайтесь один на один или собирайте друзей, семью и коллег в группы." },
  { icon: "Video", title: "Аудио- и видеозвонки", text: "Стабильная связь через Wi-Fi и мобильный интернет." },
  { icon: "Mic", title: "Голосовые и видео-кружки", text: "Когда проще сказать, чем написать." },
  { icon: "Paperclip", title: "Фото, видео и документы", text: "Делитесь файлами прямо в переписке." },
  { icon: "Sparkles", title: "Истории, стикеры и реакции", text: "Живое общение с эмоциями." },
  { icon: "Clock", title: "Отложенные сообщения", text: "Отправка в нужное время и избранное под рукой." },
  { icon: "ShieldCheck", title: "Приватность", text: "Данные на серверах в России, защищённое соединение, удаление аккаунта в любой момент." },
  { icon: "Crown", title: "Nova Pro", text: "Расширенные возможности и яркое оформление профиля." },
];

const SHOTS = [
  { src: "/about/nova-1-chats.webp", alt: "Список чатов в мессенджере Nova" },
  { src: "/about/nova-4-chat.webp", alt: "Переписка, голосовое сообщение и звонок в Nova" },
  { src: "/about/nova-2-profile.webp", alt: "Профиль пользователя в Nova" },
  { src: "/about/nova-3-security.webp", alt: "Настройки безопасности в Nova" },
];

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://novaa.pro/about" },
    ],
    links: [{ rel: "canonical", href: "https://novaa.pro/about" }],
  }),
  component: About,
});

function RuStoreButton() {
  return (
    <a
      href={RUSTORE_URL}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-violet-600/30 hover:brightness-110 transition"
    >
      <Icon name="Download" size={20} />
      Скачать в RuStore
    </a>
  );
}

function About() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header
        className="max-w-6xl mx-auto px-5 pb-4 flex items-center justify-between"
        style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/app-icon-192.png" alt="" className="w-9 h-9 rounded-xl" />
          <span className="text-xl font-bold">Nova</span>
        </Link>
        <Link to="/" className="text-sm text-slate-300 hover:text-white transition">
          Открыть в браузере
        </Link>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-5 pt-10 pb-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-violet-500/15 text-violet-300 text-xs font-medium mb-5">
              Бесплатно для Android
            </span>
            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-5">
              Nova — мессенджер для общения
            </h1>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              Переписка, аудио- и видеозвонки, голосовые сообщения, фото и файлы — в одном приложении.
              Регистрация по номеру телефона за минуту, без пароля.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <RuStoreButton />
              <Link to="/" className="px-5 py-3.5 rounded-2xl border border-white/15 text-sm font-medium hover:bg-white/5 transition">
                Веб-версия
              </Link>
            </div>
          </div>
          <div className="flex justify-center gap-4">
            <img src={SHOTS[0].src} alt={SHOTS[0].alt} width={540} height={960} className="w-44 md:w-56 rounded-[28px] border border-white/10 shadow-2xl shadow-violet-900/40 translate-y-6" />
            <img src={SHOTS[1].src} alt={SHOTS[1].alt} width={540} height={960} className="w-44 md:w-56 rounded-[28px] border border-white/10 shadow-2xl shadow-violet-900/40 -translate-y-2" />
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 py-16">
          <h2 className="text-3xl font-bold mb-10 text-center">Возможности</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
                <div className="w-11 h-11 rounded-xl bg-violet-500/15 text-violet-300 flex items-center justify-center mb-4">
                  <Icon name={f.icon} size={22} />
                </div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16">
          <h2 className="text-3xl font-bold mb-10 text-center px-5">Как выглядит Nova</h2>
          <div className="flex gap-5 overflow-x-auto px-5 pb-4 snap-x md:justify-center">
            {SHOTS.map((s) => (
              <img
                key={s.src}
                src={s.src}
                alt={s.alt}
                width={540}
                height={960}
                loading="lazy"
                className="w-56 shrink-0 snap-center rounded-[28px] border border-white/10"
              />
            ))}
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-5 py-16 text-center">
          <div className="p-10 rounded-3xl bg-gradient-to-br from-violet-600/25 to-fuchsia-600/15 border border-violet-500/25">
            <h2 className="text-3xl font-bold mb-3">Скачайте Nova бесплатно</h2>
            <p className="text-slate-300 mb-7">Установите приложение из RuStore и начните общаться уже сегодня.</p>
            <RuStoreButton />
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8 px-5 text-center text-sm text-slate-500">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mb-3">
          <Link to="/privacy" className="hover:text-white transition">Политика конфиденциальности</Link>
          <Link to="/terms" className="hover:text-white transition">Пользовательское соглашение</Link>
          <Link to="/security" className="hover:text-white transition">Безопасность</Link>
        </div>
        © Nova
      </footer>
    </div>
  );
}
