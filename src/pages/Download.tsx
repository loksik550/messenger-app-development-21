import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "desktop";

const detectPlatform = (): Platform => {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
};

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  return false;
};

export default function Download() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    if (isStandalone()) setInstalled(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (platform === "ios") {
      setShowIOSHint(true);
      return;
    }
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    setShowIOSHint(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0814] via-[#13102b] to-[#1a0f2e] text-white overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/30 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/40">
            <Icon name="MessageCircle" size={22} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Nova</span>
        </Link>
        <Link
          to="/"
          className="text-sm text-white/70 hover:text-white transition flex items-center gap-1"
        >
          Открыть в браузере
          <Icon name="ArrowRight" size={16} />
        </Link>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-8 pb-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Версия 1.0 • Бесплатно
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight mb-6">
              Nova — мессенджер{" "}
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
                нового поколения
              </span>
            </h1>

            <p className="text-lg text-white/70 mb-8 max-w-lg">
              Зашифрованные чаты, звонки, истории, каналы и кошелёк — в одном
              приложении. Устанавливается на телефон в один тап.
            </p>

            {installed ? (
              <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-6 max-w-md">
                <Icon name="CheckCircle2" size={28} className="text-emerald-400" />
                <div>
                  <div className="font-semibold">Уже установлено</div>
                  <div className="text-sm text-white/60">
                    Найди иконку Nova на главном экране
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Button
                  onClick={handleInstall}
                  size="lg"
                  className="h-14 px-8 text-base font-semibold bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 shadow-xl shadow-violet-600/40 rounded-2xl"
                >
                  <Icon name="Download" size={20} className="mr-2" />
                  Скачать на телефон
                </Button>
                <Link to="/">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-14 px-8 text-base font-semibold border-white/20 bg-white/5 hover:bg-white/10 text-white rounded-2xl w-full"
                  >
                    <Icon name="Globe" size={20} className="mr-2" />
                    Открыть в браузере
                  </Button>
                </Link>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-white/60">
              <span className="flex items-center gap-1.5">
                <Icon name="Shield" size={16} className="text-violet-400" />
                Зашифровано
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="Zap" size={16} className="text-yellow-400" />
                Быстро
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="Wifi" size={16} className="text-blue-400" />
                Работает оффлайн
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="HardDrive" size={16} className="text-emerald-400" />
                Меньше 5 МБ
              </span>
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="relative w-[280px] h-[560px] rounded-[3rem] bg-gradient-to-br from-zinc-800 to-zinc-900 p-3 shadow-2xl shadow-violet-600/30 border border-white/10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-10" />
              <div className="w-full h-full rounded-[2.3rem] bg-gradient-to-br from-[#0a0814] via-[#1a0f2e] to-[#0a0814] overflow-hidden relative">
                <div className="px-5 pt-10">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="text-xs text-white/50">Чаты</div>
                      <div className="text-2xl font-bold">Nova</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-500" />
                  </div>
                  {[
                    { name: "Анна", msg: "Привет! Как дела?", time: "12:34", unread: 2, color: "from-pink-500 to-rose-500" },
                    { name: "Команда", msg: "Встреча в 16:00", time: "11:20", unread: 5, color: "from-violet-500 to-purple-500" },
                    { name: "Михаил", msg: "Отправил файл", time: "10:15", unread: 0, color: "from-blue-500 to-cyan-500" },
                    { name: "Семья", msg: "Фото с дачи", time: "09:42", unread: 1, color: "from-emerald-500 to-teal-500" },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center gap-3 py-3 border-b border-white/5">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${c.color} flex items-center justify-center font-semibold text-sm shrink-0`}>
                        {c.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm truncate">{c.name}</span>
                          <span className="text-[10px] text-white/40">{c.time}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs text-white/60 truncate">{c.msg}</span>
                          {c.unread > 0 && (
                            <span className="ml-2 min-w-[18px] h-[18px] px-1.5 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 text-[10px] font-bold flex items-center justify-center">
                              {c.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -top-6 -right-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-xs font-semibold shadow-lg rotate-6">
              Бесплатно
            </div>
          </div>
        </div>

        <div className="mt-24 grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: "MessageSquare", title: "Чаты и группы", desc: "До 200 000 участников" },
            { icon: "Phone", title: "Звонки HD", desc: "Голос и видео" },
            { icon: "Wallet", title: "Кошелёк", desc: "Переводы в чате" },
            { icon: "Sparkles", title: "Истории", desc: "Делись моментами" },
          ].map((f, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur hover:bg-white/10 transition"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center mb-3">
                <Icon name={f.icon} size={22} className="text-violet-300" />
              </div>
              <div className="font-semibold mb-1">{f.title}</div>
              <div className="text-sm text-white/60">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-20">
          <h2 className="text-3xl font-bold mb-8 text-center">Как установить</h2>
          <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            <div className={`p-6 rounded-2xl border ${platform === "android" ? "bg-emerald-500/10 border-emerald-500/40" : "bg-white/5 border-white/10"}`}>
              <div className="flex items-center gap-3 mb-3">
                <Icon name="Smartphone" size={28} className="text-emerald-400" />
                <span className="font-bold text-lg">Android</span>
                {platform === "android" && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
                    это ты
                  </span>
                )}
              </div>
              <ol className="space-y-2 text-sm text-white/70 list-decimal list-inside">
                <li>Нажми «Скачать на телефон»</li>
                <li>В появившемся окне — «Установить»</li>
                <li>Иконка Nova появится на главном экране</li>
              </ol>
            </div>

            <div className={`p-6 rounded-2xl border ${platform === "ios" ? "bg-emerald-500/10 border-emerald-500/40" : "bg-white/5 border-white/10"}`}>
              <div className="flex items-center gap-3 mb-3">
                <Icon name="Apple" size={28} className="text-white/80" />
                <span className="font-bold text-lg">iPhone</span>
                {platform === "ios" && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
                    это ты
                  </span>
                )}
              </div>
              <ol className="space-y-2 text-sm text-white/70 list-decimal list-inside">
                <li>Открой сайт в Safari</li>
                <li>Внизу — кнопка «Поделиться»</li>
                <li>Выбери «На экран Домой»</li>
              </ol>
            </div>

            <div className={`p-6 rounded-2xl border ${platform === "desktop" ? "bg-emerald-500/10 border-emerald-500/40" : "bg-white/5 border-white/10"}`}>
              <div className="flex items-center gap-3 mb-3">
                <Icon name="Monitor" size={28} className="text-blue-300" />
                <span className="font-bold text-lg">Компьютер</span>
                {platform === "desktop" && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
                    это ты
                  </span>
                )}
              </div>
              <ol className="space-y-2 text-sm text-white/70 list-decimal list-inside">
                <li>В Chrome/Edge справа в адресной строке — значок установки</li>
                <li>Нажми «Установить»</li>
                <li>Nova появится как обычное приложение</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="mt-20 p-8 rounded-3xl bg-gradient-to-r from-violet-600/20 to-blue-600/20 border border-white/10 text-center max-w-3xl mx-auto">
          <Icon name="Shield" size={40} className="text-violet-300 mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">Это безопасно</h3>
          <p className="text-white/70 max-w-xl mx-auto">
            Nova устанавливается напрямую с сайта по технологии PWA — без
            магазинов приложений, без рекламы и без скрытых процессов. Всё
            работает в защищённой среде браузера.
          </p>
        </div>

        <footer className="mt-20 text-center text-sm text-white/40">
          © {new Date().getFullYear()} Nova • Сделано с любовью
        </footer>
      </main>

      {showIOSHint && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowIOSHint(false)}
        >
          <div
            className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Установка на iPhone</h3>
              <button
                onClick={() => setShowIOSHint(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
              >
                <Icon name="X" size={18} />
              </button>
            </div>
            <ol className="space-y-4">
              <li className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center font-bold text-sm shrink-0">1</span>
                <div>
                  <div className="font-semibold">Открой сайт в Safari</div>
                  <div className="text-sm text-white/60">Если ты в Chrome — скопируй ссылку и открой в Safari</div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center font-bold text-sm shrink-0">2</span>
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    Нажми кнопку «Поделиться»
                    <Icon name="Share" size={16} className="text-blue-400" />
                  </div>
                  <div className="text-sm text-white/60">Внизу экрана</div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center font-bold text-sm shrink-0">3</span>
                <div>
                  <div className="font-semibold">Выбери «На экран Домой»</div>
                  <div className="text-sm text-white/60">Прокрути вниз в списке действий</div>
                </div>
              </li>
            </ol>
            <Button
              onClick={() => setShowIOSHint(false)}
              className="w-full mt-6 h-12 bg-gradient-to-r from-violet-600 to-blue-600 rounded-2xl"
            >
              Понятно
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
