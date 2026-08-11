const DEV_API = "https://functions.poehali.dev/5857e852-e31f-4ac8-8426-2b483f4d2de7";

const TOKEN_KEY = "nova_dev_token";

export interface DevAdmin {
  id: number;
  email: string;
  name: string;
  role: string;
  title?: string;
  role_label?: string;
}

export function getDevToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setDevToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearDevToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function devApi<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(DEV_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dev-Token": getDevToken(),
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && action !== "login" && action !== "register") {
    clearDevToken();
    throw new Error("Сессия истекла, войдите заново");
  }
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Ошибка запроса");
  }
  return data as T;
}

export function formatTs(ts?: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("ru", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNum(n: number): string {
  return n.toLocaleString("ru");
}

export function timeAgo(ts?: number | null): string {
  if (!ts) return "никогда";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} дн назад`;
}
