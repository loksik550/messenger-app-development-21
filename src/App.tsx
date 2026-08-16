import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { SplashScreen } from "@capacitor/splash-screen";
import { native } from "@/lib/native";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Download from "./pages/Download";
import Privacy from "./pages/Privacy";
import Security from "./pages/Security";
import DevPanel from "@/pages/DevPanel";
import Shots from "./pages/Shots";
import Banner from "./pages/Banner";
import StoreAssets from "./pages/StoreAssets";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

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
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/download" element={<Download />} />
          <Route path="/install" element={<Download />} />
          <Route path="/app" element={<Download />} />
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
      </BrowserRouter>
    </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;