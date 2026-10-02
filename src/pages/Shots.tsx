import { useEffect } from "react";
import { Screen } from "@/pages/shots/ShotsAtoms";
import { ChatsScreen } from "@/pages/shots/ChatsScreen";
import { ProfileScreen } from "@/pages/shots/ProfileScreen";
import { SecurityScreen } from "@/pages/shots/SecurityScreen";
import { CallsScreen } from "@/pages/shots/CallsScreen";

/**
 * Страница-макет для скриншотов в магазин приложений.
 * Показывает настоящие экраны Nova с нейтральными демо-данными:
 * без личных телефонов, без чужих фото и без посторонних элементов.
 * Открывается по адресу /shots — только для съёмки, в меню её нет.
 */

export default function Shots() {
  useEffect(() => {
    document.title = "Nova — экраны";
  }, []);

  return (
    <div className="bg-[#07080f] min-h-screen">
      <Screen><ChatsScreen /></Screen>
      <Screen><ProfileScreen /></Screen>
      <Screen><SecurityScreen /></Screen>
      <Screen><CallsScreen /></Screen>
    </div>
  );
}
