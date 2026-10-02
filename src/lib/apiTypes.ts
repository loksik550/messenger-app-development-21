export type View = "chats" | "stories" | "search" | "profile" | "settings" | "contacts";

export interface Contact {
  id: number;
  name: string;
  real_name: string;
  phone: string;
  avatar_url?: string;
  last_seen?: number;
}
export type Tab = "chats" | "stories" | "contacts";
export type IconName = string;

export interface Reaction {
  emoji: string;
  user_name: string;
  user_id: number;
}

export interface GiftPayload {
  quantity: number;
  message?: string;
}
export interface FundraiserPayload {
  fundraiser_id: number;
  title: string;
  target_amount: number;
  collected_amount: number;
  cover_url?: string | null;
}
export interface StickerPayload {
  pack_id: number;
  sticker_id: number;
  image_url: string;
  emoji?: string;
}

export interface ReplyPreview {
  id: number;
  sender_name: string;
  text: string;
  media_type?: string;
}

export interface Message {
  id: number;
  text: string;
  time: string;
  out: boolean;
  read?: boolean;
  sender_id?: number;
  sender_name?: string;
  kind?: "text" | "missed_call" | "system" | "gift" | "fundraiser" | "sticker" | "bot_message" | "story_reply";
  payload?: GiftPayload | FundraiserPayload | StickerPayload
    | { buttons?: { text: string; callback_data?: string | null; url?: string | null }[][] }
    | { story_id?: number; story_media_url?: string; story_caption?: string | null; story_author_id?: number }
    | null;
  created_at?: number;
  image_url?: string;
  media_type?: "image" | "video" | "audio" | "file";
  media_url?: string;
  file_name?: string;
  file_size?: number;
  duration?: number;
  reactions?: Reaction[];
  reply_to?: ReplyPreview | null;
  forwarded_from_user_id?: number | null;
  forwarded_from_name?: string | null;
  edited_at?: number | null;
  expires_at?: number | null;
  pending?: boolean;
  failed?: boolean;
}

export interface Chat {
  id: number;
  name: string;
  saved?: boolean;
  avatar: string;
  avatar_url?: string | null;
  lastMsg: string;
  time: string;
  unread?: number;
  online?: boolean;
  typing?: boolean;
  verified?: boolean;
  group?: boolean;
  pinned?: boolean;
  muted?: boolean;
  favorite?: boolean;
  archived?: boolean;
  partner_id?: number;
  lastSeen?: number;
}

// "был в сети N назад" / "в сети" по unix-времени last_seen

export interface User {
  id: number;
  phone: string;
  name: string;
  avatar_url?: string;
  last_seen?: number;
  about?: string | null;
  gender?: "male" | "female" | null;
  birthdate?: string | null;
  wallet_balance?: number;
  pro_until?: number | null;
  is_pro?: boolean;
  emoji_status?: string | null;
  name_color?: string | null;
  incognito?: boolean;
  who_can_message?: "everyone" | "contacts" | "nobody";
  who_can_call?: "everyone" | "contacts" | "nobody";
  lightning_balance?: number;
  pro_trial_used?: boolean;
  stickers_subscription_until?: number | null;
  xp?: number;
  level?: number;
  daily_streak?: number;
  // Безопасность и приватность
  app_lock_enabled?: boolean;
  read_receipts_enabled?: boolean;
  last_seen_visibility?: "everyone" | "contacts" | "nobody";
  profile_photo_visibility?: "everyone" | "contacts" | "nobody";
  phone_visibility?: "everyone" | "contacts" | "nobody";
  // Темы и кастомизация
  theme_id?: string;
  accent_color?: string;
  chat_wallpaper?: string | null;
  bubble_style?: string;
  font_size?: number;
  verified?: boolean;
  verified_kind?: string;
  // Уведомления
  notify_messages?: boolean;
  notify_groups?: boolean;
  notify_calls?: boolean;
  notify_sound?: string;
  notify_vibration?: boolean;
  quiet_hours_from?: number | null;
  quiet_hours_to?: number | null;
  // Соц-механики
  status_text?: string | null;
  status_until?: number | null;
  friends_count?: number;
}

export interface BadgeInfo {
  code: string;
  title: string;
  icon: string;
  desc: string;
  earned: boolean;
  earned_at: number | null;
}

export interface UserProgress {
  user: { id: number; name: string; avatar_url?: string | null };
  xp: number;
  level: number;
  xp_for_current_level: number;
  xp_for_next_level: number;
  progress_pct: number;
  daily_streak: number;
  badges: BadgeInfo[];
  events: { amount: number; reason: string; created_at: number }[];
}

export interface LeaderboardItem {
  id: number;
  name: string;
  avatar_url?: string | null;
  xp: number;
  level: number;
  rank: number;
}

export interface LightningTx {
  id: number;
  amount: number;
  kind: string;
  description: string;
  related_user_id?: number | null;
  balance_after: number;
  created_at: number;
}

export interface StickerPack {
  id: number;
  author_id?: number | null;
  title: string;
  description: string;
  cover_url?: string | null;
  price: number;
  is_premium: boolean;
  total_sales: number;
  created_at: number;
  owned?: boolean;
  items?: { id: number; emoji: string; image_url: string; position: number }[];
}

export interface Fundraiser {
  id: number;
  owner_id: number;
  owner_name: string;
  owner_avatar?: string | null;
  title: string;
  description: string;
  cover_url?: string | null;
  target_amount: number;
  collected_amount: number;
  status: "active" | "closed";
  created_at: number;
  closed_at?: number | null;
  donations: {
    id: number;
    donor_id?: number | null;
    donor_name: string;
    amount: number;
    message: string;
    created_at: number;
  }[];
}

export interface WalletTransaction {
  id: number;
  amount: number;
  kind: string;
  description: string;
  balance_after: number;
  created_at: number;
}

export interface Group {
  id: number;
  name: string;
  created_at?: number;
  description?: string;
  avatar_url?: string | null;
  owner_id: number;
  is_channel: boolean;
  invite_link?: string;
  last_message?: string;
  last_message_at?: number;
  members_count?: number;
  unread_count?: number;
}

export interface GroupMember {
  id: number;
  name: string;
  avatar_url?: string | null;
  last_seen?: number;
  role: "owner" | "admin" | "member" | "removed";
  joined_at: number;
}

export interface GroupMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_avatar?: string | null;
  text: string;
  media_type?: "image" | "video" | "audio" | "file" | null;
  media_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  duration?: number | null;
  reply_to_id?: number | null;
  created_at: number;
  edited_at?: number | null;
  kind?: string;
  out: boolean;
  time?: string;
  read?: boolean;
  reactions?: Reaction[];
  pending?: boolean;
  failed?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
