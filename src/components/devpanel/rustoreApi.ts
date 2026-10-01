import { getDevToken } from "@/lib/devApi";

const RUSTORE_API = "https://functions.poehali.dev/bcebea14-cbd9-4e61-9b8d-00999c5a501a";

export interface Rating {
  average: number;
  total: number;
  without_reply: number;
  no_comment: number;
  stars: Record<"1" | "2" | "3" | "4" | "5", number>;
  error?: string;
}

export interface Screen {
  id: number;
  url: string;
  orientation: "PORTRAIT" | "LANDSCAPE";
  ordinal: number;
  width: number;
  height: number;
}

export interface StoreScreen {
  id: number;
  url: string;
  ordinal: number;
  orientation: string;
}

export interface Reply {
  id: number | null;
  text: string;
  status: string;
  status_ru: string;
  date?: string | null;
}

export interface Review {
  id: number;
  user: string;
  rating: number;
  text: string;
  date?: string | null;
  version?: string | null;
  edited: boolean;
  likes: number;
  dislikes: number;
  device?: string | null;
  os?: string | null;
  reply: Reply | null;
}

export async function rustoreCall<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(RUSTORE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Dev-Token": getDevToken() },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error("Нет связи с сервером — проверьте интернет и попробуйте ещё раз");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 504 || (res.status === 502 && !(data as { error?: string }).error)) {
      throw new Error("Сервер не успел ответить. Увеличьте таймаут функции rustore-publish до 120 секунд");
    }
    throw new Error((data as { error?: string }).error || `Ошибка запроса (${res.status})`);
  }
  return data as T;
}

export function fmtDate(s?: string | null) {
  if (!s) return "";
  const d = new Date(String(s).replace(" ", "T"));
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ru", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}