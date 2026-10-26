import {useEffect, useState, type ReactNode} from "react";
import {HeadContent, Outlet, Scripts, createRootRoute} from "@tanstack/react-router";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {SplashScreen} from "@capacitor/splash-screen";
import {Toaster} from "@/components/ui/toaster";
import {Toaster as Sonner} from "@/components/ui/sonner";
import {TooltipProvider} from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFound from "@/pages/NotFound";
import {native} from "@/lib/native";
import {useNavigate, useLocation} from "@/lib/router-compat";
import {
    applyTheme,
    getStoredTheme,
    getStoredFontSize,
    applyAccent,
    getStoredAccentHex,
    startAutoTheme,
    getStoredAutoConfig,
    applyBubbleStyle,
    getStoredBubbleStyle,
} from "@/lib/theme";
import {PLATFORM_META, PLATFORM_SCRIPTS} from "@/platform/scripts.gen";
import {HMR_CLIENT} from "@/platform/dev-hmr";
import appCss from "@/index.css?url";

const TITLE = "Nova — мессенджер для общения";
const DESCRIPTION =
    "Nova — мессенджер для приватного общения: личные и групповые чаты, звонки, фото, видео и голосовые сообщения";
const OG_DESCRIPTION =
    "Мессенджер Nova. Личные и групповые чаты, звонки, фото, видео и голосовые сообщения.";
const OG_IMAGE = "https://cdn.poehali.dev/projects/***/bucket/chat/0/image/1785736718.jpg";

const SPLASH_CSS = `html, body { background: #0a0a0f; }
      #nova-splash {
        position: fixed; inset: 0; z-index: 2147483000;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px;
        background: radial-gradient(120% 80% at 50% 35%, #2a1450 0%, #120a24 45%, #0a0a0f 100%);
        transition: opacity .45s ease, visibility .45s ease;
        -webkit-user-select: none; user-select: none;
      }
      #nova-splash.hide { opacity: 0; visibility: hidden; }
      #nova-splash .ns-logo-wrap { position: relative; width: 112px; height: 112px; }
      #nova-splash .ns-glow {
        position: absolute; inset: -28px; border-radius: 50%;
        background: radial-gradient(circle, rgba(124,58,237,.55) 0%, rgba(236,72,153,.25) 45%, transparent 70%);
        filter: blur(6px); animation: ns-pulse 2.2s ease-in-out infinite;
      }
      #nova-splash .ns-logo {
        position: relative; width: 112px; height: 112px; border-radius: 28px;
        box-shadow: 0 18px 50px rgba(124,58,237,.45);
        animation: ns-pop .7s cubic-bezier(.2,.9,.3,1.3) both, ns-float 3s ease-in-out .7s infinite;
      }
      #nova-splash .ns-title {
        font: 700 26px/1 -apple-system, "Golos Text", system-ui, sans-serif; letter-spacing: .32em;
        color: #fff; margin-right: -.32em; animation: ns-fade .6s ease .25s both;
      }
      #nova-splash .ns-bar {
        width: 140px; height: 4px; border-radius: 4px; overflow: hidden;
        background: rgba(255,255,255,.1); animation: ns-fade .6s ease .4s both;
      }
      #nova-splash .ns-bar i {
        display: block; width: 40%; height: 100%; border-radius: 4px;
        background: linear-gradient(90deg, #ec4899, #7c3aed, #22d3ee);
        animation: ns-slide 1.2s ease-in-out infinite;
      }
      #nova-splash .ns-hint {
        position: absolute; bottom: calc(36px + env(safe-area-inset-bottom)); left: 0; right: 0; text-align: center;
        font: 500 13px -apple-system, system-ui, sans-serif; color: rgba(255,255,255,.45);
        opacity: 0; transition: opacity .4s ease;
      }
      #nova-splash.slow .ns-hint { opacity: 1; }
      @keyframes ns-pop { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes ns-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      @keyframes ns-pulse { 0%,100% { transform: scale(.9); opacity: .7; } 50% { transform: scale(1.08); opacity: 1; } }
      @keyframes ns-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      @keyframes ns-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
      @media (prefers-reduced-motion: reduce) {
        #nova-splash * { animation-duration: .01s !important; animation-iteration-count: 1 !important; }
      }`;

const RUSTORE_URL = "https://www.rustore.ru/catalog/app/ru.nova.messenger";

const NOSCRIPT_HTML = `<div style="max-width:720px;margin:0 auto;padding:24px;font-family:sans-serif;color:#111;line-height:1.6">
        <h1>Nova — мессенджер для общения</h1>
        <p>Nova — российский мессенджер для личного и группового общения. Переписка, аудио- и видеозвонки, обмен фото, видео и файлами — в одном приложении. Регистрация по номеру телефона за минуту, без пароля.</p>
        <h2>Возможности</h2>
        <ul>
            <li><strong>Личные и групповые чаты</strong> — общайтесь один на один или собирайте друзей, семью и коллег в группы.</li>
            <li><strong>Аудио- и видеозвонки</strong> — стабильная связь через Wi-Fi и мобильный интернет.</li>
            <li><strong>Голосовые сообщения и видео-кружки</strong> — когда проще сказать, чем написать.</li>
            <li><strong>Фото, видео и документы</strong> — делитесь файлами прямо в чате.</li>
            <li><strong>Истории, стикеры и реакции</strong> — живое общение с эмоциями.</li>
            <li><strong>Отложенные сообщения и избранное</strong> — отправка в нужное время и важное под рукой.</li>
            <li><strong>Приватность</strong> — данные хранятся на серверах в России, соединение защищено, аккаунт можно удалить в любой момент.</li>
            <li><strong>Nova Pro</strong> — расширенные возможности и оформление профиля.</li>
        </ul>
        <h2>Скачать Nova</h2>
        <p><a href="${RUSTORE_URL}">Скачать Nova для Android в RuStore</a> — бесплатно. Также Nova работает в браузере на <a href="https://novaa.pro/">novaa.pro</a>.</p>
        <p><a href="/privacy">Политика конфиденциальности</a> · <a href="/terms">Пользовательское соглашение</a> · <a href="/security">Безопасность</a></p>
    </div>`;

const JSON_LD = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    name: "Nova",
    description: DESCRIPTION,
    applicationCategory: "CommunicationApplication",
    operatingSystem: "Android",
    url: "https://novaa.pro/",
    downloadUrl: RUSTORE_URL,
    inLanguage: "ru",
    offers: {"@type": "Offer", price: "0", priceCurrency: "RUB"},
});

const METRIKA = `(function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments) };
    m[i].l = 1 * new Date();
    for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
    k = e.createElement(t), a = e.getElementsByTagName(t)[0], k.async = 1, k.src = r, a.parentNode.insertBefore(k, a)
})(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
ym(101026698, "init", { trustedDomains: ["poehali.dev"], clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true, trackHash: true });`;

export const Route = createRootRoute({
    head: () => ({
        meta: [
            {charSet: "utf-8"},
            {name: "viewport", content: "width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no"},
            {title: TITLE},
            {name: "description", content: DESCRIPTION},
            {name: "author", content: "poehali.dev"},
            {name: "mobile-web-app-capable", content: "yes"},
            {name: "apple-mobile-web-app-capable", content: "yes"},
            {name: "apple-mobile-web-app-status-bar-style", content: "black-translucent"},
            {name: "apple-mobile-web-app-title", content: "Nova"},
            {name: "theme-color", content: "#7c3aed"},
            {property: "og:title", content: TITLE},
            {property: "og:description", content: OG_DESCRIPTION},
            {property: "og:image", content: OG_IMAGE},
            {property: "og:image:width", content: "1200"},
            {property: "og:image:height", content: "630"},
            {name: "twitter:card", content: "summary_large_image"},
            {name: "twitter:title", content: TITLE},
            {name: "twitter:image", content: OG_IMAGE},
            ...PLATFORM_META,
        ],
        links: [
            {rel: "stylesheet", href: appCss},
            {rel: "preconnect", href: "https://fonts.googleapis.com"},
            {rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous"},
            {rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;900&display=swap"},
            {rel: "icon", type: "image/svg+xml", href: "/favicon.svg"},
            {rel: "icon", type: "image/png", href: "/favicon.png"},
            {rel: "manifest", href: "/manifest.json"},
            {rel: "apple-touch-icon", href: "/apple-touch-icon.png"},
            {rel: "icon", sizes: "192x192", href: "/app-icon-192.png"},
        ],
        styles: [{children: SPLASH_CSS}],
        // IMPORTANT: DO NOT REMOVE PLATFORM SCRIPTS AND THE DEV HMR CLIENT!
        scripts: [
            ...(import.meta.env.DEV ? [{children: HMR_CLIENT}] : []),
            ...PLATFORM_SCRIPTS,
            {children: METRIKA},
            {type: "application/ld+json", children: JSON_LD},
        ],
    }),
    component: RootComponent,
    notFoundComponent: NotFound,
});

// Системная кнопка «Назад» — закрывает модалки/идёт назад
// или выходит из приложения с подтверждением.
function NativeShell() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (native.isNative) {
            SplashScreen.hide({fadeOutDuration: 300}).catch(() => { /* ignore */ });
            native.statusBar.setColor("#0a0814");
            native.statusBar.setDark();
        }
    }, []);

    useEffect(() => {
        const off = native.app.onBackButton(async () => {
            if (window.history.length > 1 && location.pathname !== "/") {
                navigate(-1);
                return;
            }
            const ok = await native.dialog.confirm("Выйти из Nova?", "Подтвердите");
            if (ok) native.app.exit();
        });
        return off;
    }, [navigate, location.pathname]);

    return null;
}

// Android WebView передаёт lang страницы клавиатуре как «подсказку языка» —
// убираем подсказку у всех полей ввода.
const clearLangHint = (el: EventTarget | null) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) {
        if (el.getAttribute("lang") !== "") el.setAttribute("lang", "");
    }
};

function useBrowserBoot() {
    useEffect(() => {
        applyTheme(getStoredTheme(), getStoredFontSize());
        const accent = getStoredAccentHex();
        if (accent) applyAccent(accent);
        applyBubbleStyle(getStoredBubbleStyle());
        startAutoTheme(getStoredAutoConfig());

        const onPointer = (e: Event) => clearLangHint(e.target);
        document.addEventListener("pointerdown", onPointer, true);
        document.addEventListener("focusin", onPointer, true);

        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/sw.js", {updateViaCache: "none"})
                .then((reg) => reg.update())
                .catch(() => {});
        }
        return () => {
            document.removeEventListener("pointerdown", onPointer, true);
            document.removeEventListener("focusin", onPointer, true);
        };
    }, []);
}

function Splash() {
    const [phase, setPhase] = useState<"show" | "hide" | "gone">("show");
    useEffect(() => {
        const t1 = setTimeout(() => setPhase("hide"), 600);
        const t2 = setTimeout(() => setPhase("gone"), 1100);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, []);
    if (phase === "gone") return null;
    return (
        <div id="nova-splash" className={phase === "hide" ? "hide" : undefined} aria-label="Nova загружается" role="status">
            <div className="ns-logo-wrap">
                <div className="ns-glow"/>
                <img className="ns-logo" src="/splash-logo.webp" alt="Nova" width={112} height={112} decoding="async" fetchPriority="high"/>
            </div>
            <div className="ns-title">NOVA</div>
            <div className="ns-bar"><i/></div>
        </div>
    );
}

function RootComponent() {
    const [queryClient] = useState(() => new QueryClient());
    useBrowserBoot();
    return (
        <RootDocument>
            <Splash/>
            <ErrorBoundary>
                <QueryClientProvider client={queryClient}>
                    <TooltipProvider>
                        <Toaster/>
                        <Sonner/>
                        <NativeShell/>
                        <Outlet/>
                    </TooltipProvider>
                </QueryClientProvider>
            </ErrorBoundary>
        </RootDocument>
    );
}

function RootDocument({children}: { children: ReactNode }) {
    return (
        <html lang="ru-RU" style={{background: "#0a0a0f"}} suppressHydrationWarning>
        <head>
            <HeadContent/>
        </head>
        <body>
        {children}
        <noscript dangerouslySetInnerHTML={{__html: NOSCRIPT_HTML}}/>
        <noscript>
            <div><img src="https://mc.yandex.ru/watch/101026698" style={{position: "absolute", left: "-9999px"}} alt=""/></div>
        </noscript>
        <Scripts/>
        </body>
        </html>
    );
}