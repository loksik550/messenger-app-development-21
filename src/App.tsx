import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { SplashScreen } from "@capacitor/splash-screen";
import { native } from "@/lib/native";
import Index from "./pages/Index";
import Download from "./pages/Download";
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;