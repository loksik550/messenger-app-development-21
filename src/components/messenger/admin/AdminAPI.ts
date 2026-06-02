// Утилиты, типы и константы админ-панели Nova.

export const ADMIN_URL = "https://functions.poehali.dev/74374a22-83da-4771-855b-1716418e719b";

export async function adminApi(
  action: string,
  body: Record<string, unknown> = {},
  token: string,
): Promise<Record<string, unknown> & { error?: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(ADMIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      body: JSON.stringify({ action, ...body }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (e) {
    return { error: (e as Error).message || "Сетевая ошибка" };
  }
}

export interface Stats {
  users: {
    total: number; online: number; new_24h: number;
    dau?: number; wau?: number; mau?: number; stickiness?: number;
  };
  messages: { total: number; last_1h: number; last_24h: number; per_min: number };
  chats: number;
  push_subs: number;
  calls_1h: number;
  load: { level: string; tip: string; msg_per_min: number };
}

export interface ActivityDay {
  date: string;
  active: number;
  messages: number;
  new_users: number;
}

export interface SupportTicket {
  id: number;
  user_id: number;
  user_name: string;
  user_phone: string;
  user_avatar?: string | null;
  subject: string;
  status: "open" | "closed";
  created_at: number;
  last_message_at: number;
  unread: number;
  last_text: string;
}

export interface SupportMsg {
  id: number;
  sender_id: number | null;
  is_admin: boolean;
  text: string;
  created_at: number;
}

export interface AdminUser {
  id: number; phone: string; name: string; last_seen: number; created_at: number;
  online: boolean; avatar_url?: string | null;
  msg_count?: number; chat_count?: number; contacts_count?: number;
  active_stories?: number; push_subscriptions?: number;
  blocks_out?: number; blocks_in?: number;
  about?: string | null; gender?: string | null; birthdate?: string | null;
  wallet_balance?: number; pro_until?: number | null; is_pro?: boolean;
  emoji_status?: string | null; name_color?: string | null; incognito?: boolean;
  who_can_message?: string; who_can_call?: string;
  lightning_balance?: number; pro_trial_used?: boolean;
  stickers_subscription_until?: number | null;
  xp?: number; level?: number; daily_streak?: number;
  is_bot?: boolean; bot_owner_id?: number | null;
  bot_username?: string | null; bot_description?: string | null; bot_webhook_url?: string | null;
  last_message_at?: number | null;
  owned_bots?: { id: number; name: string; username: string }[];
}

export interface Report {
  id: number;
  reporter_id: number;
  reporter_name: string | null;
  reporter_phone: string | null;
  reported_user_id: number;
  reported_name: string | null;
  reported_phone: string | null;
  reported_avatar?: string | null;
  chat_id: number | null;
  reason: string;
  comment: string | null;
  status: "open" | "resolved";
  created_at: number;
}

export const REASON_LABEL: Record<string, string> = {
  spam: "Спам",
  abuse: "Оскорбления",
  scam: "Мошенничество",
  violence: "Насилие",
  porn: "Порнография",
  other: "Другое",
};

export const LOAD_COLOR: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-400",
  high: "text-red-400",
};

export const LOAD_BG: Record<string, string> = {
  low: "bg-emerald-500/10 border-emerald-500/20",
  medium: "bg-amber-500/10 border-amber-500/20",
  high: "bg-red-500/10 border-red-500/20",
};

export const LOAD_LABEL: Record<string, string> = {
  low: "низкая", medium: "средняя", high: "высокая",
};

export const fmtDate = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("ru", { day: "2-digit", month: "short", year: "numeric" });

export const fmtTime = (ts: number) => {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return fmtDate(ts);
};