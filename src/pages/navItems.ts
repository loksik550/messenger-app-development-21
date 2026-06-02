import { type View } from "@/lib/api";

export interface NavItem {
  tab: View;
  icon: string;
  labelKey: string;
}

// Нижняя навигация. Тексты — через i18n ключи (см. src/lib/i18n.ts).
export const NAV_ITEMS: NavItem[] = [
  { tab: "chats", icon: "MessageCircle", labelKey: "nav.chats" },
  { tab: "contacts", icon: "BookUser", labelKey: "nav.contacts" },
  { tab: "search", icon: "Search", labelKey: "nav.search" },
  { tab: "profile", icon: "User", labelKey: "nav.profile" },
  { tab: "settings", icon: "Shield", labelKey: "profile.security" },
];
