import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Применяем сохранённую тему до рендера, чтобы не было «вспышки» дефолтной
import { applyTheme, getStoredTheme, getStoredFontSize, applyAccent, getStoredAccentHex, startAutoTheme, getStoredAutoConfig, applyBubbleStyle, getStoredBubbleStyle } from "@/lib/theme";
applyTheme(getStoredTheme(), getStoredFontSize());
const _accent = getStoredAccentHex();
if (_accent) applyAccent(_accent);
applyBubbleStyle(getStoredBubbleStyle());
startAutoTheme(getStoredAutoConfig());

// Android WebView передаёт lang страницы клавиатуре как «подсказку языка»,
// и клавиатуры (Gboard, Xiaomi) принудительно возвращают русскую раскладку.
// Убираем подсказку у всех полей ввода — пользователь сам выбирает раскладку.
const clearLangHint = (el: EventTarget | null) => {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) {
    if (el.getAttribute("lang") !== "") el.setAttribute("lang", "");
  }
};
document.addEventListener("pointerdown", (e) => clearLangHint(e.target), true);
document.addEventListener("focusin", (e) => clearLangHint(e.target), true);

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => reg.update())
      .catch(() => {});
  });
}