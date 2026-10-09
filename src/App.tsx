import { useEffect, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { SplashScreen } from "@capacitor/splash-screen";
import { native } from "@/lib/native";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const Security = lazyWithRetry(() => import("./pages/Security"));
const DevPanel = lazyWithRetry(() => import("@/pages/DevPanel"));
const Shots = lazyWithRetry(() => import("./pages/Shots"));
const Banner = lazyWithRetry(() => import("./pages/Banner"));
const StoreAssets = lazyWithRetry(() => import("./pages/StoreAssets"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Внутри роутера: системная кнопка «Назад» — закрывает модалки/идёт назад
// или выходит из приложения с подтверждением.
function NativeShell() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Прячем нативный сплеш сразу после маунта
    if (native.isNative) {
      SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => { /* ignore */ });
      native.statusBar.setColor("#0a0814");
      native.statusBar.setDark();
    }
  }, []);

  useEffect(() => {
    const off = native.app.onBackButton(async () => {
      // Если можно идти назад в истории — идём
      if (window.history.length > 1 && location.pathname !== "/") {
        navigate(-1);
        return;
      }
      // На главной — подтверждение выхода
      const ok = await native.dialog.confirm("Выйти из Nova?", "Подтвердите");
      if (ok) native.app.exit();
    });
    return off;
  }, [navigate, location.pathname]);

  return null;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <NativeShell />
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/privacy-policy" element={<Privacy />} />
          <Route path="/politika-konfidencialnosti" element={<Privacy />} />
          <Route path="/security" element={<Security />} />
          <Route path="/dev" element={<DevPanel />} />
          <Route path="/shots" element={<Shots />} />
          <Route path="/banner" element={<Banner />} />
          <Route path="/store-assets" element={<StoreAssets />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/terms-of-service" element={<Terms />} />
          <Route path="/polzovatelskoe-soglashenie" element={<Terms />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;