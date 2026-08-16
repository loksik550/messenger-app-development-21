// Простой i18n без зависимостей. Переключаемся между ru/en.
// Используется через хук useT() и компонент LanguageSwitcher.

export type Lang = "ru" | "en";

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

const STORAGE_KEY = "nova_lang";

const dict: Record<Lang, Record<string, string>> = {
  ru: {
    // Общее
    "common.cancel": "Отмена",
    "common.save": "Сохранить",
    "common.delete": "Удалить",
    "common.confirm": "Подтвердить",
    "common.back": "Назад",
    "common.search": "Поиск",
    "common.close": "Закрыть",
    "common.loading": "Загрузка...",
    "common.error": "Ошибка",
    "common.success": "Готово",
    "common.online": "В сети",
    "common.offline": "Не в сети",
    "common.recently": "был(а) недавно",
    "common.typing": "печатает сообщение...",
    // Навигация
    "nav.chats": "Чаты",
    "nav.stories": "Истории",
    "nav.contacts": "Контакты",
    "nav.search": "Поиск",
    "nav.profile": "Профиль",
    "nav.settings": "Настройки",
    "nav.language": "Язык",
    "nav.support": "Поддержка",
    "nav.bots": "Боты",
    "nav.wallet": "Кошелёк",
    "nav.pro": "Nova Pro",
    "nav.appearance": "Оформление",
    "nav.privacy": "Приватность",
    "nav.notifications": "Уведомления",
    "nav.saved": "Избранное",
    "nav.payments": "Платежи",
    "nav.progress": "Прокачка",
    // Чат
    "chat.message": "Сообщение...",
    "chat.send": "Отправить",
    "chat.reply": "Ответить",
    "chat.forward": "Переслать",
    "chat.edit": "Изменить",
    "chat.copy": "Копировать",
    "chat.pin": "Закрепить",
    "chat.unpin": "Открепить",
    "chat.deleteMsg": "Удалить сообщение",
    "chat.searchInChat": "Поиск по чату",
    "chat.muteOn": "Включить уведомления",
    "chat.muteOff": "Отключить уведомления",
    "chat.favoriteOn": "В избранное",
    "chat.favoriteOff": "Убрать из избранного",
    "chat.archiveOn": "В архив",
    "chat.archiveOff": "Из архива",
    "chat.clearHistory": "Очистить историю",
    "chat.block": "Заблокировать",
    "chat.disappearing": "Исчезающие сообщения",
    "chat.wallpaper": "Обои чата",
    "chat.groupBadge": "группа",
    // Профиль собеседника
    "partner.title": "Профиль",
    "partner.online": "в сети",
    "partner.recently": "был(а) недавно",
    "partner.call": "Звонок",
    "partner.video": "Видео",
    "partner.mute": "Без звука",
    "partner.unmute": "Вкл. звук",
    "partner.search": "Поиск",
    "partner.pin": "Закрепить чат",
    "partner.unpin": "Открепить чат",
    "partner.favoriteOn": "В избранное",
    "partner.favoriteOff": "Убрать из избранного",
    "partner.archiveOn": "В архив",
    "partner.archiveOff": "Из архива",
    "partner.wallpaper": "Обои чата",
    "partner.disappearing": "Исчезающие сообщения",
    "partner.clearHistory": "Очистить историю",
    "partner.block": "Заблокировать",
    "partner.report": "Пожаловаться",
    // Жалоба
    "report.title": "Пожаловаться",
    "report.subtitle": "Выберите причину жалобы. Мы рассмотрим её.",
    "report.reason.spam": "Спам",
    "report.reason.abuse": "Оскорбления",
    "report.reason.scam": "Мошенничество",
    "report.reason.violence": "Насилие",
    "report.reason.porn": "Порнография",
    "report.reason.other": "Другое",
    "report.commentPlaceholder": "Комментарий (необязательно)",
    "report.submit": "Отправить жалобу",
    "report.sent": "Жалоба отправлена",
    "report.cancel": "Отмена",
    "report.off": "Выкл",
    // Группа
    "group.new": "Новая группа",
    "group.newChannel": "Новый канал",
    "group.name": "Название группы",
    "group.channelName": "Название канала",
    "group.description": "Описание группы (необязательно)",
    "group.descriptionChannel": "Описание канала (необязательно)",
    "group.create": "Создать группу",
    "group.createChannel": "Создать канал",
    "group.next": "Далее",
    "group.addMembers": "Добавить участников",
    "group.searchByName": "Поиск по имени...",
    "group.usersNotFound": "Пользователи не найдены",
    "group.selected": "Выбрано:",
    // Профиль
    "profile.about": "Расскажи о себе — это увидят твои контакты",
    "profile.editProfile": "Редактировать профиль",
    "profile.invite": "Пригласить друзей",
    "profile.inviteText": "Поделитесь ссылкой — друг скачает Nova и вы сразу найдёте друг друга",
    "profile.shareLink": "Поделиться ссылкой",
    "profile.logout": "Выйти из аккаунта",
    "profile.security": "Безопасность",
    "profile.contacts": "Контакты",
    "profile.level": "Уровень",
    // Поиск
    "search.placeholder": "Имя, номер, группа...",
    "search.empty": "Ничего не найдено",
    "search.allUsers": "Все пользователи",
    "search.bots": "Боты",
    "search.addContact": "Добавить контакт",
    // Темы
    "appearance.title": "Оформление",
    "appearance.subtitle": "Тема и шрифт интерфейса",
    "appearance.theme": "Тема",
    "appearance.fontSize": "Размер шрифта",
    "appearance.savedLocally": "Настройки сохраняются на этом устройстве",
    // Premium
    "premium.title": "Nova Premium",
    "premium.subtitle": "Эксклюзивные возможности для подписчиков",
    "premium.subscribe": "Оформить подписку",
    "premium.feature1": "Эксклюзивные истории",
    "premium.feature1Desc": "Бэкстейджи, ранние анонсы, личные мысли",
    "premium.feature2": "Кастомные эмодзи",
    "premium.feature2Desc": "Фирменные стикеры с логотипом или персонажами",
    "premium.feature3": "Уникальные реакции",
    "premium.feature3Desc": "Замените стандартные эмодзи на тематические",
    "premium.feature4": "Приоритетные ответы",
    "premium.feature4Desc": "Ваши комментарии будут выделяться",
    "premium.feature5": "Специальные чаты",
    "premium.feature5Desc": "Закрытый клуб для Premium-подписчиков",
  },
  en: {
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.confirm": "Confirm",
    "common.back": "Back",
    "common.search": "Search",
    "common.close": "Close",
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.success": "Done",
    "common.online": "Online",
    "common.offline": "Offline",
    "common.recently": "last seen recently",
    "common.typing": "is typing...",
    "nav.chats": "Chats",
    "nav.stories": "Stories",
    "nav.contacts": "Contacts",
    "nav.search": "Search",
    "nav.profile": "Profile",
    "nav.settings": "Settings",
    "nav.language": "Language",
    "nav.support": "Support",
    "nav.bots": "Bots",
    "nav.wallet": "Wallet",
    "nav.pro": "Nova Pro",
    "nav.appearance": "Appearance",
    "nav.privacy": "Privacy",
    "nav.notifications": "Notifications",
    "nav.saved": "Saved",
    "nav.payments": "Payments",
    "nav.progress": "Progress",
    "chat.message": "Message...",
    "chat.send": "Send",
    "chat.reply": "Reply",
    "chat.forward": "Forward",
    "chat.edit": "Edit",
    "chat.copy": "Copy",
    "chat.pin": "Pin",
    "chat.unpin": "Unpin",
    "chat.deleteMsg": "Delete message",
    "chat.searchInChat": "Search in chat",
    "chat.muteOn": "Unmute",
    "chat.muteOff": "Mute",
    "chat.favoriteOn": "Add to favorites",
    "chat.favoriteOff": "Remove from favorites",
    "chat.archiveOn": "Archive",
    "chat.archiveOff": "Unarchive",
    "chat.clearHistory": "Clear history",
    "chat.block": "Block",
    "chat.disappearing": "Disappearing messages",
    "chat.wallpaper": "Chat wallpaper",
    "chat.groupBadge": "group",
    "partner.title": "Profile",
    "partner.online": "online",
    "partner.recently": "last seen recently",
    "partner.call": "Call",
    "partner.video": "Video",
    "partner.mute": "Mute",
    "partner.unmute": "Unmute",
    "partner.search": "Search",
    "partner.pin": "Pin chat",
    "partner.unpin": "Unpin chat",
    "partner.favoriteOn": "Add to favorites",
    "partner.favoriteOff": "Remove from favorites",
    "partner.archiveOn": "Archive",
    "partner.archiveOff": "Unarchive",
    "partner.wallpaper": "Chat wallpaper",
    "partner.disappearing": "Disappearing messages",
    "partner.clearHistory": "Clear history",
    "partner.block": "Block",
    "partner.report": "Report",
    "report.title": "Report",
    "report.subtitle": "Select a reason for your report. We will review it.",
    "report.reason.spam": "Spam",
    "report.reason.abuse": "Abuse",
    "report.reason.scam": "Scam",
    "report.reason.violence": "Violence",
    "report.reason.porn": "Pornography",
    "report.reason.other": "Other",
    "report.commentPlaceholder": "Comment (optional)",
    "report.submit": "Submit report",
    "report.sent": "Report sent",
    "report.cancel": "Cancel",
    "report.off": "Off",
    "group.new": "New group",
    "group.newChannel": "New channel",
    "group.name": "Group name",
    "group.channelName": "Channel name",
    "group.description": "Group description (optional)",
    "group.descriptionChannel": "Channel description (optional)",
    "group.create": "Create group",
    "group.createChannel": "Create channel",
    "group.next": "Next",
    "group.addMembers": "Add members",
    "group.searchByName": "Search by name...",
    "group.usersNotFound": "Users not found",
    "group.selected": "Selected:",
    "profile.about": "Write about yourself — your contacts will see this",
    "profile.editProfile": "Edit profile",
    "profile.invite": "Invite friends",
    "profile.inviteText": "Share the link — your friend gets Nova and you connect right away",
    "profile.shareLink": "Share link",
    "profile.logout": "Log out",
    "profile.security": "Security",
    "profile.contacts": "Contacts",
    "profile.level": "Level",
    "search.placeholder": "Name, phone, group...",
    "search.empty": "Nothing found",
    "search.allUsers": "All users",
    "search.bots": "Bots",
    "search.addContact": "Add contact",
    "appearance.title": "Appearance",
    "appearance.subtitle": "Theme and font size",
    "appearance.theme": "Theme",
    "appearance.fontSize": "Font size",
    "appearance.savedLocally": "Settings are saved on this device",
    "premium.title": "Nova Premium",
    "premium.subtitle": "Exclusive features for subscribers",
    "premium.subscribe": "Subscribe",
    "premium.feature1": "Exclusive stories",
    "premium.feature1Desc": "Backstage, early announcements, personal notes",
    "premium.feature2": "Custom emoji",
    "premium.feature2Desc": "Branded stickers with logos or characters",
    "premium.feature3": "Unique reactions",
    "premium.feature3Desc": "Replace standard emoji with themed ones",
    "premium.feature4": "Priority replies",
    "premium.feature4Desc": "Your comments stand out",
    "premium.feature5": "Special chats",
    "premium.feature5Desc": "Private club for Premium subscribers",
  },
};

let currentLang: Lang = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "ru" || saved === "en") return saved;
  } catch { /* ignore */ }
  // По умолчанию русский — основная аудитория приложения.
  // Английский включается сам, если устройство не русскоязычное.
  try {
    const sys = (navigator.languages?.[0] || navigator.language || "").toLowerCase();
    if (sys && !sys.startsWith("ru") && !sys.startsWith("be") && !sys.startsWith("uk")
        && !sys.startsWith("kk") && !sys.startsWith("ky")) {
      return "en";
    }
  } catch { /* ignore */ }
  return "ru";
})();

const listeners = new Set<() => void>();

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang) {
  if (currentLang === lang) return;
  currentLang = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  listeners.forEach(l => l());
}

export function t(key: string, lang?: Lang): string {
  const l = lang || currentLang;
  return dict[l][key] ?? dict.ru[key] ?? key;
}

export function subscribeLang(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}