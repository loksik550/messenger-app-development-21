import * as React from 'react';
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

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}