export type BirthdayCardId = "balloons" | "cake" | "confetti" | "stars";

export interface BirthdayCard {
  id: BirthdayCardId;
  emoji: string;
  title: string;
  wish: string;
  gradient: string;
}

export const BIRTHDAY_CARDS: BirthdayCard[] = [
  { id: "balloons", emoji: "🎈", title: "С днём рождения!", wish: "Пусть этот год будет лёгким, ярким и счастливым!", gradient: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)" },
  { id: "cake", emoji: "🎂", title: "С праздником!", wish: "Желаю здоровья, любви и исполнения всех желаний!", gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" },
  { id: "confetti", emoji: "🎉", title: "Поздравляю!", wish: "Пусть каждый день приносит повод для улыбки!", gradient: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)" },
  { id: "stars", emoji: "✨", title: "Happy Birthday!", wish: "Мечтай смело — всё обязательно сбудется!", gradient: "linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)" },
];

export const GIFT_AMOUNTS = [0, 10, 50, 100] as const;

export const cardById = (id?: string) => BIRTHDAY_CARDS.find(c => c.id === id) || BIRTHDAY_CARDS[0];

export interface BirthdayPayload {
  card: BirthdayCardId;
  quantity: number;
  message?: string;
}
