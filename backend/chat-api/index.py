import os
import json
import time
import urllib.request
import threading
import psycopg2


def _fire_and_forget_http(url: str, body: bytes, timeout: float = 3.0) -> None:
    """Отправить HTTP POST в фоне, не блокируя ответ клиенту."""
    def _run():
        try:
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=timeout)
        except Exception:
            pass
    try:
        t = threading.Thread(target=_run, daemon=True)
        t.start()
    except Exception:
        pass

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67547116_messenger_app_develo")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Admin-Password, X-Admin-Token",
}


def get_conn():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    return conn


def ok(data):
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(msg, code=400):
    return {"statusCode": code, "headers": CORS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


USER_COLS = "id, phone, name, avatar_url, created_at, about, gender, birthdate, COALESCE(wallet_balance, 0), pro_until, emoji_status, name_color, COALESCE(incognito, FALSE), COALESCE(who_can_message, 'everyone'), COALESCE(who_can_call, 'everyone'), COALESCE(lightning_balance, 0), COALESCE(pro_trial_used, FALSE), stickers_subscription_until, COALESCE(xp, 0), COALESCE(level, 1), COALESCE(daily_streak, 0), COALESCE(theme_id, 'dark'), COALESCE(accent_color, 'violet'), chat_wallpaper, COALESCE(bubble_style, 'default'), COALESCE(font_size, 16)"


def _is_chat_member(cur, chat_id: int, user_id: int) -> bool:
    """Проверяет, что пользователь — участник приватного чата (user1 или user2)."""
    cur.execute(
        f"SELECT 1 FROM {SCHEMA}.chats WHERE id = %s AND (user1_id = %s OR user2_id = %s)",
        (chat_id, user_id, user_id),
    )
    return cur.fetchone() is not None


def serialize_user(row):
    if not row:
        return None
    return {
        "id": row[0], "phone": row[1], "name": row[2], "avatar_url": row[3],
        "created_at": row[4], "about": row[5], "gender": row[6],
        "birthdate": row[7].isoformat() if row[7] else None,
        "wallet_balance": float(row[8]) if row[8] is not None else 0,
        "pro_until": row[9],
        "is_pro": bool(row[9]) and int(row[9]) > int(time.time()),
        "emoji_status": row[10], "name_color": row[11],
        "incognito": bool(row[12]),
        "who_can_message": row[13] or "everyone",
        "who_can_call": row[14] or "everyone",
        "lightning_balance": int(row[15]) if len(row) > 15 and row[15] is not None else 0,
        "pro_trial_used": bool(row[16]) if len(row) > 16 else False,
        "stickers_subscription_until": int(row[17]) if len(row) > 17 and row[17] else None,
        "xp": int(row[18]) if len(row) > 18 and row[18] is not None else 0,
        "level": int(row[19]) if len(row) > 19 and row[19] is not None else 1,
        "daily_streak": int(row[20]) if len(row) > 20 and row[20] is not None else 0,
        "theme_id": row[21] if len(row) > 21 and row[21] else "dark",
        "accent_color": row[22] if len(row) > 22 and row[22] else "violet",
        "chat_wallpaper": row[23] if len(row) > 23 else None,
        "bubble_style": row[24] if len(row) > 24 and row[24] else "default",
        "font_size": int(row[25]) if len(row) > 25 and row[25] is not None else 16,
    }


# ─── XP / Level / Badges ────────────────────────────────────────────────────

XP_DAILY_LIMITS = {"message": 30, "received_message": 50}
XP_PER = {
    "message": 1, "received_message": 1, "first_message_in_chat": 5,
    "lightning_sent": 3, "lightning_received": 5,
    "fundraiser_created": 50, "fundraiser_donate": 10,
    "sticker_pack_buy": 20, "sticker_sent": 1,
    "pro_purchased": 200, "daily_login": 10, "registered": 25,
}
BADGES = {
    "newcomer":       {"title": "Новичок",      "icon": "Sparkles",      "desc": "Зарегистрировался в Nova"},
    "talker":         {"title": "Болтун",       "icon": "MessageCircle", "desc": "Отправил 100 сообщений"},
    "social":         {"title": "Социальный",   "icon": "Users",         "desc": "Завёл 5 чатов"},
    "generous":       {"title": "Щедрый",       "icon": "Gift",          "desc": "Подарил 100 ⚡"},
    "philanthropist": {"title": "Филантроп",    "icon": "HandHeart",     "desc": "Поддержал 3 сбора"},
    "fundraiser":     {"title": "Активист",     "icon": "Megaphone",     "desc": "Создал свой сбор"},
    "collector":      {"title": "Коллекционер", "icon": "Palette",       "desc": "Купил 3 стикерпака"},
    "pro":            {"title": "Pro-юзер",     "icon": "Crown",         "desc": "Оформил Nova Pro"},
    "veteran":        {"title": "Ветеран",      "icon": "Award",         "desc": "Достиг 10 уровня"},
    "legend":         {"title": "Легенда",      "icon": "Trophy",        "desc": "Достиг 25 уровня"},
    "streak_7":       {"title": "Неделя в Nova","icon": "Flame",         "desc": "7 дней подряд"},
    "streak_30":      {"title": "Месяц в Nova", "icon": "Star",          "desc": "30 дней подряд"},
}


def _level_from_xp(xp: int) -> int:
    if xp <= 0:
        return 1
    import math
    return int(math.floor(math.sqrt(xp / 50.0))) + 1


def _xp_for_level(level: int) -> int:
    if level <= 1:
        return 0
    return (level - 1) * (level - 1) * 50


def _award_badge(cur, user_id: int, code: str) -> bool:
    if code not in BADGES:
        return False
    cur.execute(
        f"""INSERT INTO {SCHEMA}.user_badges (user_id, badge_code, earned_at)
            VALUES (%s,%s,%s) ON CONFLICT (user_id, badge_code) DO NOTHING""",
        (user_id, code, int(time.time()))
    )
    return True


def _grant_xp(cur, user_id: int, reason: str, amount: int = None) -> dict:
    if amount is None:
        amount = XP_PER.get(reason, 0)
    if amount <= 0 or not user_id:
        return {"gained": 0}
    now = int(time.time())
    day = now // 86400
    limit = XP_DAILY_LIMITS.get(reason)
    if limit is not None:
        cur.execute(
            f"SELECT count FROM {SCHEMA}.xp_daily_counters WHERE user_id=%s AND day=%s AND reason=%s",
            (int(user_id), day, reason)
        )
        rr = cur.fetchone()
        used = int(rr[0]) if rr else 0
        if used >= limit:
            return {"gained": 0}
        cur.execute(
            f"""INSERT INTO {SCHEMA}.xp_daily_counters (user_id, day, reason, count)
                VALUES (%s,%s,%s,1)
                ON CONFLICT (user_id, day, reason) DO UPDATE SET count = {SCHEMA}.xp_daily_counters.count + 1""",
            (int(user_id), day, reason)
        )
    cur.execute(f"SELECT COALESCE(xp,0), COALESCE(level,1) FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
    r = cur.fetchone()
    if not r:
        return {"gained": 0}
    cur_xp = int(r[0] or 0); cur_level = int(r[1] or 1)
    new_xp = cur_xp + amount
    new_level = _level_from_xp(new_xp)
    cur.execute(f"UPDATE {SCHEMA}.users SET xp=%s, level=%s WHERE id=%s", (new_xp, new_level, int(user_id)))
    cur.execute(
        f"""INSERT INTO {SCHEMA}.xp_events (user_id, amount, reason, created_at)
            VALUES (%s,%s,%s,%s)""",
        (int(user_id), amount, reason, now)
    )
    leveled_up = new_level > cur_level
    if leveled_up:
        if new_level >= 10:
            _award_badge(cur, int(user_id), "veteran")
        if new_level >= 25:
            _award_badge(cur, int(user_id), "legend")
    return {"gained": amount, "leveled_up": leveled_up, "new_level": new_level, "new_xp": new_xp}


def _maybe_streak_bonus(cur, user_id: int) -> int:
    now = int(time.time())
    day = now // 86400
    cur.execute(f"SELECT COALESCE(daily_streak,0), last_active_day FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
    r = cur.fetchone()
    if not r:
        return 0
    streak = int(r[0] or 0)
    last_day = int(r[1]) if r[1] else None
    if last_day == day:
        return streak
    if last_day is not None and last_day == day - 1:
        streak += 1
    else:
        streak = 1
    cur.execute(f"UPDATE {SCHEMA}.users SET daily_streak=%s, last_active_day=%s WHERE id=%s", (streak, day, int(user_id)))
    _grant_xp(cur, int(user_id), "daily_login")
    if streak >= 7:
        _award_badge(cur, int(user_id), "streak_7")
    if streak >= 30:
        _award_badge(cur, int(user_id), "streak_30")
    return streak


def _rate_limit(cur, key: str, max_per_minute: int) -> bool:
    """True если лимит ОК (можно выполнять), False — превышен.
    Окно — фиксированное по минутам, чтобы избежать гонок."""
    now = int(time.time())
    window = now - (now % 60)
    try:
        cur.execute(
            f"""INSERT INTO {SCHEMA}.rate_limits (key, window_start, counter)
                VALUES (%s, %s, 1)
                ON CONFLICT (key) DO UPDATE SET
                    window_start = CASE WHEN {SCHEMA}.rate_limits.window_start = EXCLUDED.window_start
                                        THEN {SCHEMA}.rate_limits.window_start
                                        ELSE EXCLUDED.window_start END,
                    counter = CASE WHEN {SCHEMA}.rate_limits.window_start = EXCLUDED.window_start
                                   THEN {SCHEMA}.rate_limits.counter + 1
                                   ELSE 1 END
                RETURNING counter""",
            (key, window)
        )
        cnt = (cur.fetchone() or [0])[0]
        return cnt <= max_per_minute
    except Exception:
        return True  # при ошибке — пропускаем, не ломаем приложение


def handler(event: dict, context) -> dict:
    """
    Chat API для Nova мессенджера.
    Actions: register, get_me, get_users, get_chats, get_or_create_chat,
    get_messages, send_message, mark_read, set_typing, get_typing,
    delete_message, get_contacts, add_contact, remove_contact,
    update_profile, call_signal, get_call_signals, poll_incoming_call,
    add_reaction, get_reactions.
    """
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body = json.loads(event.get("body") or "{}")
    params = event.get("queryStringParameters") or {}
    action = body.get("action") or params.get("action", "")
    user_id = event.get("headers", {}).get("X-User-Id") or params.get("user_id")

    conn = get_conn()
    cur = conn.cursor()

    # ── register ──────────────────────────────────────────────────────────────
    if action == "register":
        phone = (body.get("phone") or "").strip()
        name = (body.get("name") or "").strip()
        if not phone or not name:
            conn.close()
            return err("Укажите phone и name")
        # Rate-limit по IP: не более 10 регистраций/минуту с одного IP
        ip = (event.get("requestContext", {}) or {}).get("identity", {}).get("sourceIp", "anon")
        if not _rate_limit(cur, f"reg:{ip}", 10):
            conn.close()
            return err("Слишком много попыток, подождите минуту", 429)

        cur.execute(f"SELECT {USER_COLS} FROM {SCHEMA}.users WHERE phone = %s", (phone,))
        existing = cur.fetchone()
        if existing:
            cur.execute(f"UPDATE {SCHEMA}.users SET last_seen = %s WHERE phone = %s", (int(time.time()), phone))
            conn.close()
            return ok({"user": serialize_user(existing), "existed": True})

        cur.execute(
            f"""INSERT INTO {SCHEMA}.users (phone, name, last_seen, created_at)
                VALUES (%s, %s, %s, %s)
                RETURNING id""",
            (phone, name, int(time.time()), int(time.time()))
        )
        new_id = cur.fetchone()[0]
        _grant_xp(cur, new_id, "registered")
        _award_badge(cur, new_id, "newcomer")
        cur.execute(f"SELECT {USER_COLS} FROM {SCHEMA}.users WHERE id=%s", (new_id,))
        row = cur.fetchone()
        conn.close()
        # Push admin'у о новой регистрации
        admin_id = os.environ.get("ADMIN_USER_ID", "").strip()
        push_url = os.environ.get("PUSH_NOTIFY_URL", "")
        if admin_id and admin_id.isdigit() and push_url and int(admin_id) != row[0]:
            try:
                push_body = json.dumps({
                    "action": "send",
                    "recipient_id": int(admin_id),
                    "title": "👤 Новая регистрация",
                    "sender_name": "Nova",
                    "message": f"{row[2]} ({row[1]}) присоединился к Nova",
                    "tag": f"reg_{row[0]}",
                }).encode("utf-8")
                req = urllib.request.Request(push_url, data=push_body, headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=5)
            except Exception:
                pass
        return ok({"user": serialize_user(row)})

    # ── get_me ────────────────────────────────────────────────────────────────
    if action == "get_me":
        phone = (body.get("phone") or params.get("phone") or "").strip()
        if not phone:
            conn.close()
            return err("Укажите phone")
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE phone = %s", (phone,))
        rid = cur.fetchone()
        if rid:
            _maybe_streak_bonus(cur, int(rid[0]))
        cur.execute(f"SELECT {USER_COLS} FROM {SCHEMA}.users WHERE phone = %s", (phone,))
        row = cur.fetchone()
        conn.close()
        if not row:
            return err("Пользователь не найден", 404)
        return ok({"user": serialize_user(row)})

    # ── get_users ─────────────────────────────────────────────────────────────
    if action == "get_users":
        query = (body.get("query") or params.get("query") or "").strip()
        exclude_id = body.get("exclude_id") or params.get("exclude_id")
        if query:
            cur.execute(
                f"SELECT id, name, phone, avatar_url, last_seen, COALESCE(incognito, FALSE), emoji_status, name_color FROM {SCHEMA}.users WHERE (name ILIKE %s OR phone LIKE %s) AND id != %s LIMIT 30",
                (f"%{query}%", f"%{query}%", exclude_id or 0)
            )
        else:
            cur.execute(
                f"SELECT id, name, phone, avatar_url, last_seen, COALESCE(incognito, FALSE), emoji_status, name_color FROM {SCHEMA}.users WHERE id != %s ORDER BY last_seen DESC LIMIT 50",
                (exclude_id or 0,)
            )
        rows = cur.fetchall()
        conn.close()
        users = [{
            "id": r[0], "name": r[1], "phone": r[2], "avatar_url": r[3],
            "last_seen": 0 if r[5] else r[4],
            "emoji_status": r[6], "name_color": r[7],
        } for r in rows]
        return ok({"users": users})

    # ── get_chats ─────────────────────────────────────────────────────────────
    if action == "get_chats":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        archived_flag = str(body.get("archived") or params.get("archived") or "").lower() in ("1", "true")
        uid = int(user_id)
        # ОДНИМ запросом: чаты + партнёры + настройки + unread + archived_count (через WINDOW)
        cur.execute(
            f"""WITH my_chats AS (
                    SELECT c.id, c.last_message, c.last_message_at,
                           (CASE WHEN c.user1_id = %s THEN c.user2_id ELSE c.user1_id END) AS partner_id
                    FROM {SCHEMA}.chats c
                    WHERE (c.user1_id = %s OR c.user2_id = %s)
                ),
                blocked AS (
                    SELECT blocked_id FROM {SCHEMA}.user_blocks WHERE blocker_id = %s
                ),
                unread AS (
                    SELECT m.chat_id, COUNT(*)::int AS cnt
                    FROM {SCHEMA}.messages m
                    LEFT JOIN {SCHEMA}.chat_settings cs2
                        ON cs2.chat_id = m.chat_id AND cs2.user_id = %s
                    WHERE m.sender_id <> %s
                      AND m.read_at IS NULL
                      AND m.created_at > COALESCE(cs2.cleared_at, 0)
                      AND m.chat_id IN (SELECT id FROM my_chats)
                    GROUP BY m.chat_id
                )
                SELECT mc.id, mc.last_message, mc.last_message_at,
                       u.id, u.name, u.phone, u.avatar_url, u.last_seen,
                       COALESCE(cs.muted, FALSE),
                       COALESCE(cs.pinned, FALSE),
                       COALESCE(cs.favorite, FALSE),
                       COALESCE(cs.cleared_at, 0),
                       COALESCE(cs.archived, FALSE),
                       COALESCE(un.cnt, 0)
                FROM my_chats mc
                JOIN {SCHEMA}.users u ON u.id = mc.partner_id
                LEFT JOIN {SCHEMA}.chat_settings cs
                    ON cs.chat_id = mc.id AND cs.user_id = %s
                LEFT JOIN unread un ON un.chat_id = mc.id
                WHERE u.id NOT IN (SELECT blocked_id FROM blocked)
                  AND COALESCE(cs.archived, FALSE) = %s
                ORDER BY COALESCE(cs.pinned, FALSE) DESC,
                         COALESCE(cs.muted, FALSE) ASC,
                         mc.last_message_at DESC NULLS LAST""",
            (uid, uid, uid, uid, uid, uid, uid, archived_flag)
        )
        rows = cur.fetchall()
        # количество архивированных (для бейджа) — отдельным быстрым запросом
        cur.execute(
            f"""SELECT COUNT(*) FROM {SCHEMA}.chat_settings cs
                JOIN {SCHEMA}.chats c ON c.id = cs.chat_id
                WHERE cs.user_id = %s AND cs.archived = TRUE
                  AND (c.user1_id = %s OR c.user2_id = %s)""",
            (uid, uid, uid)
        )
        archived_count = cur.fetchone()[0] or 0
        conn.close()

        chats = [{
            "id": r[0], "last_message": r[1], "last_message_at": r[2],
            "partner": {"id": r[3], "name": r[4], "phone": r[5], "avatar_url": r[6], "last_seen": r[7]},
            "unread": int(r[13] or 0),
            "muted": r[8], "pinned": r[9], "favorite": r[10], "cleared_at": r[11], "archived": r[12],
        } for r in rows]
        return ok({"chats": chats, "archived_count": archived_count})

    # ── get_or_create_chat ────────────────────────────────────────────────────
    if action == "get_or_create_chat":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        partner_id = body.get("partner_id")
        if not partner_id:
            conn.close()
            return err("Укажите partner_id")
        uid, pid = sorted([int(user_id), int(partner_id)])
        cur.execute(
            f"""INSERT INTO {SCHEMA}.chats (user1_id, user2_id, created_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (user1_id, user2_id) DO UPDATE SET user1_id = EXCLUDED.user1_id
                RETURNING id""",
            (uid, pid, int(time.time()))
        )
        chat_id = cur.fetchone()[0]
        conn.close()
        return ok({"chat_id": chat_id})

    # ── get_messages ──────────────────────────────────────────────────────────
    if action == "get_messages":
        chat_id = body.get("chat_id") or params.get("chat_id")
        since = body.get("since") or params.get("since") or 0
        if not chat_id:
            conn.close()
            return err("Укажите chat_id")

        now_ts = int(time.time())
        cid = int(chat_id)
        uid_int = int(user_id) if user_id else 0

        # ОДНИМ запросом: soft-remove истёкших + читаем cleared_at + получаем все сообщения
        # с реакциями (JSON), reply_to (LEFT JOIN) и removed_ids
        cur.execute(
            f"""WITH expire_upd AS (
                    UPDATE {SCHEMA}.messages
                    SET removed_at = %s
                    WHERE chat_id = %s AND expires_at IS NOT NULL
                      AND expires_at <= %s AND removed_at IS NULL
                    RETURNING id
                ),
                cleared AS (
                    SELECT COALESCE(MAX(cleared_at), 0)::bigint AS ts
                    FROM {SCHEMA}.chat_settings
                    WHERE user_id = %s AND chat_id = %s
                )
                SELECT m.id, m.sender_id, m.text, m.created_at, m.read_at, u.name,
                       m.image_url, m.media_type, m.media_url, m.file_name, m.file_size, m.duration,
                       m.reply_to_id, m.forwarded_from_user_id, m.forwarded_from_name, m.edited_at,
                       COALESCE(m.kind, 'text'), m.payload_json, m.expires_at,
                       rm.id AS reply_id, ru.name AS reply_sender_name,
                       rm.text AS reply_text, rm.media_type AS reply_media_type,
                       COALESCE(
                           (SELECT json_agg(json_build_object(
                                'emoji', mr.emoji,
                                'user_name', mu.name,
                                'user_id', mr.user_id))
                            FROM {SCHEMA}.message_reactions mr
                            JOIN {SCHEMA}.users mu ON mu.id = mr.user_id
                            WHERE mr.message_id = m.id),
                           '[]'::json) AS reactions
                FROM {SCHEMA}.messages m
                JOIN {SCHEMA}.users u ON m.sender_id = u.id
                LEFT JOIN {SCHEMA}.messages rm ON rm.id = m.reply_to_id
                LEFT JOIN {SCHEMA}.users ru ON ru.id = rm.sender_id
                WHERE m.chat_id = %s
                  AND m.created_at > GREATEST(%s, (SELECT ts FROM cleared))
                  AND m.removed_at IS NULL
                  AND COALESCE(m.kind, 'text') <> 'bot_callback'
                ORDER BY m.created_at ASC LIMIT 100""",
            (now_ts, cid, now_ts, uid_int, cid, cid, int(since))
        )
        rows = cur.fetchall()

        # ids удалённых (одним отдельным запросом — нужен для соответствия фронту)
        cur.execute(
            f"SELECT id FROM {SCHEMA}.messages WHERE chat_id = %s AND removed_at IS NOT NULL",
            (cid,)
        )
        removed_ids = [r[0] for r in cur.fetchall()]
        conn.close()
        def _parse_payload(raw):
            if not raw:
                return None
            try:
                return json.loads(raw)
            except Exception:
                return None

        def _reply_obj(r):
            if not r[12] or not r[19]:
                return None
            return {"id": r[19], "sender_name": r[20], "text": r[21], "media_type": r[22]}

        messages = [{
            "id": r[0], "sender_id": r[1], "text": r[2], "created_at": r[3],
            "read_at": r[4], "sender_name": r[5],
            "image_url": r[6],
            "media_type": r[7], "media_url": r[8],
            "file_name": r[9], "file_size": r[10], "duration": r[11],
            "reply_to": _reply_obj(r),
            "forwarded_from_user_id": r[13],
            "forwarded_from_name": r[14],
            "edited_at": r[15],
            "kind": r[16] or "text",
            "payload": _parse_payload(r[17]),
            "expires_at": int(r[18]) if r[18] else None,
            "reactions": r[23] or [],
        } for r in rows]
        return ok({"messages": messages, "removed_ids": removed_ids, "now": int(time.time())})

    # ── scheduled_messages ────────────────────────────────────────────────────
    if action == "schedule_message":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            chat_id = int(body.get("chat_id") or 0)
            scheduled_at = int(body.get("scheduled_at") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный chat_id/scheduled_at")
        text = (body.get("text") or "").strip()[:4000]
        media_url = body.get("media_url") or None
        media_type = body.get("media_type") or None
        file_name = body.get("file_name") or None
        try:
            file_size = int(body.get("file_size") or 0) or None
        except Exception:
            file_size = None
        try:
            duration = int(body.get("duration") or 0) or None
        except Exception:
            duration = None
        if chat_id <= 0 or scheduled_at <= 0:
            conn.close(); return err("Нужны chat_id и scheduled_at")
        if scheduled_at <= int(time.time()) + 5:
            conn.close(); return err("Время отправки должно быть минимум через 10 секунд")
        if scheduled_at > int(time.time()) + 60 * 60 * 24 * 365:
            conn.close(); return err("Слишком далёкая дата (макс. 1 год)")
        if not text and not media_url:
            conn.close(); return err("Нужен text или media")
        # Проверим что юзер участник чата
        cur.execute(f"SELECT user1_id, user2_id FROM {SCHEMA}.chats WHERE id=%s", (chat_id,))
        rr = cur.fetchone()
        if not rr or int(user_id) not in (int(rr[0]), int(rr[1])):
            conn.close(); return err("Нет доступа к чату", 403)
        cur.execute(
            f"""INSERT INTO {SCHEMA}.scheduled_messages
                (chat_id, sender_id, text, media_url, media_type, file_name, file_size, duration, scheduled_at, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (chat_id, int(user_id), text, media_url, media_type, file_name, file_size, duration, scheduled_at, int(time.time()))
        )
        sid = int(cur.fetchone()[0])
        conn.close()
        return ok({"id": sid, "scheduled_at": scheduled_at})

    if action == "scheduled_list":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        chat_id = body.get("chat_id")
        if chat_id:
            cur.execute(
                f"""SELECT id, chat_id, text, media_url, media_type, file_name, scheduled_at, created_at
                    FROM {SCHEMA}.scheduled_messages
                    WHERE sender_id=%s AND chat_id=%s AND sent_at IS NULL AND cancelled_at IS NULL
                    ORDER BY scheduled_at ASC""",
                (int(user_id), int(chat_id))
            )
        else:
            cur.execute(
                f"""SELECT id, chat_id, text, media_url, media_type, file_name, scheduled_at, created_at
                    FROM {SCHEMA}.scheduled_messages
                    WHERE sender_id=%s AND sent_at IS NULL AND cancelled_at IS NULL
                    ORDER BY scheduled_at ASC""",
                (int(user_id),)
            )
        rows = cur.fetchall()
        conn.close()
        return ok({"items": [{
            "id": r[0], "chat_id": r[1], "text": r[2],
            "media_url": r[3], "media_type": r[4], "file_name": r[5],
            "scheduled_at": int(r[6]), "created_at": int(r[7]),
        } for r in rows]})

    if action == "scheduled_cancel":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            sid = int(body.get("id") or 0)
        except Exception:
            conn.close(); return err("Неверный id")
        cur.execute(
            f"""UPDATE {SCHEMA}.scheduled_messages
                SET cancelled_at=%s
                WHERE id=%s AND sender_id=%s AND sent_at IS NULL AND cancelled_at IS NULL
                RETURNING id""",
            (int(time.time()), sid, int(user_id))
        )
        rr = cur.fetchone()
        conn.close()
        if not rr:
            return err("Не найдено или уже отправлено", 404)
        return ok({"cancelled": True})

    if action == "scheduled_run_due":
        # Запускается фронтом периодически — отправляет все доспевшие сообщения юзера
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        now = int(time.time())
        cur.execute(
            f"""SELECT id, chat_id, text, media_url, media_type, file_name, file_size, duration
                FROM {SCHEMA}.scheduled_messages
                WHERE sender_id=%s AND sent_at IS NULL AND cancelled_at IS NULL AND scheduled_at <= %s
                ORDER BY scheduled_at ASC LIMIT 20""",
            (int(user_id), now)
        )
        due = cur.fetchall()
        sent_ids = []
        for row in due:
            sid, chat_id, text, media_url, media_type, file_name, file_size, duration = row
            kind = "text"
            try:
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.messages
                        (chat_id, sender_id, text, image_url, media_type, media_url, file_name, file_size, duration, created_at, kind)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                    (int(chat_id), int(user_id), text or "",
                     media_url if media_type == "image" else None,
                     media_type, media_url, file_name, file_size, duration, now, kind)
                )
                msg_id = int(cur.fetchone()[0])
                preview = (text or {"image": "📷 Фото", "video": "📹 Видео", "audio": "🎵 Аудио", "file": "📎 Файл"}.get(media_type or "", "Сообщение"))[:100]
                cur.execute(
                    f"UPDATE {SCHEMA}.chats SET last_message=%s, last_message_at=%s WHERE id=%s",
                    (preview, now, int(chat_id))
                )
                cur.execute(
                    f"UPDATE {SCHEMA}.scheduled_messages SET sent_at=%s, sent_message_id=%s WHERE id=%s",
                    (now, msg_id, sid)
                )
                sent_ids.append(sid)
            except Exception:
                conn.rollback(); cur = conn.cursor()
                continue
        conn.close()
        return ok({"sent": len(sent_ids), "ids": sent_ids})

    # ── chat_wallpaper ────────────────────────────────────────────────────────
    if action == "set_wallpaper":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            chat_id = int(body.get("chat_id") or 0)
        except Exception:
            conn.close(); return err("Неверный chat_id")
        wallpaper = body.get("wallpaper")
        if wallpaper is not None:
            wallpaper = str(wallpaper)[:300]
        cur.execute(
            f"""INSERT INTO {SCHEMA}.chat_settings (user_id, chat_id, wallpaper)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, chat_id) DO UPDATE SET wallpaper=EXCLUDED.wallpaper""",
            (int(user_id), chat_id, wallpaper)
        )
        conn.close()
        return ok({"wallpaper": wallpaper})

    if action == "get_wallpaper":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            chat_id = int(body.get("chat_id") or 0)
        except Exception:
            conn.close(); return err("Неверный chat_id")
        cur.execute(
            f"SELECT wallpaper FROM {SCHEMA}.chat_settings WHERE user_id=%s AND chat_id=%s",
            (int(user_id), chat_id)
        )
        rr = cur.fetchone()
        conn.close()
        return ok({"wallpaper": (rr[0] if rr else None)})

    # ── update_user_settings (универсально для большинства полей) ─────────────
    if action == "update_user_settings":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        ALLOWED = {
            "theme_id", "accent_color", "chat_wallpaper", "bubble_style", "font_size",
            "app_lock_enabled", "read_receipts_enabled", "last_seen_visibility",
            "profile_photo_visibility", "phone_visibility",
            "status_text", "status_until",
            "notify_messages", "notify_groups", "notify_calls",
            "notify_sound", "notify_vibration", "quiet_hours_from", "quiet_hours_to",
        }
        fields, vals = [], []
        for k, v in (body or {}).items():
            if k in ALLOWED:
                fields.append(f"{k}=%s"); vals.append(v)
        if not fields:
            conn.close(); return err("Нечего обновлять")
        vals.append(int(user_id))
        cur.execute(f"UPDATE {SCHEMA}.users SET {', '.join(fields)} WHERE id=%s", vals)
        conn.close()
        return ok({"ok": True})

    if action == "set_app_lock":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        pin = (body.get("pin") or "").strip()
        enabled = bool(body.get("enabled", True))
        if enabled and (not pin or not pin.isdigit() or len(pin) < 4 or len(pin) > 8):
            conn.close(); return err("PIN должен быть цифрами (4-8 знаков)")
        if enabled:
            cur.execute(
                f"UPDATE {SCHEMA}.users SET app_lock_pin=%s, app_lock_enabled=TRUE WHERE id=%s",
                (pin, int(user_id))
            )
        else:
            cur.execute(
                f"UPDATE {SCHEMA}.users SET app_lock_pin=NULL, app_lock_enabled=FALSE WHERE id=%s",
                (int(user_id),)
            )
        conn.close()
        return ok({"ok": True})

    if action == "verify_app_lock":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        pin = (body.get("pin") or "").strip()
        cur.execute(f"SELECT app_lock_pin FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
        rr = cur.fetchone()
        conn.close()
        if not rr or not rr[0]:
            return ok({"ok": True})
        return ok({"ok": rr[0] == pin})

    # ── set_chat_mute — заглушить/включить уведомления личного чата ───────────
    if action == "set_chat_mute":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            cid = int(body.get("chat_id") or 0)
        except Exception:
            conn.close(); return err("Неверный chat_id")
        if not cid:
            conn.close(); return err("Укажите chat_id")
        muted = bool(body.get("muted", True))
        cur.execute(
            f"""INSERT INTO {SCHEMA}.chat_settings (user_id, chat_id, muted)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, chat_id) DO UPDATE SET muted = EXCLUDED.muted""",
            (int(user_id), cid, muted)
        )
        conn.close()
        return ok({"ok": True, "muted": muted})

    # ── set_group_mute — заглушить/включить уведомления группы ────────────────
    if action == "set_group_mute":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            gid = int(body.get("group_id") or 0)
        except Exception:
            conn.close(); return err("Неверный group_id")
        if not gid:
            conn.close(); return err("Укажите group_id")
        muted = bool(body.get("muted", True))
        # muted_until=0 — бессрочно. Если передан hours — мьют на N часов.
        hours = body.get("hours")
        now = int(time.time())
        muted_until = 0
        if muted and hours:
            try:
                muted_until = now + int(hours) * 3600
            except Exception:
                muted_until = 0
        if muted:
            cur.execute(
                f"""INSERT INTO {SCHEMA}.group_mute (user_id, group_id, muted_until, created_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (user_id, group_id) DO UPDATE SET muted_until = EXCLUDED.muted_until""",
                (int(user_id), gid, muted_until, now)
            )
        else:
            cur.execute(
                f"DELETE FROM {SCHEMA}.group_mute WHERE user_id=%s AND group_id=%s",
                (int(user_id), gid)
            )
        conn.close()
        return ok({"ok": True, "muted": muted, "muted_until": muted_until})

    # ── get_mute_settings — все mute-настройки пользователя за один запрос ────
    if action == "get_mute_settings":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        now = int(time.time())
        cur.execute(
            f"""SELECT chat_id FROM {SCHEMA}.chat_settings
                WHERE user_id = %s AND muted = TRUE""",
            (int(user_id),)
        )
        muted_chats = [r[0] for r in cur.fetchall()]
        cur.execute(
            f"""SELECT group_id, muted_until FROM {SCHEMA}.group_mute
                WHERE user_id = %s AND (muted_until = 0 OR muted_until > %s)""",
            (int(user_id), now)
        )
        muted_groups = [{"group_id": r[0], "muted_until": r[1]} for r in cur.fetchall()]
        conn.close()
        return ok({"muted_chats": muted_chats, "muted_groups": muted_groups})

    # ── pin_group_message / unpin_group_message ───────────────────────────────
    if action == "pin_group_message":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            gid = int(body.get("group_id") or 0)
            mid = int(body.get("message_id") or 0)
        except Exception:
            conn.close(); return err("Неверные id")
        cur.execute(
            f"SELECT role FROM {SCHEMA}.group_members WHERE group_id=%s AND user_id=%s",
            (gid, int(user_id))
        )
        me = cur.fetchone()
        if not me or me[0] not in ('owner', 'admin'):
            conn.close(); return err("Только админ может закрепить", 403)
        cur.execute(f"UPDATE {SCHEMA}.groups SET pinned_message_id=%s WHERE id=%s", (mid, gid))
        conn.close()
        return ok({"ok": True})

    if action == "unpin_group_message":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            gid = int(body.get("group_id") or 0)
        except Exception:
            conn.close(); return err("Неверный group_id")
        cur.execute(
            f"SELECT role FROM {SCHEMA}.group_members WHERE group_id=%s AND user_id=%s",
            (gid, int(user_id))
        )
        me = cur.fetchone()
        if not me or me[0] not in ('owner', 'admin'):
            conn.close(); return err("Только админ может открепить", 403)
        cur.execute(f"UPDATE {SCHEMA}.groups SET pinned_message_id=NULL WHERE id=%s", (gid,))
        conn.close()
        return ok({"ok": True})

    if action == "get_pinned_group_message":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            gid = int(body.get("group_id") or 0)
        except Exception:
            conn.close(); return err("Неверный group_id")
        cur.execute(
            f"""SELECT g.pinned_message_id, m.text, u.name, m.media_type
                FROM {SCHEMA}.groups g
                LEFT JOIN {SCHEMA}.group_messages m ON m.id=g.pinned_message_id
                LEFT JOIN {SCHEMA}.users u ON u.id=m.sender_id
                WHERE g.id=%s""",
            (gid,)
        )
        rr = cur.fetchone()
        conn.close()
        if not rr or not rr[0]:
            return ok({"pinned": None})
        return ok({"pinned": {"id": rr[0], "text": rr[1] or "", "sender_name": rr[2] or "", "media_type": rr[3]}})

    if action == "set_group_only_admins":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            gid = int(body.get("group_id") or 0)
        except Exception:
            conn.close(); return err("Неверный group_id")
        only_admins = bool(body.get("only_admins_post", False))
        cur.execute(f"SELECT owner_id FROM {SCHEMA}.groups WHERE id=%s", (gid,))
        rr = cur.fetchone()
        if not rr or int(rr[0]) != int(user_id):
            conn.close(); return err("Только владелец", 403)
        cur.execute(f"UPDATE {SCHEMA}.groups SET only_admins_post=%s WHERE id=%s", (only_admins, gid))
        conn.close()
        return ok({"ok": True})

    # ── Saved Notes (заметки в избранном) ─────────────────────────────────────
    if action == "saved_notes_list":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT id, text, media_url, media_type, pinned, created_at
                FROM {SCHEMA}.saved_notes
                WHERE user_id=%s
                ORDER BY pinned DESC, created_at DESC LIMIT 500""",
            (int(user_id),)
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"notes": [{
            "id": r[0], "text": r[1], "media_url": r[2], "media_type": r[3],
            "pinned": bool(r[4]), "created_at": int(r[5]),
        } for r in rows]})

    if action == "saved_notes_add":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        text = (body.get("text") or "").strip()[:5000]
        media_url = body.get("media_url")
        media_type = body.get("media_type")
        if not text and not media_url:
            conn.close(); return err("Пустая заметка")
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.saved_notes (user_id, text, media_url, media_type, created_at)
                VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (int(user_id), text, media_url, media_type, now)
        )
        nid = int(cur.fetchone()[0])
        conn.close()
        return ok({"id": nid, "created_at": now})

    if action == "saved_notes_pin":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            nid = int(body.get("id") or 0)
        except Exception:
            conn.close(); return err("Неверный id")
        pinned = bool(body.get("pinned", True))
        cur.execute(
            f"UPDATE {SCHEMA}.saved_notes SET pinned=%s WHERE id=%s AND user_id=%s",
            (pinned, nid, int(user_id))
        )
        conn.close()
        return ok({"ok": True})

    if action == "saved_notes_remove":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            nid = int(body.get("id") or 0)
        except Exception:
            conn.close(); return err("Неверный id")
        cur.execute(
            f"DELETE FROM {SCHEMA}.saved_notes WHERE id=%s AND user_id=%s",
            (nid, int(user_id))
        )
        conn.close()
        return ok({"ok": True})

    # ── Drafts ────────────────────────────────────────────────────────────────
    if action == "draft_save":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        text = (body.get("text") or "").strip()[:4000]
        chat_id = body.get("chat_id")
        group_id = body.get("group_id")
        cid = int(chat_id) if chat_id else None
        ggid = int(group_id) if group_id else None
        now = int(time.time())
        if not text:
            cur.execute(
                f"DELETE FROM {SCHEMA}.message_drafts WHERE user_id=%s AND COALESCE(chat_id,0)=%s AND COALESCE(group_id,0)=%s",
                (int(user_id), cid or 0, ggid or 0)
            )
        else:
            cur.execute(
                f"""INSERT INTO {SCHEMA}.message_drafts (user_id, chat_id, group_id, text, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING""",
                (int(user_id), cid, ggid, text, now)
            )
            cur.execute(
                f"""UPDATE {SCHEMA}.message_drafts SET text=%s, updated_at=%s
                    WHERE user_id=%s AND COALESCE(chat_id,0)=%s AND COALESCE(group_id,0)=%s""",
                (text, now, int(user_id), cid or 0, ggid or 0)
            )
        conn.close()
        return ok({"ok": True})

    if action == "draft_get":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        chat_id = body.get("chat_id")
        group_id = body.get("group_id")
        cid = int(chat_id) if chat_id else 0
        ggid = int(group_id) if group_id else 0
        cur.execute(
            f"""SELECT text FROM {SCHEMA}.message_drafts
                WHERE user_id=%s AND COALESCE(chat_id,0)=%s AND COALESCE(group_id,0)=%s""",
            (int(user_id), cid, ggid)
        )
        rr = cur.fetchone()
        conn.close()
        return ok({"text": rr[0] if rr else ""})

    # ── Payment Requests ──────────────────────────────────────────────────────
    if action == "payment_request_create":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            to_id = int(body.get("to_user_id") or 0)
            amount = float(body.get("amount") or 0)
        except Exception:
            conn.close(); return err("Неверные параметры")
        title = (body.get("title") or "").strip()[:200]
        chat_id = body.get("chat_id")
        if to_id <= 0 or amount <= 0:
            conn.close(); return err("Укажите получателя и сумму")
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.payment_requests (from_user_id, to_user_id, amount, title, chat_id, created_at)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (int(user_id), to_id, amount, title, int(chat_id) if chat_id else None, now)
        )
        pid = int(cur.fetchone()[0])
        conn.close()
        return ok({"id": pid})

    if action == "payment_request_list":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT pr.id, pr.from_user_id, pr.to_user_id, pr.amount, pr.title, pr.status, pr.created_at, pr.paid_at,
                       uf.name, ut.name
                FROM {SCHEMA}.payment_requests pr
                LEFT JOIN {SCHEMA}.users uf ON uf.id=pr.from_user_id
                LEFT JOIN {SCHEMA}.users ut ON ut.id=pr.to_user_id
                WHERE pr.from_user_id=%s OR pr.to_user_id=%s
                ORDER BY pr.created_at DESC LIMIT 100""",
            (int(user_id), int(user_id))
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"items": [{
            "id": r[0], "from_user_id": r[1], "to_user_id": r[2],
            "amount": float(r[3]), "title": r[4], "status": r[5],
            "created_at": int(r[6]), "paid_at": int(r[7]) if r[7] else None,
            "from_name": r[8], "to_name": r[9],
            "is_outgoing": int(r[1]) == int(user_id),
        } for r in rows]})

    if action == "payment_request_pay":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            pid = int(body.get("id") or 0)
        except Exception:
            conn.close(); return err("Неверный id")
        cur.execute(
            f"SELECT from_user_id, to_user_id, amount, status FROM {SCHEMA}.payment_requests WHERE id=%s",
            (pid,)
        )
        r = cur.fetchone()
        if not r:
            conn.close(); return err("Счёт не найден", 404)
        from_id, to_id, amt, status = int(r[0]), int(r[1]), float(r[2]), r[3]
        if from_id != int(user_id):
            conn.close(); return err("Это не ваш счёт")
        if status != "pending":
            conn.close(); return err("Счёт уже не активен")
        # Списать с баланса плательщика, начислить получателю
        cur.execute(f"SELECT COALESCE(wallet_balance,0) FROM {SCHEMA}.users WHERE id=%s", (from_id,))
        bal = float(cur.fetchone()[0] or 0)
        if bal < amt:
            conn.close(); return err("Недостаточно средств. Пополните кошелёк.")
        cur.execute(f"UPDATE {SCHEMA}.users SET wallet_balance=COALESCE(wallet_balance,0)-%s WHERE id=%s", (amt, from_id))
        cur.execute(f"UPDATE {SCHEMA}.users SET wallet_balance=COALESCE(wallet_balance,0)+%s WHERE id=%s", (amt, to_id))
        now = int(time.time())
        cur.execute(
            f"UPDATE {SCHEMA}.payment_requests SET status='paid', paid_at=%s WHERE id=%s",
            (now, pid)
        )
        cur.execute(
            f"INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, reason, created_at) VALUES (%s, %s, %s, %s)",
            (from_id, -amt, f"Оплата счёта #{pid}", now)
        )
        cur.execute(
            f"INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, reason, created_at) VALUES (%s, %s, %s, %s)",
            (to_id, amt, f"Платёж по счёту #{pid}", now)
        )
        conn.close()
        return ok({"ok": True})

    if action == "payment_request_cancel":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            pid = int(body.get("id") or 0)
        except Exception:
            conn.close(); return err("Неверный id")
        cur.execute(
            f"UPDATE {SCHEMA}.payment_requests SET status='cancelled' WHERE id=%s AND to_user_id=%s AND status='pending'",
            (pid, int(user_id))
        )
        conn.close()
        return ok({"ok": True})

    # ── Bot Commands ──────────────────────────────────────────────────────────
    if action == "bot_commands_list":
        try:
            bid = int(body.get("bot_id") or 0)
        except Exception:
            conn.close(); return err("Неверный bot_id")
        cur.execute(
            f"SELECT id, command, description FROM {SCHEMA}.bot_commands WHERE bot_id=%s ORDER BY id ASC",
            (bid,)
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"commands": [{"id": r[0], "command": r[1], "description": r[2]} for r in rows]})

    if action == "bot_commands_set":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            bid = int(body.get("bot_id") or 0)
        except Exception:
            conn.close(); return err("Неверный bot_id")
        cmds = body.get("commands") or []
        # проверяем что бот принадлежит юзеру
        cur.execute(f"SELECT bot_owner_id FROM {SCHEMA}.users WHERE id=%s AND COALESCE(is_bot,FALSE)=TRUE", (bid,))
        rr = cur.fetchone()
        if not rr or int(rr[0]) != int(user_id):
            conn.close(); return err("Бот не ваш", 403)
        cur.execute(f"DELETE FROM {SCHEMA}.bot_commands WHERE bot_id=%s", (bid,))
        for c in cmds:
            cmd = (c.get("command") or "").strip()[:32]
            desc = (c.get("description") or "").strip()[:200]
            if cmd:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.bot_commands (bot_id, command, description) VALUES (%s, %s, %s)",
                    (bid, cmd, desc)
                )
        conn.close()
        return ok({"ok": True})

    # ── Close Friends ─────────────────────────────────────────────────────────
    if action == "close_friends_list":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT cf.friend_id, u.name, u.avatar_url
                FROM {SCHEMA}.close_friends cf
                JOIN {SCHEMA}.users u ON u.id=cf.friend_id
                WHERE cf.user_id=%s ORDER BY cf.created_at DESC""",
            (int(user_id),)
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"friends": [{"id": r[0], "name": r[1], "avatar_url": r[2]} for r in rows]})

    if action == "close_friends_toggle":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            fid = int(body.get("friend_id") or 0)
        except Exception:
            conn.close(); return err("Неверный friend_id")
        cur.execute(
            f"SELECT 1 FROM {SCHEMA}.close_friends WHERE user_id=%s AND friend_id=%s",
            (int(user_id), fid)
        )
        if cur.fetchone():
            cur.execute(f"DELETE FROM {SCHEMA}.close_friends WHERE user_id=%s AND friend_id=%s", (int(user_id), fid))
            conn.close()
            return ok({"in_list": False})
        else:
            cur.execute(
                f"INSERT INTO {SCHEMA}.close_friends (user_id, friend_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (int(user_id), fid)
            )
            conn.close()
            return ok({"in_list": True})

    # ── User Sessions ─────────────────────────────────────────────────────────
    if action == "sessions_list":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT id, device_name, device_info, ip_addr, created_at, last_active_at, revoked
                FROM {SCHEMA}.user_sessions WHERE user_id=%s ORDER BY last_active_at DESC LIMIT 50""",
            (int(user_id),)
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"sessions": [{
            "id": r[0], "device_name": r[1], "device_info": r[2], "ip_addr": r[3],
            "created_at": int(r[4]), "last_active_at": int(r[5]), "revoked": bool(r[6]),
        } for r in rows]})

    if action == "sessions_revoke":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            sid = int(body.get("session_id") or 0)
        except Exception:
            conn.close(); return err("Неверный session_id")
        cur.execute(
            f"UPDATE {SCHEMA}.user_sessions SET revoked=TRUE WHERE id=%s AND user_id=%s",
            (sid, int(user_id))
        )
        conn.close()
        return ok({"ok": True})

    if action == "sessions_revoke_all":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        cur.execute(
            f"UPDATE {SCHEMA}.user_sessions SET revoked=TRUE WHERE user_id=%s",
            (int(user_id),)
        )
        conn.close()
        return ok({"ok": True})

    # ── support tickets (user side) ───────────────────────────────────────────
    if action == "support_create_ticket":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        subject = (body.get("subject") or "").strip()[:200] or "Без темы"
        text = (body.get("text") or "").strip()[:4000]
        if not text:
            conn.close(); return err("Нужен текст сообщения")
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.support_tickets
                (user_id, subject, status, created_at, last_message_at, unread_for_admin)
                VALUES (%s, %s, 'open', %s, %s, 1) RETURNING id""",
            (int(user_id), subject, now, now)
        )
        tid = int(cur.fetchone()[0])
        cur.execute(
            f"""INSERT INTO {SCHEMA}.support_messages (ticket_id, sender_id, is_admin, text, created_at)
                VALUES (%s, %s, FALSE, %s, %s)""",
            (tid, int(user_id), text, now)
        )
        conn.close()
        return ok({"ticket_id": tid})

    if action == "support_my_tickets":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT t.id, t.subject, t.status, t.created_at, t.last_message_at, t.unread_for_user,
                       (SELECT text FROM {SCHEMA}.support_messages m WHERE m.ticket_id=t.id ORDER BY m.created_at DESC LIMIT 1) AS last_text
                FROM {SCHEMA}.support_tickets t
                WHERE t.user_id=%s
                ORDER BY t.last_message_at DESC LIMIT 100""",
            (int(user_id),)
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"tickets": [{
            "id": r[0], "subject": r[1], "status": r[2],
            "created_at": int(r[3]), "last_message_at": int(r[4]),
            "unread": int(r[5] or 0),
            "last_text": (r[6] or "")[:120],
        } for r in rows]})

    if action == "support_ticket_messages":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            tid = int(body.get("ticket_id") or 0)
        except Exception:
            conn.close(); return err("Неверный ticket_id")
        cur.execute(f"SELECT user_id FROM {SCHEMA}.support_tickets WHERE id=%s", (tid,))
        rr = cur.fetchone()
        if not rr or int(rr[0]) != int(user_id):
            conn.close(); return err("Нет доступа", 403)
        cur.execute(
            f"""SELECT id, sender_id, is_admin, text, created_at
                FROM {SCHEMA}.support_messages
                WHERE ticket_id=%s ORDER BY created_at ASC LIMIT 500""",
            (tid,)
        )
        rows = cur.fetchall()
        # Сбрасываем unread для юзера
        cur.execute(
            f"UPDATE {SCHEMA}.support_tickets SET unread_for_user=0 WHERE id=%s",
            (tid,)
        )
        conn.close()
        return ok({"messages": [{
            "id": r[0], "sender_id": r[1], "is_admin": bool(r[2]),
            "text": r[3], "created_at": int(r[4]),
        } for r in rows]})

    if action == "support_send_message":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            tid = int(body.get("ticket_id") or 0)
        except Exception:
            conn.close(); return err("Неверный ticket_id")
        text = (body.get("text") or "").strip()[:4000]
        if not text:
            conn.close(); return err("Нужен текст")
        cur.execute(f"SELECT user_id, status FROM {SCHEMA}.support_tickets WHERE id=%s", (tid,))
        rr = cur.fetchone()
        if not rr or int(rr[0]) != int(user_id):
            conn.close(); return err("Нет доступа", 403)
        if rr[1] == "closed":
            conn.close(); return err("Тикет закрыт. Создайте новый.")
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.support_messages (ticket_id, sender_id, is_admin, text, created_at)
                VALUES (%s, %s, FALSE, %s, %s) RETURNING id""",
            (tid, int(user_id), text, now)
        )
        mid = int(cur.fetchone()[0])
        cur.execute(
            f"UPDATE {SCHEMA}.support_tickets SET last_message_at=%s, unread_for_admin=unread_for_admin+1, status='open' WHERE id=%s",
            (now, tid)
        )
        conn.close()
        return ok({"id": mid, "created_at": now})

    # ── send_message ──────────────────────────────────────────────────────────
    if action == "send_message":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        # Rate-limit: не более 30 сообщений в минуту на пользователя
        if not _rate_limit(cur, f"msg:{user_id}", 30):
            conn.close()
            return err("Слишком быстро. Подождите минуту.", 429)
        chat_id = body.get("chat_id")
        text = (body.get("text") or "").strip()
        image_url = (body.get("image_url") or "").strip()
        media_type = (body.get("media_type") or "").strip()
        media_url = (body.get("media_url") or "").strip()
        file_name = (body.get("file_name") or "").strip() or None
        file_size = body.get("file_size") or None
        duration = body.get("duration") or None
        reply_to_id = body.get("reply_to_id") or None
        forwarded_from_user_id = body.get("forwarded_from_user_id") or None
        forwarded_from_name = (body.get("forwarded_from_name") or "").strip() or None
        kind = (body.get("kind") or "text").strip() or "text"
        payload = body.get("payload") or None

        # Совместимость: image_url → media
        if image_url and not media_url:
            media_url = image_url
            media_type = "image"

        if not chat_id or (not text and not media_url and kind == "text"):
            conn.close()
            return err("Укажите chat_id и text или media")

        # Валидация sticker: юзер должен владеть паком
        if kind == "sticker":
            pack_id = (payload or {}).get("pack_id") if isinstance(payload, dict) else None
            if not pack_id:
                conn.close(); return err("Нужен pack_id в payload стикера")
            cur.execute(
                f"SELECT 1 FROM {SCHEMA}.user_sticker_packs WHERE user_id=%s AND pack_id=%s",
                (int(user_id), int(pack_id))
            )
            if not cur.fetchone():
                conn.close(); return err("Этот стикерпак не куплен")

        # Автотекст по типу медиа/спецсообщений
        if not text and media_url:
            auto_text = {"image": "📷 Фото", "video": "🎥 Видео", "audio": "🎵 Голосовое", "file": f"📎 {file_name or 'Файл'}"}.get(media_type, "📎 Файл")
            text = auto_text
        if not text and kind == "gift":
            qty = (payload or {}).get("quantity", 0) if isinstance(payload, dict) else 0
            text = f"⚡ Подарок: {qty} молний"
        if not text and kind == "fundraiser":
            text = "❤️ Сбор средств"
        if not text and kind == "sticker":
            text = "🎨 Стикер"

        payload_str = json.dumps(payload, ensure_ascii=False) if isinstance(payload, (dict, list)) else None

        now = int(time.time())
        # Исчезающие сообщения
        cur.execute(f"SELECT disappearing_seconds FROM {SCHEMA}.chats WHERE id=%s", (int(chat_id),))
        rd = cur.fetchone()
        ttl = int(rd[0]) if rd and rd[0] else None
        expires_at = (now + ttl) if ttl and ttl > 0 else None
        cur.execute(
            f"""INSERT INTO {SCHEMA}.messages
                (chat_id, sender_id, text, image_url, media_type, media_url, file_name, file_size, duration, created_at,
                 reply_to_id, forwarded_from_user_id, forwarded_from_name, kind, payload_json, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (int(chat_id), int(user_id), text,
             media_url if media_type == "image" else None,
             media_type or None, media_url or None,
             file_name, file_size, duration, now,
             int(reply_to_id) if reply_to_id else None,
             int(forwarded_from_user_id) if forwarded_from_user_id else None,
             forwarded_from_name, kind, payload_str, expires_at)
        )
        msg_id = cur.fetchone()[0]
        cur.execute(
            f"UPDATE {SCHEMA}.chats SET last_message = %s, last_message_at = %s WHERE id = %s",
            (text[:100], now, int(chat_id))
        )
        cur.execute(f"UPDATE {SCHEMA}.users SET last_seen = %s WHERE id = %s", (now, int(user_id)))

        # XP за активность
        if kind == "text":
            _grant_xp(cur, int(user_id), "message")
        elif kind == "sticker":
            _grant_xp(cur, int(user_id), "sticker_sent")
        # Бейдж "Болтун" за 100 текстовых сообщений: проверяем не каждый раз,
        # а только если msg_id кратен 25 — кратно реже + EXISTS вместо COUNT
        if kind == "text" and int(msg_id) % 25 == 0:
            cur.execute(
                f"SELECT EXISTS(SELECT 1 FROM {SCHEMA}.messages WHERE sender_id=%s AND kind='text' AND removed_at IS NULL OFFSET 99 LIMIT 1)",
                (int(user_id),)
            )
            if (cur.fetchone() or [False])[0]:
                _award_badge(cur, int(user_id), "talker")
        # Бейдж "Социальный": тоже не на каждое сообщение
        if int(msg_id) % 50 == 0:
            cur.execute(
                f"SELECT EXISTS(SELECT 1 FROM {SCHEMA}.chats WHERE user1_id=%s OR user2_id=%s OFFSET 4 LIMIT 1)",
                (int(user_id), int(user_id))
            )
            if (cur.fetchone() or [False])[0]:
                _award_badge(cur, int(user_id), "social")

        # Объединяем получение recipient + sender_name + webhook бота в ОДИН запрос
        cur.execute(
            f"""SELECT u.name,
                       CASE WHEN c.user1_id = %s THEN c.user2_id ELSE c.user1_id END AS recipient_id,
                       ru.bot_webhook_url, COALESCE(ru.is_bot, FALSE)
                FROM {SCHEMA}.chats c
                JOIN {SCHEMA}.users u ON u.id = %s
                JOIN {SCHEMA}.users ru ON ru.id = (CASE WHEN c.user1_id = %s THEN c.user2_id ELSE c.user1_id END)
                WHERE c.id = %s""",
            (int(user_id), int(user_id), int(user_id), int(chat_id))
        )
        row = cur.fetchone()
        # XP получателю за входящее
        if row and kind in ("text", "sticker", "gift"):
            _grant_xp(cur, int(row[1]), "received_message")
        conn.close()

        if row:
            sender_name, recipient_id, bot_webhook_url, is_bot = row
            # Webhook для бота-получателя — в фоне
            if is_bot and bot_webhook_url:
                wh_body = json.dumps({
                    "message_id": int(msg_id),
                    "chat_id": int(chat_id),
                    "from_user_id": int(user_id),
                    "from_user_name": sender_name,
                    "text": text or "",
                    "created_at": now,
                }).encode("utf-8")
                _fire_and_forget_http(bot_webhook_url, wh_body, timeout=3.0)
            # Push-уведомление — в фоне
            push_url = os.environ.get("PUSH_NOTIFY_URL", "")
            if push_url:
                push_body = json.dumps({
                    "action": "send",
                    "recipient_id": recipient_id,
                    "sender_name": sender_name,
                    "message": text[:100],
                    "chat_id": int(chat_id),
                }).encode("utf-8")
                _fire_and_forget_http(push_url, push_body, timeout=5.0)

        return ok({"id": msg_id, "created_at": now, "media_url": media_url or None, "media_type": media_type or None, "image_url": media_url if media_type == "image" else None})

    # ── add_reaction ──────────────────────────────────────────────────────────
    if action == "add_reaction":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        msg_id = body.get("message_id")
        emoji = (body.get("emoji") or "").strip()
        if not msg_id or not emoji:
            conn.close()
            return err("Укажите message_id и emoji")
        now = int(time.time())
        # Если уже такая реакция — удаляем (toggle)
        cur.execute(
            f"SELECT id, emoji FROM {SCHEMA}.message_reactions WHERE message_id = %s AND user_id = %s",
            (int(msg_id), int(user_id))
        )
        existing = cur.fetchone()
        if existing:
            if existing[1] == emoji:
                # Та же реакция — убираем
                cur.execute(f"UPDATE {SCHEMA}.message_reactions SET emoji = %s WHERE id = %s", (None, existing[0]))
                # Нельзя SET NULL в уникальной строке, просто обновим на другое значение или удалим через update
                # Используем флаг удаления через обновление поля created_at на 0
                cur.execute(f"UPDATE {SCHEMA}.message_reactions SET emoji = %s WHERE id = %s", ('__removed__', existing[0]))
                conn.close()
                return ok({"ok": True, "removed": True})
            else:
                cur.execute(
                    f"UPDATE {SCHEMA}.message_reactions SET emoji = %s, created_at = %s WHERE id = %s",
                    (emoji, now, existing[0])
                )
        else:
            cur.execute(
                f"""INSERT INTO {SCHEMA}.message_reactions (message_id, user_id, emoji, created_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = EXCLUDED.created_at""",
                (int(msg_id), int(user_id), emoji, now)
            )
        conn.close()
        return ok({"ok": True})

    # ── update_profile ────────────────────────────────────────────────────────
    if action == "update_profile":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        sets = []
        vals = []
        if "name" in body and body.get("name") is not None:
            new_name = (body.get("name") or "").strip()
            if not new_name or len(new_name) < 2:
                conn.close()
                return err("Имя слишком короткое")
            sets.append("name = %s")
            vals.append(new_name)
        if "avatar_url" in body:
            avatar_url = body.get("avatar_url") or None
            if avatar_url is not None and not isinstance(avatar_url, str):
                conn.close()
                return err("Неверный avatar_url")
            sets.append("avatar_url = %s")
            vals.append(avatar_url)
        if "about" in body:
            about_raw = body.get("about")
            if about_raw is None:
                about_val = None
            else:
                about_val = str(about_raw).strip()
                if len(about_val) > 200:
                    conn.close()
                    return err("Текст «О себе» слишком длинный (макс. 200 символов)")
                if about_val == "":
                    about_val = None
            sets.append("about = %s")
            vals.append(about_val)
        if "gender" in body:
            g_raw = body.get("gender")
            if g_raw is None or g_raw == "":
                sets.append("gender = %s"); vals.append(None)
            elif g_raw in ("male", "female"):
                sets.append("gender = %s"); vals.append(g_raw)
            else:
                conn.close()
                return err("Неверный gender (male/female)")
        if "birthdate" in body:
            bd_raw = body.get("birthdate")
            if bd_raw is None or bd_raw == "":
                sets.append("birthdate = %s"); vals.append(None)
            else:
                bd_str = str(bd_raw).strip()
                import re as _re
                if not _re.match(r"^\d{4}-\d{2}-\d{2}$", bd_str):
                    conn.close()
                    return err("Неверная дата (YYYY-MM-DD)")
                sets.append("birthdate = %s"); vals.append(bd_str)
        if "emoji_status" in body:
            es = body.get("emoji_status")
            if es is None or es == "":
                sets.append("emoji_status = %s"); vals.append(None)
            else:
                sets.append("emoji_status = %s"); vals.append(str(es)[:8])
        if "name_color" in body:
            nc = body.get("name_color")
            if nc is None or nc == "":
                sets.append("name_color = %s"); vals.append(None)
            else:
                import re as _re2
                if not _re2.match(r"^#[0-9a-fA-F]{6}$", str(nc)):
                    conn.close()
                    return err("Неверный цвет (формат #RRGGBB)")
                sets.append("name_color = %s"); vals.append(str(nc))
        if "incognito" in body:
            sets.append("incognito = %s"); vals.append(bool(body.get("incognito")))
        if "who_can_message" in body:
            v = body.get("who_can_message")
            if v not in ("everyone", "contacts", "nobody"):
                conn.close()
                return err("who_can_message: everyone | contacts | nobody")
            sets.append("who_can_message = %s"); vals.append(v)
        if "who_can_call" in body:
            v = body.get("who_can_call")
            if v not in ("everyone", "contacts", "nobody"):
                conn.close()
                return err("who_can_call: everyone | contacts | nobody")
            sets.append("who_can_call = %s"); vals.append(v)
        if not sets:
            conn.close()
            return err("Нет данных для обновления")
        vals.append(int(user_id))
        cur.execute(
            f"UPDATE {SCHEMA}.users SET {', '.join(sets)} WHERE id = %s RETURNING {USER_COLS}",
            tuple(vals)
        )
        row = cur.fetchone()
        conn.close()
        if not row:
            return err("Пользователь не найден", 404)
        return ok({"user": serialize_user(row)})

    # ── set_typing ────────────────────────────────────────────────────────────
    if action == "set_typing":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        chat_id = body.get("chat_id")
        if not chat_id:
            conn.close()
            return err("Укажите chat_id")
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.typing_status (chat_id, user_id, updated_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (chat_id, user_id) DO UPDATE SET updated_at = EXCLUDED.updated_at""",
            (int(chat_id), int(user_id), now)
        )
        conn.close()
        return ok({"ok": True})

    # ── get_typing ────────────────────────────────────────────────────────────
    if action == "get_typing":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        chat_id = body.get("chat_id") or params.get("chat_id")
        if not chat_id:
            conn.close()
            return err("Укажите chat_id")
        now = int(time.time())
        cur.execute(
            f"""SELECT user_id FROM {SCHEMA}.typing_status
                WHERE chat_id = %s AND user_id != %s AND updated_at > %s""",
            (int(chat_id), int(user_id), now - 4)
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"typing": len(rows) > 0})

    # ── mark_read ─────────────────────────────────────────────────────────────
    if action == "mark_read":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        chat_id = body.get("chat_id")
        if not chat_id:
            conn.close()
            return err("Укажите chat_id")
        if not _is_chat_member(cur, int(chat_id), int(user_id)):
            conn.close()
            return err("Нет доступа к чату", 403)
        now = int(time.time())
        cur.execute(
            f"UPDATE {SCHEMA}.messages SET read_at = %s WHERE chat_id = %s AND sender_id != %s AND read_at IS NULL",
            (now, int(chat_id), int(user_id))
        )
        conn.close()
        return ok({"ok": True})

    # ── delete_message ────────────────────────────────────────────────────────
    if action == "delete_message":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        msg_id = body.get("message_id")
        if not msg_id:
            conn.close()
            return err("Укажите message_id")
        cur.execute(f"SELECT sender_id, chat_id FROM {SCHEMA}.messages WHERE id = %s", (int(msg_id),))
        row = cur.fetchone()
        if not row:
            conn.close()
            return err("Сообщение не найдено", 404)
        if int(row[0]) != int(user_id):
            conn.close()
            return err("Нельзя удалить чужое сообщение", 403)
        chat_id_v = int(row[1])
        now = int(time.time())
        # мягкое удаление: метка removed_at + чистим контент
        cur.execute(
            f"""UPDATE {SCHEMA}.messages
                SET removed_at = %s, text = '', media_url = NULL, media_type = NULL,
                    image_url = NULL, file_name = NULL, file_size = NULL, duration = NULL,
                    reply_to_id = NULL
                WHERE id = %s""",
            (now, int(msg_id))
        )
        # обновим last_message в чате, если удалили последнее
        cur.execute(
            f"""SELECT text FROM {SCHEMA}.messages
                WHERE chat_id = %s AND removed_at IS NULL
                ORDER BY created_at DESC LIMIT 1""",
            (chat_id_v,)
        )
        last = cur.fetchone()
        new_last = (last[0] if last else "") or ""
        cur.execute(
            f"UPDATE {SCHEMA}.chats SET last_message = %s WHERE id = %s",
            (new_last[:100], chat_id_v)
        )
        conn.close()
        return ok({"ok": True, "id": int(msg_id), "removed_at": now})

    # ── get_contacts ──────────────────────────────────────────────────────────
    if action == "get_contacts":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT u.id, u.name, u.phone, u.avatar_url, u.last_seen, c.name_override
                FROM {SCHEMA}.contacts c
                JOIN {SCHEMA}.users u ON u.id = c.contact_id
                WHERE c.user_id = %s AND (c.name_override IS NULL OR c.name_override != 'DELETED')
                ORDER BY COALESCE(c.name_override, u.name) ASC""",
            (int(user_id),)
        )
        rows = cur.fetchall()
        conn.close()
        contacts = [{"id": r[0], "name": r[5] or r[1], "real_name": r[1], "phone": r[2], "avatar_url": r[3], "last_seen": r[4]} for r in rows]
        return ok({"contacts": contacts})

    # ── add_contact ───────────────────────────────────────────────────────────
    if action == "add_contact":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        name_override = (body.get("name") or body.get("name_override") or "").strip() or None
        contact_id_raw = body.get("contact_id")
        if contact_id_raw:
            try:
                cid_int = int(contact_id_raw)
            except (TypeError, ValueError):
                conn.close()
                return err("Неверный contact_id")
            cur.execute(f"SELECT id, name FROM {SCHEMA}.users WHERE id = %s", (cid_int,))
            found = cur.fetchone()
        else:
            phone = (body.get("phone") or "").strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
            if phone.startswith("8"):
                phone = "7" + phone[1:]
            if phone.startswith("+"):
                phone = phone[1:]
            if not phone:
                conn.close()
                return err("Укажите phone или contact_id")
            cur.execute(f"SELECT id, name FROM {SCHEMA}.users WHERE phone = %s", (phone,))
            found = cur.fetchone()
        if not found:
            conn.close()
            return err("Пользователь не найден")
        if found[0] == int(user_id):
            conn.close()
            return err("Нельзя добавить себя")
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.contacts (user_id, contact_id, name_override, created_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, contact_id) DO UPDATE SET name_override = EXCLUDED.name_override
                RETURNING id""",
            (int(user_id), found[0], name_override, now)
        )
        conn.close()
        return ok({"ok": True, "contact": {"id": found[0], "name": name_override or found[1]}})

    # ── import_contacts (массовый импорт телефонной книги) ────────────────────
    if action == "import_contacts":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        items = body.get("contacts") or []
        if not isinstance(items, list):
            conn.close()
            return err("Поле contacts должно быть массивом")

        def _norm(p: str) -> str:
            p = (p or "").strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
            if p.startswith("+"):
                p = p[1:]
            if p.startswith("8") and len(p) == 11:
                p = "7" + p[1:]
            return p

        # Подготовим уникальный список нормализованных телефонов
        normalized: list[tuple[str, str]] = []  # (phone, name)
        seen: set[str] = set()
        for it in items[:1000]:  # лимит на всякий случай
            if not isinstance(it, dict):
                continue
            ph = _norm(str(it.get("phone") or ""))
            nm = (str(it.get("name") or "")).strip() or None
            if not ph or ph in seen:
                continue
            seen.add(ph)
            normalized.append((ph, nm))

        if not normalized:
            conn.close()
            return ok({"ok": True, "added": 0, "matched": [], "not_registered": []})

        phones_list = [p for p, _ in normalized]
        # Безопасно строим in-list (только цифры внутри)
        safe_phones = [p for p in phones_list if p.isdigit()]
        if not safe_phones:
            conn.close()
            return ok({"ok": True, "added": 0, "matched": [], "not_registered": phones_list})

        in_clause = ",".join(f"'{p}'" for p in safe_phones)
        cur.execute(f"SELECT id, name, phone, avatar_url FROM {SCHEMA}.users WHERE phone IN ({in_clause})")
        rows = cur.fetchall()
        users_by_phone = {r[2]: {"id": r[0], "name": r[1], "phone": r[2], "avatar_url": r[3]} for r in rows}

        now = int(time.time())
        added = 0
        matched: list[dict] = []
        not_registered: list[str] = []
        me = int(user_id)
        names_by_phone = {p: n for p, n in normalized}

        for phone in safe_phones:
            u = users_by_phone.get(phone)
            if not u:
                not_registered.append(phone)
                continue
            if u["id"] == me:
                continue
            name_override = names_by_phone.get(phone)
            cur.execute(
                f"""INSERT INTO {SCHEMA}.contacts (user_id, contact_id, name_override, created_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (user_id, contact_id) DO UPDATE
                    SET name_override = COALESCE(EXCLUDED.name_override, {SCHEMA}.contacts.name_override)""",
                (me, u["id"], name_override, now),
            )
            added += 1
            matched.append({"id": u["id"], "name": name_override or u["name"], "phone": phone, "avatar_url": u["avatar_url"]})

        conn.close()
        return ok({"ok": True, "added": added, "matched": matched, "not_registered": not_registered})

    # ── remove_contact ────────────────────────────────────────────────────────
    if action == "remove_contact":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        contact_id = body.get("contact_id")
        if not contact_id:
            conn.close()
            return err("Укажите contact_id")
        cur.execute(
            f"UPDATE {SCHEMA}.contacts SET name_override = 'DELETED' WHERE user_id = %s AND contact_id = %s",
            (int(user_id), int(contact_id))
        )
        conn.close()
        return ok({"ok": True})

    # ── call_signal ───────────────────────────────────────────────────────────
    if action == "call_signal":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        call_id = (body.get("call_id") or "").strip()
        to_user_id = body.get("to_user_id")
        signal_type = (body.get("type") or "").strip()
        payload = body.get("payload")
        if not call_id or not to_user_id or not signal_type:
            conn.close()
            return err("Укажите call_id, to_user_id, type")
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.call_signals (call_id, from_user_id, to_user_id, type, payload, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)""",
            (call_id, int(user_id), int(to_user_id), signal_type, json.dumps(payload) if payload else None, now)
        )
        if signal_type == "offer":
            cur.execute(f"SELECT name FROM {SCHEMA}.users WHERE id = %s", (int(user_id),))
            caller = cur.fetchone()
            conn.close()
            push_url = os.environ.get("PUSH_NOTIFY_URL", "")
            if push_url and caller:
                push_body = json.dumps({
                    "action": "send",
                    "recipient_id": int(to_user_id),
                    "sender_name": caller[0],
                    "is_call": True,
                    "call_id": call_id,
                    "message": "Входящий звонок",
                }).encode("utf-8")
                # В фоне, чтобы не задерживать установку звонка у звонящего
                _fire_and_forget_http(push_url, push_body)
        elif signal_type in ("end", "decline", "cancel", "hangup"):
            # Пропущенный звонок: если answer от вызываемого не было — создаём системное сообщение
            cur.execute(
                f"""SELECT 1 FROM {SCHEMA}.call_signals
                    WHERE call_id = %s AND type = 'answer' LIMIT 1""",
                (call_id,)
            )
            answered = cur.fetchone()
            cur.execute(
                f"""SELECT 1 FROM {SCHEMA}.messages
                    WHERE kind = 'missed_call' AND text LIKE %s LIMIT 1""",
                (f"%{call_id}%",)
            )
            already = cur.fetchone()
            missed_recipient_id = None
            missed_caller_name = None
            if not answered and not already:
                # Определяем from/to и chat
                cur.execute(
                    f"""SELECT MIN(from_user_id), MIN(to_user_id) FROM {SCHEMA}.call_signals
                        WHERE call_id = %s AND type = 'offer'""",
                    (call_id,)
                )
                fromto = cur.fetchone()
                caller_id = (fromto and fromto[0]) or int(user_id)
                callee_id = (fromto and fromto[1]) or int(to_user_id)
                u1, u2 = sorted([int(caller_id), int(callee_id)])
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.chats (user1_id, user2_id, created_at)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (user1_id, user2_id) DO UPDATE SET user1_id = EXCLUDED.user1_id
                        RETURNING id""",
                    (u1, u2, now)
                )
                chat_row = cur.fetchone()
                if chat_row:
                    miss_chat_id = chat_row[0]
                    miss_text = f"Пропущенный звонок [{call_id}]"
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.messages
                            (chat_id, sender_id, text, created_at, kind)
                            VALUES (%s, %s, %s, %s, 'missed_call')""",
                        (miss_chat_id, int(caller_id), miss_text, now)
                    )
                    cur.execute(
                        f"UPDATE {SCHEMA}.chats SET last_message = %s, last_message_at = %s WHERE id = %s",
                        ("📵 Пропущенный звонок", now, miss_chat_id)
                    )
                    # Получим имя звонящего и id получателя для push
                    cur.execute(f"SELECT name FROM {SCHEMA}.users WHERE id = %s", (int(caller_id),))
                    cn = cur.fetchone()
                    missed_caller_name = cn[0] if cn else "Кто-то"
                    missed_recipient_id = int(callee_id)
            conn.close()
            # Push «Пропущенный звонок» — если получатель не отвечал и звонящий повесил трубку
            if missed_recipient_id and missed_caller_name:
                push_url = os.environ.get("PUSH_NOTIFY_URL", "")
                if push_url:
                    try:
                        push_body = json.dumps({
                            "action": "send",
                            "recipient_id": missed_recipient_id,
                            "sender_name": missed_caller_name,
                            "message": f"📵 Пропущенный звонок от {missed_caller_name}",
                            "tag": f"missed_{call_id}",
                        }).encode("utf-8")
                        req = urllib.request.Request(push_url, data=push_body, headers={"Content-Type": "application/json"})
                        urllib.request.urlopen(req, timeout=5)
                    except Exception:
                        pass
        else:
            conn.close()
        return ok({"ok": True})

    # ── get_call_signals ──────────────────────────────────────────────────────
    if action == "get_call_signals":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        call_id = (body.get("call_id") or params.get("call_id") or "").strip()
        since = int(body.get("since") or params.get("since") or 0)
        if not call_id:
            conn.close()
            return err("Укажите call_id")
        cur.execute(
            f"""SELECT id, from_user_id, type, payload, created_at
                FROM {SCHEMA}.call_signals
                WHERE call_id = %s AND to_user_id = %s AND created_at > %s
                ORDER BY id ASC LIMIT 20""",
            (call_id, int(user_id), since)
        )
        rows = cur.fetchall()
        conn.close()
        signals = [{"id": r[0], "from_user_id": r[1], "type": r[2], "payload": json.loads(r[3]) if r[3] else None, "created_at": r[4]} for r in rows]
        return ok({"signals": signals})

    # ── poll_incoming_call ────────────────────────────────────────────────────
    if action == "poll_incoming_call":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        since = int(body.get("since") or params.get("since") or (int(time.time()) - 30))
        cur.execute(
            f"""SELECT cs.call_id, cs.from_user_id, u.name, cs.created_at
                FROM {SCHEMA}.call_signals cs
                JOIN {SCHEMA}.users u ON u.id = cs.from_user_id
                WHERE cs.to_user_id = %s AND cs.type = 'offer' AND cs.created_at > %s
                ORDER BY cs.created_at DESC LIMIT 1""",
            (int(user_id), since)
        )
        row = cur.fetchone()
        conn.close()
        if row:
            return ok({"call": {"call_id": row[0], "from_user_id": row[1], "from_name": row[2], "created_at": row[3]}})
        return ok({"call": None})

    # ── set_chat_setting (muted / pinned / favorite) ─────────────────────────
    if action == "set_chat_setting":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        chat_id = body.get("chat_id")
        field = body.get("field")  # muted | pinned | favorite
        value = bool(body.get("value"))
        if not chat_id or field not in ("muted", "pinned", "favorite"):
            conn.close()
            return err("Неверные параметры")
        if not _is_chat_member(cur, int(chat_id), int(user_id)):
            conn.close()
            return err("Нет доступа к чату", 403)
        cur.execute(
            f"""INSERT INTO {SCHEMA}.chat_settings (user_id, chat_id, {field})
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, chat_id) DO UPDATE SET {field} = EXCLUDED.{field}""",
            (int(user_id), int(chat_id), value)
        )
        conn.close()
        return ok({"ok": True, "field": field, "value": value})

    # ── clear_history ─────────────────────────────────────────────────────────
    if action == "clear_history":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        chat_id = body.get("chat_id")
        if not chat_id:
            conn.close()
            return err("Укажите chat_id")
        ts = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.chat_settings (user_id, chat_id, cleared_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, chat_id) DO UPDATE SET cleared_at = EXCLUDED.cleared_at""",
            (int(user_id), int(chat_id), ts)
        )
        conn.close()
        return ok({"ok": True, "cleared_at": ts})

    # ── clear_group_history ───────────────────────────────────────────────────
    if action == "clear_group_history":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        group_id = body.get("group_id")
        if not group_id:
            conn.close()
            return err("Укажите group_id")
        ts = int(time.time())
        cur.execute(
            f"""UPDATE {SCHEMA}.group_members
                SET cleared_at = %s
                WHERE group_id = %s AND user_id = %s""",
            (ts, int(group_id), int(user_id))
        )
        if cur.rowcount == 0:
            conn.close()
            return err("Нет доступа", 403)
        conn.close()
        return ok({"ok": True, "cleared_at": ts})

    # ── block_user / unblock_user ─────────────────────────────────────────────
    if action == "block_user":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        target = body.get("target_user_id")
        if not target:
            conn.close()
            return err("Укажите target_user_id")
        cur.execute(
            f"""INSERT INTO {SCHEMA}.user_blocks (blocker_id, blocked_id, created_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (blocker_id, blocked_id) DO NOTHING""",
            (int(user_id), int(target), int(time.time()))
        )
        conn.close()
        return ok({"ok": True, "blocked": True})

    if action == "unblock_user":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        target = body.get("target_user_id")
        if not target:
            conn.close()
            return err("Укажите target_user_id")
        cur.execute(
            f"DELETE FROM {SCHEMA}.user_blocks WHERE blocker_id = %s AND blocked_id = %s",
            (int(user_id), int(target))
        )
        conn.close()
        return ok({"ok": True, "blocked": False})

    if action == "is_blocked":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        target = body.get("target_user_id") or params.get("target_user_id")
        if not target:
            conn.close()
            return err("Укажите target_user_id")
        cur.execute(
            f"SELECT 1 FROM {SCHEMA}.user_blocks WHERE blocker_id = %s AND blocked_id = %s",
            (int(user_id), int(target))
        )
        is_b = cur.fetchone() is not None
        conn.close()
        return ok({"blocked": is_b})

    if action == "report":
        if not user_id:
            conn.close()
            return err("Need X-User-Id")
        # Rate-limit: max 5 reports per minute per user
        if not _rate_limit(cur, f"report:{user_id}", 5):
            conn.close()
            return err("Too many reports. Please wait a minute.", 429)
        target = body.get("reported_user_id")
        if not target:
            conn.close()
            return err("reported_user_id is required")
        try:
            target_int = int(target)
            reporter_int = int(user_id)
        except (TypeError, ValueError):
            conn.close()
            return err("Invalid user id")
        if target_int == reporter_int:
            conn.close()
            return err("You cannot report yourself")
        ALLOWED_REASONS = {"spam", "abuse", "scam", "violence", "porn", "other"}
        reason = (body.get("reason") or "other").strip().lower()
        if reason not in ALLOWED_REASONS:
            reason = "other"
        comment = (body.get("comment") or "").strip()[:1000] or None
        chat_id = body.get("chat_id")
        try:
            chat_id_int = int(chat_id) if chat_id else None
        except (TypeError, ValueError):
            chat_id_int = None
        cur.execute(
            f"""INSERT INTO {SCHEMA}.reports
                (reporter_id, reported_user_id, chat_id, reason, comment, status, created_at)
                VALUES (%s, %s, %s, %s, %s, 'open', %s)""",
            (reporter_int, target_int, chat_id_int, reason, comment, int(time.time()))
        )
        conn.close()
        return ok({"ok": True, "reported": True})

    # ── favorites (pin message) ───────────────────────────────────────────────
    if action == "toggle_favorite_message":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        msg_id = body.get("message_id")
        if not msg_id:
            conn.close()
            return err("Укажите message_id")
        cur.execute(
            f"SELECT id FROM {SCHEMA}.favorite_messages WHERE user_id = %s AND message_id = %s",
            (int(user_id), int(msg_id))
        )
        existing = cur.fetchone()
        if existing:
            cur.execute(
                f"DELETE FROM {SCHEMA}.favorite_messages WHERE user_id = %s AND message_id = %s",
                (int(user_id), int(msg_id))
            )
            conn.close()
            return ok({"ok": True, "favorite": False})
        cur.execute(
            f"""INSERT INTO {SCHEMA}.favorite_messages (user_id, message_id, created_at)
                VALUES (%s, %s, %s)""",
            (int(user_id), int(msg_id), int(time.time()))
        )
        conn.close()
        return ok({"ok": True, "favorite": True})

    if action == "get_favorite_messages":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT m.id, m.chat_id, m.sender_id, m.text, m.created_at, u.name,
                       m.media_type, m.media_url, m.file_name
                FROM {SCHEMA}.favorite_messages fm
                JOIN {SCHEMA}.messages m ON m.id = fm.message_id
                JOIN {SCHEMA}.users u ON u.id = m.sender_id
                WHERE fm.user_id = %s
                ORDER BY fm.created_at DESC LIMIT 200""",
            (int(user_id),)
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"messages": [{
            "id": r[0], "chat_id": r[1], "sender_id": r[2], "text": r[3],
            "created_at": r[4], "sender_name": r[5],
            "media_type": r[6], "media_url": r[7], "file_name": r[8],
        } for r in rows]})

    # ── edit_message ──────────────────────────────────────────────────────────
    if action == "edit_message":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        msg_id = body.get("message_id")
        new_text = (body.get("text") or "").strip()
        if not msg_id or not new_text:
            conn.close()
            return err("Укажите message_id и text")
        cur.execute(
            f"SELECT sender_id, chat_id FROM {SCHEMA}.messages WHERE id = %s",
            (int(msg_id),)
        )
        row = cur.fetchone()
        if not row:
            conn.close()
            return err("Сообщение не найдено", 404)
        if int(row[0]) != int(user_id):
            conn.close()
            return err("Можно редактировать только свои сообщения", 403)
        now = int(time.time())
        cur.execute(
            f"UPDATE {SCHEMA}.messages SET text = %s, edited_at = %s WHERE id = %s",
            (new_text, now, int(msg_id))
        )
        # обновим last_message в чате если это последнее сообщение
        cur.execute(
            f"""SELECT id FROM {SCHEMA}.messages WHERE chat_id = %s
                ORDER BY created_at DESC LIMIT 1""",
            (int(row[1]),)
        )
        last = cur.fetchone()
        if last and int(last[0]) == int(msg_id):
            cur.execute(
                f"UPDATE {SCHEMA}.chats SET last_message = %s WHERE id = %s",
                (new_text[:100], int(row[1]))
            )
        conn.close()
        return ok({"ok": True, "edited_at": now})

    # ── pin_message / unpin_message / get_pinned ──────────────────────────────
    if action == "pin_message":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        msg_id = body.get("message_id")
        chat_id = body.get("chat_id")
        if not msg_id or not chat_id:
            conn.close()
            return err("Укажите message_id и chat_id")
        if not _is_chat_member(cur, int(chat_id), int(user_id)):
            conn.close()
            return err("Нет доступа к чату", 403)
        cur.execute(
            f"UPDATE {SCHEMA}.chats SET pinned_message_id = %s WHERE id = %s",
            (int(msg_id), int(chat_id))
        )
        conn.close()
        return ok({"ok": True})

    if action == "unpin_message":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        chat_id = body.get("chat_id")
        if not chat_id:
            conn.close()
            return err("Укажите chat_id")
        if not _is_chat_member(cur, int(chat_id), int(user_id)):
            conn.close()
            return err("Нет доступа к чату", 403)
        cur.execute(
            f"UPDATE {SCHEMA}.chats SET pinned_message_id = NULL WHERE id = %s",
            (int(chat_id),)
        )
        conn.close()
        return ok({"ok": True})

    if action == "get_pinned_message":
        chat_id = body.get("chat_id") or params.get("chat_id")
        if not chat_id:
            conn.close()
            return err("Укажите chat_id")
        cur.execute(
            f"""SELECT m.id, m.sender_id, u.name, m.text, m.media_type, m.created_at
                FROM {SCHEMA}.chats c
                JOIN {SCHEMA}.messages m ON m.id = c.pinned_message_id
                JOIN {SCHEMA}.users u ON u.id = m.sender_id
                WHERE c.id = %s""",
            (int(chat_id),)
        )
        row = cur.fetchone()
        conn.close()
        if not row:
            return ok({"pinned": None})
        return ok({"pinned": {
            "id": row[0], "sender_id": row[1], "sender_name": row[2],
            "text": row[3], "media_type": row[4], "created_at": row[5],
        }})

    # ── archive_chat / unarchive_chat ─────────────────────────────────────────
    if action == "archive_chat":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        chat_id = body.get("chat_id")
        archived = bool(body.get("archived", True))
        if not chat_id:
            conn.close()
            return err("Укажите chat_id")
        cur.execute(
            f"""INSERT INTO {SCHEMA}.chat_settings (user_id, chat_id, archived)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, chat_id) DO UPDATE SET archived = EXCLUDED.archived""",
            (int(user_id), int(chat_id), archived)
        )
        conn.close()
        return ok({"ok": True, "archived": archived})

    # ── forward_message (создаёт новое сообщение в указанном чате) ────────────
    if action == "forward_message":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        src_id = body.get("message_id")
        target_chat_id = body.get("target_chat_id")
        if not src_id or not target_chat_id:
            conn.close()
            return err("Укажите message_id и target_chat_id")
        cur.execute(
            f"""SELECT m.text, m.media_type, m.media_url, m.image_url, m.file_name, m.file_size,
                       m.duration, m.sender_id, u.name
                FROM {SCHEMA}.messages m
                JOIN {SCHEMA}.users u ON u.id = m.sender_id
                WHERE m.id = %s""",
            (int(src_id),)
        )
        s = cur.fetchone()
        if not s:
            conn.close()
            return err("Сообщение не найдено", 404)
        text, m_type, m_url, img_url, f_name, f_size, dur, orig_sender, orig_name = s
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.messages
                (chat_id, sender_id, text, image_url, media_type, media_url, file_name, file_size, duration, created_at,
                 forwarded_from_user_id, forwarded_from_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (int(target_chat_id), int(user_id), text or "", img_url, m_type, m_url, f_name, f_size, dur, now,
             int(orig_sender), orig_name)
        )
        new_id = cur.fetchone()[0]
        cur.execute(
            f"UPDATE {SCHEMA}.chats SET last_message = %s, last_message_at = %s WHERE id = %s",
            ((text or "[медиа]")[:100], now, int(target_chat_id))
        )
        conn.close()
        return ok({"id": new_id, "created_at": now})

    # ── create_group ──────────────────────────────────────────────────────────
    if action == "create_group":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        name = (body.get("name") or "").strip()
        if not name:
            conn.close()
            return err("Укажите name")
        description = (body.get("description") or "").strip()[:500]
        avatar_url = body.get("avatar_url") or None
        is_channel = bool(body.get("is_channel", False))
        member_ids = body.get("member_ids") or []
        now = int(time.time())
        import secrets
        invite = secrets.token_urlsafe(12)
        cur.execute(
            f"""INSERT INTO {SCHEMA}.groups
                (name, description, avatar_url, owner_id, is_channel, invite_link, created_at, last_message_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (name, description, avatar_url, int(user_id), is_channel, invite, now, now)
        )
        group_id = cur.fetchone()[0]
        cur.execute(
            f"INSERT INTO {SCHEMA}.group_members (group_id, user_id, role, joined_at) VALUES (%s, %s, 'owner', %s)",
            (group_id, int(user_id), now)
        )
        for mid in member_ids:
            try:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.group_members (group_id, user_id, role, joined_at) VALUES (%s, %s, 'member', %s) ON CONFLICT DO NOTHING",
                    (group_id, int(mid), now)
                )
            except Exception:
                pass
        conn.close()
        return ok({"group": {"id": group_id, "name": name, "description": description,
                             "avatar_url": avatar_url, "owner_id": int(user_id),
                             "is_channel": is_channel, "invite_link": invite,
                             "created_at": now, "members_count": 1 + len(member_ids)}})

    # ── get_groups ────────────────────────────────────────────────────────────
    if action == "get_groups":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT g.id, g.name, g.description, g.avatar_url, g.owner_id, g.is_channel,
                       g.last_message, g.last_message_at, g.invite_link,
                       COUNT(gm2.user_id) AS members_count,
                       (
                           SELECT COUNT(*) FROM {SCHEMA}.group_messages m
                           WHERE m.group_id = g.id
                             AND m.removed_at IS NULL
                             AND m.sender_id <> %s
                             AND m.created_at > COALESCE(gm.cleared_at, 0)
                             AND NOT EXISTS (
                                 SELECT 1 FROM {SCHEMA}.group_message_views v
                                 WHERE v.message_id = m.id AND v.user_id = %s
                             )
                       ) AS unread_count
                FROM {SCHEMA}.groups g
                JOIN {SCHEMA}.group_members gm ON gm.group_id = g.id AND gm.user_id = %s AND gm.role <> 'removed'
                JOIN {SCHEMA}.group_members gm2 ON gm2.group_id = g.id
                GROUP BY g.id, gm.cleared_at
                ORDER BY g.last_message_at DESC NULLS LAST""",
            (int(user_id), int(user_id), int(user_id))
        )
        rows = cur.fetchall()
        groups = []
        for r in rows:
            groups.append({
                "id": r[0], "name": r[1], "description": r[2], "avatar_url": r[3],
                "owner_id": r[4], "is_channel": r[5], "last_message": r[6] or "",
                "last_message_at": r[7], "invite_link": r[8], "members_count": r[9],
                "unread_count": r[10] or 0
            })
        conn.close()
        return ok({"groups": groups})

    # ── get_group_messages ────────────────────────────────────────────────────
    if action == "get_group_messages":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        group_id = body.get("group_id") or params.get("group_id")
        since = int(body.get("since") or params.get("since") or 0)
        if not group_id:
            conn.close()
            return err("Укажите group_id")
        cur.execute(
            f"SELECT COALESCE(cleared_at, 0) FROM {SCHEMA}.group_members WHERE group_id=%s AND user_id=%s",
            (int(group_id), int(user_id))
        )
        member_row = cur.fetchone()
        if not member_row:
            conn.close()
            return err("Нет доступа", 403)
        cleared_at = int(member_row[0] or 0)
        effective_since = max(since, cleared_at)
        cur.execute(
            f"""SELECT m.id, m.sender_id, u.name, u.avatar_url, m.text,
                       m.media_type, m.media_url, m.file_name, m.file_size, m.duration,
                       m.reply_to_id, m.created_at, m.edited_at, m.kind
                FROM {SCHEMA}.group_messages m
                JOIN {SCHEMA}.users u ON u.id = m.sender_id
                WHERE m.group_id = %s AND m.removed_at IS NULL AND m.created_at > %s
                ORDER BY m.created_at ASC
                LIMIT 200""",
            (int(group_id), effective_since)
        )
        rows = cur.fetchall()

        # Отмечаем чужие сообщения прочитанными текущим пользователем
        incoming_ids = [r[0] for r in rows if r[1] != int(user_id)]
        if incoming_ids:
            now_v = int(time.time())
            args = []
            values_sql = []
            for mid in incoming_ids:
                values_sql.append("(%s, %s, %s)")
                args.extend([mid, int(user_id), now_v])
            cur.execute(
                f"""INSERT INTO {SCHEMA}.group_message_views (message_id, user_id, viewed_at)
                    VALUES {','.join(values_sql)}
                    ON CONFLICT (message_id, user_id) DO NOTHING""",
                args
            )

        # Для своих сообщений выясняем, прочитал ли их кто-то ещё (две галочки)
        own_ids = [r[0] for r in rows if r[1] == int(user_id)]
        read_set = set()
        if own_ids:
            placeholders = ','.join(['%s'] * len(own_ids))
            cur.execute(
                f"""SELECT DISTINCT message_id FROM {SCHEMA}.group_message_views
                    WHERE message_id IN ({placeholders}) AND user_id != %s""",
                own_ids + [int(user_id)]
            )
            read_set = {row[0] for row in cur.fetchall()}

        # Реакции на сообщения группы
        all_ids = [r[0] for r in rows]
        reactions_map: dict = {}
        if all_ids:
            placeholders = ','.join(['%s'] * len(all_ids))
            cur.execute(
                f"""SELECT gr.message_id, gr.emoji, gr.user_id, u.name
                    FROM {SCHEMA}.group_message_reactions gr
                    JOIN {SCHEMA}.users u ON u.id = gr.user_id
                    WHERE gr.message_id IN ({placeholders}) AND gr.emoji <> '__removed__'""",
                all_ids
            )
            for rr in cur.fetchall():
                reactions_map.setdefault(rr[0], []).append({
                    "emoji": rr[1], "user_id": rr[2], "user_name": rr[3]
                })

        messages = []
        for r in rows:
            is_out = r[1] == int(user_id)
            messages.append({
                "id": r[0], "sender_id": r[1], "sender_name": r[2],
                "sender_avatar": r[3], "text": r[4] or "",
                "media_type": r[5], "media_url": r[6],
                "file_name": r[7], "file_size": r[8], "duration": r[9],
                "reply_to_id": r[10], "created_at": r[11],
                "edited_at": r[12], "kind": r[13] or "text",
                "out": is_out,
                "read": (r[0] in read_set) if is_out else False,
                "reactions": reactions_map.get(r[0], []),
            })
        conn.close()
        return ok({"messages": messages})

    # ── send_group_message ────────────────────────────────────────────────────
    if action == "send_group_message":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        group_id = body.get("group_id")
        text = (body.get("text") or "").strip()
        media_type = body.get("media_type")
        media_url = body.get("media_url")
        file_name = body.get("file_name")
        file_size = body.get("file_size")
        duration = body.get("duration")
        reply_to_id = body.get("reply_to_id")
        if not group_id:
            conn.close()
            return err("Укажите group_id")
        if not text and not media_url:
            conn.close()
            return err("Укажите text или media_url")
        # Одним запросом: проверка членства + тип группы (канал/чат) + название
        cur.execute(
            f"""SELECT gm.role, COALESCE(g.is_channel, FALSE), g.name
                FROM {SCHEMA}.groups g
                LEFT JOIN {SCHEMA}.group_members gm
                  ON gm.group_id = g.id AND gm.user_id = %s
                WHERE g.id = %s""",
            (int(user_id), int(group_id))
        )
        gr = cur.fetchone()
        if not gr:
            conn.close()
            return err("Группа не найдена", 404)
        role, is_channel, group_name = gr
        if not role:
            conn.close()
            return err("Нет доступа", 403)
        if is_channel and role not in ('owner', 'admin'):
            conn.close()
            return err("В канал могут писать только владельцы и администраторы", 403)
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.group_messages
                (group_id, sender_id, text, media_type, media_url, file_name, file_size, duration, reply_to_id, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (int(group_id), int(user_id), text or "", media_type, media_url,
             file_name, file_size, duration, reply_to_id, now)
        )
        msg_id = cur.fetchone()[0]
        last_msg = text[:100] if text else ("[медиа]")
        cur.execute(
            f"UPDATE {SCHEMA}.groups SET last_message=%s, last_message_at=%s WHERE id=%s",
            (last_msg, now, int(group_id))
        )
        # Обновим last_seen отправителя
        cur.execute(f"UPDATE {SCHEMA}.users SET last_seen=%s WHERE id=%s", (now, int(user_id)))
        conn.close()

        # Push-уведомления участникам группы — в фоне, чтобы не задерживать ответ
        push_url = os.environ.get("PUSH_NOTIFY_URL", "")
        if push_url:
            push_body = json.dumps({
                "action": "send_group",
                "group_id": int(group_id),
                "group_name": group_name or "",
                "sender_id": int(user_id),
                "message": (text[:100] if text else "[медиа]"),
                "message_id": int(msg_id),
                "is_channel": bool(is_channel),
            }).encode("utf-8")
            _fire_and_forget_http(push_url, push_body, timeout=5.0)

        return ok({"id": msg_id, "created_at": now})

    # ── add_group_reaction ────────────────────────────────────────────────────
    if action == "add_group_reaction":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        msg_id = body.get("message_id")
        emoji = (body.get("emoji") or "").strip()
        if not msg_id or not emoji:
            conn.close()
            return err("Укажите message_id и emoji")
        # Проверяем, что пользователь — участник группы этого сообщения
        cur.execute(
            f"""SELECT 1 FROM {SCHEMA}.group_messages m
                JOIN {SCHEMA}.group_members gm ON gm.group_id = m.group_id AND gm.user_id = %s
                WHERE m.id = %s AND gm.role <> 'removed'""",
            (int(user_id), int(msg_id))
        )
        if not cur.fetchone():
            conn.close()
            return err("Нет доступа", 403)
        now = int(time.time())
        cur.execute(
            f"SELECT id, emoji FROM {SCHEMA}.group_message_reactions WHERE message_id = %s AND user_id = %s",
            (int(msg_id), int(user_id))
        )
        existing = cur.fetchone()
        if existing and existing[1] == emoji:
            cur.execute(f"DELETE FROM {SCHEMA}.group_message_reactions WHERE id = %s", (existing[0],))
            conn.close()
            return ok({"ok": True, "removed": True})
        cur.execute(
            f"""INSERT INTO {SCHEMA}.group_message_reactions (message_id, user_id, emoji, created_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = EXCLUDED.created_at""",
            (int(msg_id), int(user_id), emoji, now)
        )
        conn.close()
        return ok({"ok": True})

    # ── delete_group_message ──────────────────────────────────────────────────
    if action == "delete_group_message":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        msg_id = body.get("message_id")
        if not msg_id:
            conn.close()
            return err("Укажите message_id")
        # Автор может удалить своё; владелец/админ — любое в своей группе
        cur.execute(
            f"""SELECT m.sender_id, m.group_id, gm.role
                FROM {SCHEMA}.group_messages m
                LEFT JOIN {SCHEMA}.group_members gm ON gm.group_id = m.group_id AND gm.user_id = %s
                WHERE m.id = %s""",
            (int(user_id), int(msg_id))
        )
        row = cur.fetchone()
        if not row:
            conn.close()
            return err("Сообщение не найдено", 404)
        sender_id, group_id, role = row
        if not role or role == 'removed':
            conn.close()
            return err("Нет доступа", 403)
        if sender_id != int(user_id) and role not in ('owner', 'admin'):
            conn.close()
            return err("Можно удалять только свои сообщения", 403)
        now = int(time.time())
        cur.execute(
            f"UPDATE {SCHEMA}.group_messages SET removed_at = %s WHERE id = %s",
            (now, int(msg_id))
        )
        conn.close()
        return ok({"ok": True})

    # ── edit_group_message ────────────────────────────────────────────────────
    if action == "edit_group_message":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        msg_id = body.get("message_id")
        new_text = (body.get("text") or "").strip()
        if not msg_id or not new_text:
            conn.close()
            return err("Укажите message_id и text")
        cur.execute(
            f"SELECT sender_id FROM {SCHEMA}.group_messages WHERE id = %s AND removed_at IS NULL",
            (int(msg_id),)
        )
        row = cur.fetchone()
        if not row:
            conn.close()
            return err("Сообщение не найдено", 404)
        if row[0] != int(user_id):
            conn.close()
            return err("Можно изменять только свои сообщения", 403)
        now = int(time.time())
        cur.execute(
            f"UPDATE {SCHEMA}.group_messages SET text = %s, edited_at = %s WHERE id = %s",
            (new_text[:4000], now, int(msg_id))
        )
        conn.close()
        return ok({"ok": True, "edited_at": now})

    # ── search_group_messages ─────────────────────────────────────────────────
    if action == "search_group_messages":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        group_id = body.get("group_id")
        query = (body.get("query") or "").strip()
        if not group_id or not query:
            conn.close()
            return err("Укажите group_id и query")
        cur.execute(
            f"SELECT COALESCE(cleared_at, 0) FROM {SCHEMA}.group_members WHERE group_id=%s AND user_id=%s AND role <> 'removed'",
            (int(group_id), int(user_id))
        )
        mrow = cur.fetchone()
        if not mrow:
            conn.close()
            return err("Нет доступа", 403)
        cleared_at = int(mrow[0] or 0)
        like = "%" + query.replace("%", "\\%").replace("_", "\\_") + "%"
        cur.execute(
            f"""SELECT m.id, m.sender_id, u.name, m.text, m.created_at
                FROM {SCHEMA}.group_messages m
                JOIN {SCHEMA}.users u ON u.id = m.sender_id
                WHERE m.group_id = %s AND m.removed_at IS NULL
                  AND m.created_at > %s AND m.text ILIKE %s
                ORDER BY m.created_at DESC
                LIMIT 50""",
            (int(group_id), cleared_at, like)
        )
        results = [{
            "id": r[0], "sender_id": r[1], "sender_name": r[2],
            "text": r[3] or "", "created_at": r[4]
        } for r in cur.fetchall()]
        conn.close()
        return ok({"results": results})

    # ── get_group_members ─────────────────────────────────────────────────────
    if action == "get_group_members":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        group_id = body.get("group_id") or params.get("group_id")
        if not group_id:
            conn.close()
            return err("Укажите group_id")
        cur.execute(
            f"SELECT 1 FROM {SCHEMA}.group_members WHERE group_id=%s AND user_id=%s",
            (int(group_id), int(user_id))
        )
        if not cur.fetchone():
            conn.close()
            return err("Нет доступа", 403)
        cur.execute(
            f"""SELECT u.id, u.name, u.avatar_url, u.last_seen, gm.role, gm.joined_at
                FROM {SCHEMA}.group_members gm
                JOIN {SCHEMA}.users u ON u.id = gm.user_id
                WHERE gm.group_id = %s
                ORDER BY gm.role DESC, gm.joined_at ASC""",
            (int(group_id),)
        )
        rows = cur.fetchall()
        members = [{"id": r[0], "name": r[1], "avatar_url": r[2],
                    "last_seen": r[3], "role": r[4], "joined_at": r[5]} for r in rows]
        conn.close()
        return ok({"members": members})

    # ── add_group_member ──────────────────────────────────────────────────────
    if action == "add_group_member":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        group_id = body.get("group_id")
        new_user_id = body.get("new_user_id")
        if not group_id or not new_user_id:
            conn.close()
            return err("Укажите group_id и new_user_id")
        cur.execute(
            f"SELECT role FROM {SCHEMA}.group_members WHERE group_id=%s AND user_id=%s",
            (int(group_id), int(user_id))
        )
        me = cur.fetchone()
        if not me or me[0] not in ('owner', 'admin'):
            conn.close()
            return err("Только владелец или администратор может добавлять участников", 403)
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.group_members (group_id, user_id, role, joined_at)
                VALUES (%s, %s, 'member', %s) ON CONFLICT (group_id, user_id) DO NOTHING""",
            (int(group_id), int(new_user_id), now)
        )
        conn.close()
        return ok({"ok": True})

    # ── remove_group_member ───────────────────────────────────────────────────
    if action == "remove_group_member":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        group_id = body.get("group_id")
        kick_user_id = body.get("kick_user_id")
        if not group_id:
            conn.close()
            return err("Укажите group_id")
        cur.execute(
            f"SELECT role FROM {SCHEMA}.group_members WHERE group_id=%s AND user_id=%s",
            (int(group_id), int(user_id))
        )
        me = cur.fetchone()
        is_self_leave = str(kick_user_id) == str(user_id)
        if not is_self_leave and (not me or me[0] not in ('owner', 'admin')):
            conn.close()
            return err("Недостаточно прав", 403)
        cur.execute(
            f"UPDATE {SCHEMA}.group_members SET role='removed' WHERE group_id=%s AND user_id=%s",
            (int(group_id), int(kick_user_id or user_id))
        )
        conn.close()
        return ok({"ok": True})

    # ── update_group ──────────────────────────────────────────────────────────
    if action == "update_group":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        group_id = body.get("group_id")
        if not group_id:
            conn.close()
            return err("Укажите group_id")
        cur.execute(
            f"SELECT role FROM {SCHEMA}.group_members WHERE group_id=%s AND user_id=%s",
            (int(group_id), int(user_id))
        )
        me = cur.fetchone()
        if not me or me[0] not in ('owner', 'admin'):
            conn.close()
            return err("Только владелец или администратор", 403)
        fields = []
        vals = []
        if "name" in body and body["name"].strip():
            fields.append("name=%s"); vals.append(body["name"].strip()[:100])
        if "description" in body:
            fields.append("description=%s"); vals.append((body["description"] or "").strip()[:500])
        if "avatar_url" in body:
            fields.append("avatar_url=%s"); vals.append(body["avatar_url"] or None)
        if not fields:
            conn.close()
            return err("Нет полей для обновления")
        vals.append(int(group_id))
        cur.execute(f"UPDATE {SCHEMA}.groups SET {', '.join(fields)} WHERE id=%s", vals)
        conn.close()
        return ok({"ok": True})

    # ── get_group_info ────────────────────────────────────────────────────────
    if action == "get_group_info":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            gid = int(body.get("group_id") or 0)
        except Exception:
            conn.close(); return err("Неверный group_id")
        # Проверка членства
        cur.execute(
            f"SELECT role FROM {SCHEMA}.group_members WHERE group_id=%s AND user_id=%s",
            (gid, int(user_id))
        )
        me = cur.fetchone()
        if not me or me[0] == 'removed':
            conn.close(); return err("Нет доступа", 403)
        cur.execute(
            f"""SELECT g.id, g.name, g.description, g.avatar_url, g.owner_id, g.is_channel,
                       g.invite_link, g.created_at, g.last_message, g.last_message_at,
                       (SELECT COUNT(*) FROM {SCHEMA}.group_members gm WHERE gm.group_id=g.id AND gm.role!='removed') AS members_count
                FROM {SCHEMA}.groups g WHERE g.id=%s""",
            (gid,)
        )
        r = cur.fetchone()
        if not r:
            conn.close(); return err("Группа не найдена", 404)
        conn.close()
        return ok({"group": {
            "id": r[0], "name": r[1], "description": r[2] or "",
            "avatar_url": r[3], "owner_id": r[4], "is_channel": bool(r[5]),
            "invite_link": r[6], "created_at": int(r[7] or 0),
            "last_message": r[8] or "", "last_message_at": int(r[9] or 0),
            "members_count": int(r[10] or 0),
            "my_role": me[0],
        }})

    # ── regenerate_group_invite ───────────────────────────────────────────────
    if action == "regenerate_group_invite":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            gid = int(body.get("group_id") or 0)
        except Exception:
            conn.close(); return err("Неверный group_id")
        cur.execute(
            f"SELECT role FROM {SCHEMA}.group_members WHERE group_id=%s AND user_id=%s",
            (gid, int(user_id))
        )
        me = cur.fetchone()
        if not me or me[0] not in ('owner', 'admin'):
            conn.close(); return err("Только владелец или админ может перегенерировать ссылку", 403)
        import secrets as _secrets
        invite = _secrets.token_urlsafe(12)
        cur.execute(
            f"UPDATE {SCHEMA}.groups SET invite_link=%s WHERE id=%s",
            (invite, gid)
        )
        conn.close()
        return ok({"invite_link": invite})

    # ── join_by_invite ────────────────────────────────────────────────────────
    if action == "join_by_invite":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        invite = (body.get("invite_link") or body.get("invite") or "").strip()
        if not invite:
            conn.close(); return err("Укажите invite_link")
        # Универсальный парсинг: поддерживаем форматы
        #   abc123                                  → "abc123"
        #   nova.app/join/abc123                    → "abc123"
        #   https://nova.app/join/abc123?ref=x      → "abc123"
        #   https://t.me/+abc123                    → "abc123"
        #   @abc123                                 → "abc123"
        #   12345 (числовой id группы)              → ищем по groups.id
        raw = invite
        # отрезаем query/hash
        for sep in ("?", "#"):
            if sep in raw:
                raw = raw.split(sep, 1)[0]
        # отрезаем протокол и домен — берём последний сегмент пути
        code = raw.rsplit("/", 1)[-1].strip()
        # убираем префиксы @ и + (telegram-like)
        code = code.lstrip("@+").strip()
        if not code:
            conn.close(); return err("Некорректная ссылка-приглашение")
        rr = None
        # 1) точное совпадение invite_link
        cur.execute(
            f"SELECT id, name, is_channel FROM {SCHEMA}.groups WHERE invite_link=%s LIMIT 1",
            (code,)
        )
        rr = cur.fetchone()
        # 2) по числовому id группы (как fallback)
        if not rr and code.isdigit():
            cur.execute(
                f"SELECT id, name, is_channel FROM {SCHEMA}.groups WHERE id=%s LIMIT 1",
                (int(code),)
            )
            rr = cur.fetchone()
        # 3) по имени группы (без учёта регистра, точное)
        if not rr:
            cur.execute(
                f"SELECT id, name, is_channel FROM {SCHEMA}.groups WHERE LOWER(name)=LOWER(%s) LIMIT 1",
                (code,)
            )
            rr = cur.fetchone()
        # 4) частичное совпадение invite_link (на всякий случай для старых форматов)
        if not rr:
            cur.execute(
                f"SELECT id, name, is_channel FROM {SCHEMA}.groups WHERE invite_link LIKE %s LIMIT 1",
                (f"%{code}",)
            )
            rr = cur.fetchone()
        if not rr:
            conn.close(); return err("Приглашение не найдено", 404)
        gid = int(rr[0])
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.group_members (group_id, user_id, role, joined_at)
                VALUES (%s, %s, 'member', %s)
                ON CONFLICT (group_id, user_id) DO UPDATE SET role = CASE
                    WHEN {SCHEMA}.group_members.role='removed' THEN 'member'
                    ELSE {SCHEMA}.group_members.role END""",
            (gid, int(user_id), now)
        )
        conn.close()
        return ok({"ok": True, "group_id": gid, "name": rr[1], "is_channel": bool(rr[2])})

    # ── leave_group ───────────────────────────────────────────────────────────
    if action == "leave_group":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            gid = int(body.get("group_id") or 0)
        except Exception:
            conn.close(); return err("Неверный group_id")
        if gid <= 0:
            conn.close(); return err("Укажите group_id")
        cur.execute(f"SELECT owner_id FROM {SCHEMA}.groups WHERE id=%s", (gid,))
        rr = cur.fetchone()
        if not rr:
            conn.close(); return err("Группа не найдена", 404)
        if int(rr[0]) == int(user_id):
            conn.close(); return err("Владелец не может выйти. Удалите группу или передайте права.", 400)
        cur.execute(
            f"UPDATE {SCHEMA}.group_members SET role='removed' WHERE group_id=%s AND user_id=%s",
            (gid, int(user_id))
        )
        conn.close()
        return ok({"ok": True})

    # ── delete_group ──────────────────────────────────────────────────────────
    if action == "delete_group":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            gid = int(body.get("group_id") or 0)
        except Exception:
            conn.close(); return err("Неверный group_id")
        cur.execute(f"SELECT owner_id FROM {SCHEMA}.groups WHERE id=%s", (gid,))
        rr = cur.fetchone()
        if not rr:
            conn.close(); return err("Группа не найдена", 404)
        if int(rr[0]) != int(user_id):
            conn.close(); return err("Только владелец может удалить", 403)
        # Каскадное удаление зависимостей
        cleanup_queries = [
            f"DELETE FROM {SCHEMA}.group_message_reactions WHERE message_id IN (SELECT id FROM {SCHEMA}.group_messages WHERE group_id=%s)",
            f"DELETE FROM {SCHEMA}.group_message_views WHERE message_id IN (SELECT id FROM {SCHEMA}.group_messages WHERE group_id=%s)",
            f"DELETE FROM {SCHEMA}.group_messages WHERE group_id=%s",
            f"DELETE FROM {SCHEMA}.group_members WHERE group_id=%s",
        ]
        for q in cleanup_queries:
            try:
                cur.execute(q, (gid,))
            except Exception:
                conn.rollback(); cur = conn.cursor()
        try:
            cur.execute(f"DELETE FROM {SCHEMA}.groups WHERE id=%s", (gid,))
            conn.close()
            return ok({"ok": True})
        except Exception as e:
            conn.close()
            return err(f"Не удалось удалить: {e}", 500)

    # ── search_channels — публичный поиск ─────────────────────────────────────
    if action == "search_channels":
        q = (body.get("q") or "").strip()
        if not q:
            conn.close(); return ok({"items": []})
        # Поддержка короткого запроса (>=1 символ для удобства)
        cur.execute(
            f"""SELECT g.id, g.name, COALESCE(g.description, '') AS description,
                       g.avatar_url, g.is_channel,
                       (SELECT COUNT(*) FROM {SCHEMA}.group_members gm WHERE gm.group_id=g.id AND gm.role!='removed') AS members
                FROM {SCHEMA}.groups g
                WHERE (g.name ILIKE %s OR COALESCE(g.description, '') ILIKE %s)
                ORDER BY members DESC, g.id DESC LIMIT 50""",
            (f"%{q}%", f"%{q}%")
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"items": [{
            "id": r[0], "name": r[1], "description": r[2], "avatar_url": r[3],
            "is_channel": bool(r[4]), "members_count": int(r[5] or 0),
        } for r in rows]})

    # ── set_member_role ───────────────────────────────────────────────────────
    if action == "set_member_role":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        group_id = body.get("group_id")
        target_id = body.get("target_user_id")
        role = body.get("role")
        if not group_id or not target_id or role not in ("admin", "member"):
            conn.close()
            return err("Укажите group_id, target_user_id, role (admin/member)")
        cur.execute(
            f"SELECT role FROM {SCHEMA}.group_members WHERE group_id=%s AND user_id=%s",
            (int(group_id), int(user_id))
        )
        me = cur.fetchone()
        if not me or me[0] != 'owner':
            conn.close()
            return err("Только владелец может менять роли", 403)
        cur.execute(
            f"UPDATE {SCHEMA}.group_members SET role=%s WHERE group_id=%s AND user_id=%s",
            (role, int(group_id), int(target_id))
        )
        conn.close()
        return ok({"ok": True})

    # ── wallet_balance ────────────────────────────────────────────────────────
    if action == "wallet_balance":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        cur.execute(f"SELECT COALESCE(wallet_balance, 0), pro_until FROM {SCHEMA}.users WHERE id = %s", (int(user_id),))
        r = cur.fetchone()
        conn.close()
        if not r:
            return err("Пользователь не найден", 404)
        return ok({"balance": float(r[0]), "pro_until": r[1], "is_pro": bool(r[1]) and int(r[1]) > int(time.time())})

    # ── wallet_history ────────────────────────────────────────────────────────
    if action == "wallet_history":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT id, amount, kind, description, balance_after, created_at
                FROM {SCHEMA}.wallet_transactions
                WHERE user_id = %s ORDER BY created_at DESC LIMIT 100""",
            (int(user_id),)
        )
        rows = cur.fetchall()
        conn.close()
        tx = [{"id": r[0], "amount": float(r[1]), "kind": r[2], "description": r[3] or "",
               "balance_after": float(r[4]), "created_at": r[5]} for r in rows]
        return ok({"transactions": tx})

    # ── wallet_topup (тестовое пополнение) ────────────────────────────────────
    if action == "wallet_topup":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        try:
            amount = float(body.get("amount") or 0)
        except (TypeError, ValueError):
            conn.close()
            return err("Неверная сумма")
        if amount <= 0 or amount > 100000:
            conn.close()
            return err("Сумма от 1 до 100000")
        description = (body.get("description") or "Пополнение через Dev Panel")[:200]
        cur.execute(
            f"UPDATE {SCHEMA}.users SET wallet_balance = COALESCE(wallet_balance,0) + %s WHERE id = %s RETURNING wallet_balance",
            (amount, int(user_id))
        )
        r = cur.fetchone()
        if not r:
            conn.close()
            return err("Пользователь не найден", 404)
        new_balance = float(r[0])
        cur.execute(
            f"""INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, kind, description, balance_after, created_at)
                VALUES (%s, %s, 'topup', %s, %s, %s)""",
            (int(user_id), amount, description, new_balance, int(time.time()))
        )
        conn.close()
        return ok({"balance": new_balance})

    # ── buy_pro (через кошелёк Nova) ──────────────────────────────────────────
    if action == "buy_pro":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        plan = body.get("plan") or "month"
        prices = {"month": 199.0, "year": 1490.0, "trial": 0.0}
        durations = {"month": 30 * 86400, "year": 365 * 86400, "trial": 3 * 86400}
        if plan not in prices:
            conn.close(); return err("plan: month | year | trial")
        price = prices[plan]
        duration = durations[plan]
        cur.execute(f"SELECT COALESCE(wallet_balance,0), COALESCE(pro_until,0), COALESCE(pro_trial_used,FALSE) FROM {SCHEMA}.users WHERE id = %s", (int(user_id),))
        r = cur.fetchone()
        if not r:
            conn.close(); return err("Пользователь не найден", 404)
        balance = float(r[0]); cur_until = int(r[1] or 0); trial_used = bool(r[2])
        now = int(time.time())
        if plan == "trial":
            if trial_used:
                conn.close(); return err("Пробный период уже был использован")
            new_until = max(cur_until, now) + duration
            cur.execute(f"UPDATE {SCHEMA}.users SET pro_until=%s, pro_trial_used=TRUE WHERE id=%s", (new_until, int(user_id)))
            cur.execute(
                f"""INSERT INTO {SCHEMA}.pro_subscriptions (user_id, plan, amount, source, starts_at, ends_at, is_trial, created_at)
                    VALUES (%s,'trial',0,'trial',%s,%s,TRUE,%s)""",
                (int(user_id), now, new_until, now)
            )
            conn.close()
            return ok({"balance": balance, "pro_until": new_until, "is_pro": True, "is_trial": True})
        # Демо-режим: если ЮKassa не настроена и средств не хватает — активируем без списания
        yk_configured = bool(os.environ.get("YOOKASSA_SHOP_ID") and os.environ.get("YOOKASSA_SECRET_KEY"))
        if balance < price and not yk_configured:
            new_until = max(cur_until, now) + duration
            cur.execute(f"UPDATE {SCHEMA}.users SET pro_until=%s WHERE id=%s", (new_until, int(user_id)))
            cur.execute(
                f"""INSERT INTO {SCHEMA}.pro_subscriptions (user_id, plan, amount, source, starts_at, ends_at, is_trial, created_at)
                    VALUES (%s,%s,0,'demo',%s,%s,FALSE,%s)""",
                (int(user_id), plan, now, new_until, now)
            )
            _grant_xp(cur, int(user_id), "pro_purchased")
            _award_badge(cur, int(user_id), "pro")
            conn.close()
            return ok({"balance": balance, "pro_until": new_until, "is_pro": True, "demo": True})
        if balance < price:
            conn.close(); return err(f"Недостаточно средств. Нужно {price}₽, на счету {balance}₽")
        new_until = max(cur_until, now) + duration
        new_balance = balance - price
        cur.execute(f"UPDATE {SCHEMA}.users SET wallet_balance=%s, pro_until=%s WHERE id=%s", (new_balance, new_until, int(user_id)))
        cur.execute(
            f"""INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, kind, description, balance_after, created_at)
                VALUES (%s, %s, 'pro_purchase', %s, %s, %s)""",
            (int(user_id), -price, f"Nova Pro ({plan})", new_balance, now)
        )
        cur.execute(
            f"""INSERT INTO {SCHEMA}.pro_subscriptions (user_id, plan, amount, source, starts_at, ends_at, is_trial, created_at)
                VALUES (%s,%s,%s,'wallet',%s,%s,FALSE,%s)""",
            (int(user_id), plan, price, now, new_until, now)
        )
        _grant_xp(cur, int(user_id), "pro_purchased")
        _award_badge(cur, int(user_id), "pro")
        conn.close()
        return ok({"balance": new_balance, "pro_until": new_until, "is_pro": True})

    # ── buy_stickers_subscription (100₽/мес) через кошелёк ────────────────────
    if action == "buy_stickers_subscription":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        price = 100.0
        cur.execute(f"SELECT COALESCE(wallet_balance,0), COALESCE(stickers_subscription_until,0) FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
        r = cur.fetchone()
        if not r:
            conn.close(); return err("Пользователь не найден", 404)
        balance = float(r[0]); cur_until = int(r[1] or 0)
        if balance < price:
            conn.close(); return err(f"Недостаточно средств. Нужно {price}₽")
        now = int(time.time())
        new_until = max(cur_until, now) + 30 * 86400
        new_balance = balance - price
        cur.execute(f"UPDATE {SCHEMA}.users SET wallet_balance=%s, stickers_subscription_until=%s WHERE id=%s", (new_balance, new_until, int(user_id)))
        cur.execute(
            f"""INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, kind, description, balance_after, created_at)
                VALUES (%s,%s,'stickers_subscription',%s,%s,%s)""",
            (int(user_id), -price, "Подписка на авторские стикеры", new_balance, now)
        )
        conn.close()
        return ok({"balance": new_balance, "stickers_subscription_until": new_until})

    # ── lightning_balance ─────────────────────────────────────────────────────
    if action == "lightning_balance":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        cur.execute(f"SELECT COALESCE(lightning_balance,0) FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
        r = cur.fetchone()
        conn.close()
        return ok({"lightning": int(r[0]) if r else 0})

    # ── lightning_history ─────────────────────────────────────────────────────
    if action == "lightning_history":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT id, amount, kind, description, related_user_id, balance_after, created_at
                FROM {SCHEMA}.lightning_transactions WHERE user_id=%s ORDER BY created_at DESC LIMIT 100""",
            (int(user_id),)
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"transactions": [
            {"id": r[0], "amount": int(r[1]), "kind": r[2], "description": r[3] or "",
             "related_user_id": r[4], "balance_after": int(r[5]), "created_at": int(r[6])}
            for r in rows
        ]})

    # ── lightning_buy (купить за рубли через кошелёк, курс 3₽=1⚡) ────────────
    if action == "lightning_buy":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            qty = int(body.get("quantity") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверное количество")
        if qty < 1 or qty > 1000000:
            conn.close(); return err("От 1 до 1000000 ⚡")
        price = qty * 3.0
        cur.execute(f"SELECT COALESCE(wallet_balance,0), COALESCE(lightning_balance,0) FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
        r = cur.fetchone()
        if not r:
            conn.close(); return err("Пользователь не найден", 404)
        balance = float(r[0]); lb = int(r[1] or 0)
        if balance < price:
            conn.close(); return err(f"Недостаточно средств. Нужно {price:.2f}₽")
        now = int(time.time())
        new_balance = balance - price
        new_lb = lb + qty
        cur.execute(f"UPDATE {SCHEMA}.users SET wallet_balance=%s, lightning_balance=%s WHERE id=%s", (new_balance, new_lb, int(user_id)))
        cur.execute(
            f"""INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, kind, description, balance_after, created_at)
                VALUES (%s,%s,'lightning_purchase',%s,%s,%s)""",
            (int(user_id), -price, f"Покупка {qty}⚡", new_balance, now)
        )
        cur.execute(
            f"""INSERT INTO {SCHEMA}.lightning_transactions (user_id, amount, kind, description, balance_after, created_at)
                VALUES (%s,%s,'purchase','Покупка молний',%s,%s)""",
            (int(user_id), qty, new_lb, now)
        )
        conn.close()
        return ok({"lightning": new_lb, "balance": new_balance})

    # ── lightning_send (подарить молнии другому) ──────────────────────────────
    if action == "lightning_send":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            qty = int(body.get("quantity") or 0)
            to_user = int(body.get("to_user_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверные параметры")
        message = (body.get("message") or "")[:200]
        if qty < 1 or qty > 100000:
            conn.close(); return err("От 1 до 100000 ⚡")
        if to_user <= 0 or to_user == int(user_id):
            conn.close(); return err("Нельзя отправить себе")
        cur.execute(f"SELECT COALESCE(lightning_balance,0) FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
        r = cur.fetchone()
        if not r:
            conn.close(); return err("Пользователь не найден", 404)
        my_lb = int(r[0] or 0)
        if my_lb < qty:
            conn.close(); return err(f"Недостаточно ⚡. У тебя {my_lb}, нужно {qty}")
        cur.execute(f"SELECT id, name, COALESCE(lightning_balance,0) FROM {SCHEMA}.users WHERE id=%s", (to_user,))
        rr = cur.fetchone()
        if not rr:
            conn.close(); return err("Получатель не найден", 404)
        recipient_name = rr[1] or "Друг"
        their_lb = int(rr[2] or 0)
        now = int(time.time())
        new_my = my_lb - qty
        new_their = their_lb + qty
        cur.execute(f"UPDATE {SCHEMA}.users SET lightning_balance=%s WHERE id=%s", (new_my, int(user_id)))
        cur.execute(f"UPDATE {SCHEMA}.users SET lightning_balance=%s WHERE id=%s", (new_their, to_user))
        cur.execute(
            f"""INSERT INTO {SCHEMA}.lightning_transactions (user_id, amount, kind, description, related_user_id, balance_after, created_at)
                VALUES (%s,%s,'sent',%s,%s,%s,%s)""",
            (int(user_id), -qty, f"Отправлено {recipient_name}", to_user, new_my, now)
        )
        cur.execute(
            f"""INSERT INTO {SCHEMA}.lightning_transactions (user_id, amount, kind, description, related_user_id, balance_after, created_at)
                VALUES (%s,%s,'received','Подарок ⚡',%s,%s,%s)""",
            (to_user, qty, int(user_id), new_their, now)
        )
        conn.close()
        return ok({"lightning": new_my, "sent": qty, "to_user": to_user, "to_name": recipient_name, "message": message})

    # ── fundraiser_create ─────────────────────────────────────────────────────
    if action == "fundraiser_create":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        title = (body.get("title") or "").strip()
        description = (body.get("description") or "").strip()[:1000]
        cover_url = body.get("cover_url") or None
        try:
            target = float(body.get("target_amount") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверная сумма")
        if not title or len(title) < 2:
            conn.close(); return err("Введите название сбора")
        if target < 100 or target > 10_000_000:
            conn.close(); return err("Сумма от 100 до 10 000 000 ₽")
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.fundraisers
                (owner_id, title, description, cover_url, target_amount, status, created_at)
                VALUES (%s,%s,%s,%s,%s,'active',%s) RETURNING id""",
            (int(user_id), title, description, cover_url, target, now)
        )
        fid = cur.fetchone()[0]
        _grant_xp(cur, int(user_id), "fundraiser_created")
        _award_badge(cur, int(user_id), "fundraiser")
        conn.close()
        return ok({"fundraiser_id": fid, "title": title, "target_amount": target})

    # ── fundraiser_get ────────────────────────────────────────────────────────
    if action == "fundraiser_get":
        try:
            fid = int(body.get("fundraiser_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный id")
        if fid <= 0:
            conn.close(); return err("Нужен fundraiser_id")
        cur.execute(
            f"""SELECT f.id, f.owner_id, u.name, u.avatar_url, f.title, f.description, f.cover_url,
                       f.target_amount, f.collected_amount, f.status, f.created_at, f.closed_at
                FROM {SCHEMA}.fundraisers f
                LEFT JOIN {SCHEMA}.users u ON u.id = f.owner_id
                WHERE f.id=%s""",
            (fid,)
        )
        r = cur.fetchone()
        if not r:
            conn.close(); return err("Сбор не найден", 404)
        cur.execute(
            f"""SELECT id, donor_id, donor_name, amount, message, is_anonymous, created_at
                FROM {SCHEMA}.fundraiser_payments
                WHERE fundraiser_id=%s AND status='paid'
                ORDER BY created_at DESC LIMIT 50""",
            (fid,)
        )
        donations = [
            {"id": d[0], "donor_id": d[1], "donor_name": ("Аноним" if d[5] else (d[2] or "Друг")),
             "amount": float(d[3]), "message": d[4] or "", "created_at": int(d[6])}
            for d in cur.fetchall()
        ]
        conn.close()
        return ok({"fundraiser": {
            "id": r[0], "owner_id": r[1], "owner_name": r[2] or "", "owner_avatar": r[3],
            "title": r[4], "description": r[5] or "", "cover_url": r[6],
            "target_amount": float(r[7]), "collected_amount": float(r[8]),
            "status": r[9], "created_at": int(r[10]), "closed_at": (int(r[11]) if r[11] else None),
            "donations": donations,
        }})

    # ── fundraiser_donate_wallet (с кошелька Nova) ────────────────────────────
    if action == "fundraiser_donate_wallet":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            fid = int(body.get("fundraiser_id") or 0)
            amount = float(body.get("amount") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверные параметры")
        message = (body.get("message") or "")[:200]
        is_anon = bool(body.get("is_anonymous"))
        if fid <= 0 or amount < 10 or amount > 1_000_000:
            conn.close(); return err("Сумма от 10 ₽")
        cur.execute(f"SELECT owner_id, status FROM {SCHEMA}.fundraisers WHERE id=%s", (fid,))
        f = cur.fetchone()
        if not f:
            conn.close(); return err("Сбор не найден", 404)
        if f[1] != 'active':
            conn.close(); return err("Сбор уже закрыт")
        cur.execute(f"SELECT name, COALESCE(wallet_balance,0) FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
        u = cur.fetchone()
        if not u:
            conn.close(); return err("Пользователь не найден", 404)
        donor_name = u[0] or "Друг"
        balance = float(u[1])
        if balance < amount:
            conn.close(); return err(f"Недостаточно средств. На счету {balance:.2f}₽")
        now = int(time.time())
        new_balance = balance - amount
        cur.execute(f"UPDATE {SCHEMA}.users SET wallet_balance=%s WHERE id=%s", (new_balance, int(user_id)))
        cur.execute(
            f"""INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, kind, description, balance_after, created_at)
                VALUES (%s,%s,'donation',%s,%s,%s)""",
            (int(user_id), -amount, f"Донат в сбор #{fid}", new_balance, now)
        )
        # Зачислим автору сбора
        cur.execute(f"UPDATE {SCHEMA}.users SET wallet_balance=COALESCE(wallet_balance,0)+%s WHERE id=%s RETURNING wallet_balance", (amount, int(f[0])))
        owner_balance = float(cur.fetchone()[0])
        cur.execute(
            f"""INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, kind, description, balance_after, created_at)
                VALUES (%s,%s,'fundraiser_income',%s,%s,%s)""",
            (int(f[0]), amount, f"Донат на сбор #{fid}", owner_balance, now)
        )
        cur.execute(
            f"""INSERT INTO {SCHEMA}.fundraiser_payments
                (fundraiser_id, donor_id, donor_name, amount, message, is_anonymous, source, status, created_at, paid_at)
                VALUES (%s,%s,%s,%s,%s,%s,'wallet','paid',%s,%s)""",
            (fid, int(user_id), donor_name, amount, message, is_anon, now, now)
        )
        cur.execute(
            f"UPDATE {SCHEMA}.fundraisers SET collected_amount=COALESCE(collected_amount,0)+%s WHERE id=%s RETURNING collected_amount, target_amount",
            (amount, fid)
        )
        rr = cur.fetchone()
        collected = float(rr[0]); target = float(rr[1])
        _grant_xp(cur, int(user_id), "fundraiser_donate")
        # Бейдж "Филантроп" — 3 разных сбора поддержано
        cur.execute(
            f"SELECT COUNT(DISTINCT fundraiser_id) FROM {SCHEMA}.fundraiser_payments WHERE donor_id=%s AND status='paid'",
            (int(user_id),)
        )
        funds_supported = int((cur.fetchone() or [0])[0] or 0)
        if funds_supported >= 3:
            _award_badge(cur, int(user_id), "philanthropist")
        conn.close()
        return ok({"balance": new_balance, "collected_amount": collected, "target_amount": target,
                   "completed": collected >= target})

    # ── fundraiser_close ──────────────────────────────────────────────────────
    if action == "fundraiser_close":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            fid = int(body.get("fundraiser_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный id")
        cur.execute(f"SELECT owner_id FROM {SCHEMA}.fundraisers WHERE id=%s", (fid,))
        r = cur.fetchone()
        if not r:
            conn.close(); return err("Сбор не найден", 404)
        if int(r[0]) != int(user_id):
            conn.close(); return err("Только автор может закрыть сбор", 403)
        now = int(time.time())
        cur.execute(f"UPDATE {SCHEMA}.fundraisers SET status='closed', closed_at=%s WHERE id=%s", (now, fid))
        conn.close()
        return ok({"status": "closed"})

    # ── stickers_list (магазин) ───────────────────────────────────────────────
    if action == "stickers_list":
        cur.execute(
            f"""SELECT id, author_id, title, description, cover_url, price, is_premium, total_sales, created_at
                FROM {SCHEMA}.sticker_packs WHERE is_published=TRUE ORDER BY total_sales DESC, id DESC LIMIT 100"""
        )
        packs = [
            {"id": r[0], "author_id": r[1], "title": r[2], "description": r[3] or "",
             "cover_url": r[4], "price": float(r[5]), "is_premium": bool(r[6]),
             "total_sales": int(r[7]), "created_at": int(r[8])}
            for r in cur.fetchall()
        ]
        owned_ids = []
        if user_id:
            cur.execute(f"SELECT pack_id FROM {SCHEMA}.user_sticker_packs WHERE user_id=%s", (int(user_id),))
            owned_ids = [int(x[0]) for x in cur.fetchall()]
        for p in packs:
            p["owned"] = p["id"] in owned_ids
        conn.close()
        return ok({"packs": packs})

    # ── stickers_pack_get ─────────────────────────────────────────────────────
    if action == "stickers_pack_get":
        try:
            pid = int(body.get("pack_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный id")
        cur.execute(
            f"""SELECT id, author_id, title, description, cover_url, price, is_premium, total_sales, created_at
                FROM {SCHEMA}.sticker_packs WHERE id=%s AND is_published=TRUE""",
            (pid,)
        )
        r = cur.fetchone()
        if not r:
            conn.close(); return err("Пак не найден", 404)
        cur.execute(
            f"""SELECT id, emoji, image_url, position FROM {SCHEMA}.sticker_items
                WHERE pack_id=%s ORDER BY position ASC, id ASC""",
            (pid,)
        )
        items = [{"id": x[0], "emoji": x[1] or "", "image_url": x[2], "position": int(x[3])} for x in cur.fetchall()]
        owned = False
        if user_id:
            cur.execute(f"SELECT 1 FROM {SCHEMA}.user_sticker_packs WHERE user_id=%s AND pack_id=%s", (int(user_id), pid))
            owned = cur.fetchone() is not None
        conn.close()
        return ok({"pack": {
            "id": r[0], "author_id": r[1], "title": r[2], "description": r[3] or "",
            "cover_url": r[4], "price": float(r[5]), "is_premium": bool(r[6]),
            "total_sales": int(r[7]), "created_at": int(r[8]), "owned": owned, "items": items
        }})

    # ── stickers_buy_pack (через кошелёк, 60% автору, 40% платформе) ──────────
    if action == "stickers_buy_pack":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            pid = int(body.get("pack_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный id")
        cur.execute(f"SELECT author_id, title, price, is_premium FROM {SCHEMA}.sticker_packs WHERE id=%s AND is_published=TRUE", (pid,))
        r = cur.fetchone()
        if not r:
            conn.close(); return err("Пак не найден", 404)
        author_id = r[0]; title = r[1]; price = float(r[2]); is_premium = bool(r[3])
        # Проверка дубля
        cur.execute(f"SELECT 1 FROM {SCHEMA}.user_sticker_packs WHERE user_id=%s AND pack_id=%s", (int(user_id), pid))
        if cur.fetchone():
            conn.close(); return err("Этот пак уже у тебя")
        now = int(time.time())
        new_balance = None
        if is_premium:
            # Доступ по подписке
            cur.execute(f"SELECT COALESCE(stickers_subscription_until,0) FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
            ss = cur.fetchone()
            ss_until = int(ss[0] or 0) if ss else 0
            if ss_until <= now:
                conn.close(); return err("Этот пак по подписке. Оформи подписку на авторские стикеры за 100₽/мес")
            cur.execute(
                f"""INSERT INTO {SCHEMA}.user_sticker_packs (user_id, pack_id, acquired_at, acquired_via)
                    VALUES (%s,%s,%s,'subscription')""",
                (int(user_id), pid, now)
            )
        elif price <= 0:
            cur.execute(
                f"""INSERT INTO {SCHEMA}.user_sticker_packs (user_id, pack_id, acquired_at, acquired_via)
                    VALUES (%s,%s,%s,'free')""",
                (int(user_id), pid, now)
            )
        else:
            cur.execute(f"SELECT COALESCE(wallet_balance,0) FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
            balance = float(cur.fetchone()[0])
            if balance < price:
                conn.close(); return err(f"Недостаточно средств. Нужно {price:.2f}₽")
            new_balance = balance - price
            cur.execute(f"UPDATE {SCHEMA}.users SET wallet_balance=%s WHERE id=%s", (new_balance, int(user_id)))
            cur.execute(
                f"""INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, kind, description, balance_after, created_at)
                    VALUES (%s,%s,'sticker_purchase',%s,%s,%s)""",
                (int(user_id), -price, f"Стикерпак: {title}", new_balance, now)
            )
            # 60% автору
            if author_id:
                author_share = round(price * 0.6, 2)
                cur.execute(f"UPDATE {SCHEMA}.users SET wallet_balance=COALESCE(wallet_balance,0)+%s WHERE id=%s RETURNING wallet_balance", (author_share, int(author_id)))
                ab_row = cur.fetchone()
                if ab_row:
                    ab = float(ab_row[0])
                    cur.execute(
                        f"""INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, kind, description, balance_after, created_at)
                            VALUES (%s,%s,'sticker_royalty',%s,%s,%s)""",
                        (int(author_id), author_share, f"Роялти за пак: {title}", ab, now)
                    )
            cur.execute(
                f"""INSERT INTO {SCHEMA}.user_sticker_packs (user_id, pack_id, acquired_at, acquired_via)
                    VALUES (%s,%s,%s,'purchase')""",
                (int(user_id), pid, now)
            )
            cur.execute(f"UPDATE {SCHEMA}.sticker_packs SET total_sales=total_sales+1 WHERE id=%s", (pid,))
        _grant_xp(cur, int(user_id), "sticker_pack_buy")
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.user_sticker_packs WHERE user_id=%s", (int(user_id),))
        packs_cnt = int((cur.fetchone() or [0])[0] or 0)
        if packs_cnt >= 3:
            _award_badge(cur, int(user_id), "collector")
        conn.close()
        return ok({"owned": True, "balance": new_balance})

    # ── lightning_send_to_chat (подарок ⚡ + сообщение в чат) ─────────────────
    if action == "lightning_send_to_chat":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            qty = int(body.get("quantity") or 0)
            chat_id = int(body.get("chat_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверные параметры")
        message = (body.get("message") or "")[:200]
        if qty < 1 or qty > 100000:
            conn.close(); return err("От 1 до 100000 ⚡")
        if chat_id <= 0:
            conn.close(); return err("Нужен chat_id")
        # Найти получателя
        cur.execute(f"SELECT user1_id, user2_id FROM {SCHEMA}.chats WHERE id=%s", (chat_id,))
        cr = cur.fetchone()
        if not cr:
            conn.close(); return err("Чат не найден", 404)
        u1, u2 = int(cr[0]), int(cr[1])
        recipient = u2 if u1 == int(user_id) else u1
        if recipient == int(user_id):
            conn.close(); return err("Нельзя дарить себе")
        # Проверка баланса
        cur.execute(f"SELECT name, COALESCE(lightning_balance,0) FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
        ur = cur.fetchone()
        if not ur:
            conn.close(); return err("Пользователь не найден", 404)
        sender_name = ur[0] or "Друг"
        my_lb = int(ur[1] or 0)
        if my_lb < qty:
            conn.close(); return err(f"Недостаточно ⚡. У тебя {my_lb}")
        cur.execute(f"SELECT name, COALESCE(lightning_balance,0) FROM {SCHEMA}.users WHERE id=%s", (recipient,))
        rr = cur.fetchone()
        if not rr:
            conn.close(); return err("Получатель не найден", 404)
        their_lb = int(rr[1] or 0)
        recipient_name = rr[0] or "Друг"
        now = int(time.time())
        new_my = my_lb - qty
        new_their = their_lb + qty
        cur.execute(f"UPDATE {SCHEMA}.users SET lightning_balance=%s WHERE id=%s", (new_my, int(user_id)))
        cur.execute(f"UPDATE {SCHEMA}.users SET lightning_balance=%s WHERE id=%s", (new_their, recipient))
        cur.execute(
            f"""INSERT INTO {SCHEMA}.lightning_transactions (user_id, amount, kind, description, related_user_id, balance_after, created_at)
                VALUES (%s,%s,'sent',%s,%s,%s,%s)""",
            (int(user_id), -qty, f"Подарок {recipient_name}", recipient, new_my, now)
        )
        cur.execute(
            f"""INSERT INTO {SCHEMA}.lightning_transactions (user_id, amount, kind, description, related_user_id, balance_after, created_at)
                VALUES (%s,%s,'received',%s,%s,%s,%s)""",
            (recipient, qty, f"От {sender_name}", int(user_id), new_their, now)
        )
        # Сообщение в чат
        gift_text = f"⚡ Подарок: {qty} молн{'ия' if qty == 1 else ('ии' if 2 <= qty <= 4 else 'ий')}"
        payload = {"quantity": qty, "message": message}
        cur.execute(
            f"""INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text, created_at, kind, payload_json)
                VALUES (%s,%s,%s,%s,'gift',%s) RETURNING id""",
            (chat_id, int(user_id), gift_text, now, json.dumps(payload, ensure_ascii=False))
        )
        msg_id = cur.fetchone()[0]
        cur.execute(f"UPDATE {SCHEMA}.chats SET last_message=%s, last_message_at=%s WHERE id=%s", (gift_text[:100], now, chat_id))
        # XP отправителю и получателю
        _grant_xp(cur, int(user_id), "lightning_sent")
        _grant_xp(cur, recipient, "lightning_received")
        # Бейдж "Щедрый" за 100 ⚡ всего отправленных
        cur.execute(
            f"SELECT COALESCE(SUM(-amount),0) FROM {SCHEMA}.lightning_transactions WHERE user_id=%s AND kind='sent'",
            (int(user_id),)
        )
        sent_total = int((cur.fetchone() or [0])[0] or 0)
        if sent_total >= 100:
            _award_badge(cur, int(user_id), "generous")
        conn.close()
        return ok({"lightning": new_my, "msg_id": msg_id, "created_at": now, "to_user": recipient})

    # ── my_fundraisers (для выбора при отправке в чат) ───────────────────────
    if action == "my_fundraisers":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT id, title, target_amount, collected_amount, status, cover_url, created_at
                FROM {SCHEMA}.fundraisers WHERE owner_id=%s ORDER BY created_at DESC LIMIT 50""",
            (int(user_id),)
        )
        items = [{
            "id": r[0], "title": r[1], "target_amount": float(r[2]),
            "collected_amount": float(r[3]), "status": r[4], "cover_url": r[5],
            "created_at": int(r[6])
        } for r in cur.fetchall()]
        conn.close()
        return ok({"fundraisers": items})

    # ── stickers_create_pack (админ) ─────────────────────────────────────────
    if action == "stickers_create_pack":
        hdrs = event.get("headers") or {}
        admin_token = hdrs.get("X-Admin-Password") or hdrs.get("x-admin-password") or hdrs.get("X-Admin-Token") or hdrs.get("x-admin-token") or ""
        expected = os.environ.get("ADMIN_PASSWORD", "")
        if not expected or admin_token != expected:
            conn.close(); return err("Forbidden", 403)
        title = (body.get("title") or "").strip()
        description = (body.get("description") or "").strip()[:500]
        cover_url = body.get("cover_url") or None
        try:
            price = float(body.get("price") or 0)
        except (TypeError, ValueError):
            price = 0
        is_premium = bool(body.get("is_premium"))
        author_id = body.get("author_id") or None
        items = body.get("items") or []
        if not title or len(title) < 2:
            conn.close(); return err("Название от 2 символов")
        if not isinstance(items, list) or len(items) < 1:
            conn.close(); return err("Минимум 1 стикер")
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.sticker_packs (author_id, title, description, cover_url, price, is_premium, is_published, created_at)
                VALUES (%s,%s,%s,%s,%s,%s,TRUE,%s) RETURNING id""",
            (int(author_id) if author_id else None, title, description, cover_url, price, is_premium, now)
        )
        pid = cur.fetchone()[0]
        for i, it in enumerate(items):
            if not isinstance(it, dict): continue
            img = (it.get("image_url") or "").strip()
            if not img: continue
            cur.execute(
                f"""INSERT INTO {SCHEMA}.sticker_items (pack_id, emoji, image_url, position)
                    VALUES (%s,%s,%s,%s)""",
                (pid, (it.get("emoji") or "")[:8], img, i)
            )
        conn.close()
        return ok({"pack_id": pid})

    # ── stickers_delete_pack (админ) ─────────────────────────────────────────
    if action == "stickers_delete_pack":
        hdrs = event.get("headers") or {}
        admin_token = hdrs.get("X-Admin-Password") or hdrs.get("x-admin-password") or hdrs.get("X-Admin-Token") or hdrs.get("x-admin-token") or ""
        expected = os.environ.get("ADMIN_PASSWORD", "")
        if not expected or admin_token != expected:
            conn.close(); return err("Forbidden", 403)
        try:
            pid = int(body.get("pack_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный id")
        cur.execute(f"UPDATE {SCHEMA}.sticker_packs SET is_published=FALSE WHERE id=%s", (pid,))
        conn.close()
        return ok({"deleted": pid})

    # ── stickers_my (мои паки) ────────────────────────────────────────────────
    if action == "stickers_my":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT p.id, p.title, p.cover_url, usp.acquired_at
                FROM {SCHEMA}.user_sticker_packs usp
                JOIN {SCHEMA}.sticker_packs p ON p.id = usp.pack_id
                WHERE usp.user_id=%s
                ORDER BY usp.acquired_at DESC""",
            (int(user_id),)
        )
        my = [{"id": r[0], "title": r[1], "cover_url": r[2], "acquired_at": int(r[3])} for r in cur.fetchall()]
        conn.close()
        return ok({"packs": my})

    # ── chat_set_disappearing ─────────────────────────────────────────────────
    if action == "chat_set_disappearing":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            chat_id = int(body.get("chat_id") or 0)
            seconds = body.get("seconds")
            seconds = None if seconds in (None, 0, "0", "off", "") else int(seconds)
        except (TypeError, ValueError):
            conn.close(); return err("Неверные параметры")
        if chat_id <= 0:
            conn.close(); return err("Нужен chat_id")
        # Проверяем, что юзер участник чата
        cur.execute(
            f"SELECT user1_id, user2_id FROM {SCHEMA}.chats WHERE id=%s",
            (chat_id,)
        )
        cr = cur.fetchone()
        if not cr:
            conn.close(); return err("Чат не найден", 404)
        if int(user_id) not in (cr[0], cr[1]):
            conn.close(); return err("Нет доступа", 403)
        # Допустимые значения: None, 10, 60, 300, 3600, 86400, 604800
        ALLOWED = {10, 60, 300, 3600, 86400, 604800}
        if seconds is not None and seconds not in ALLOWED:
            conn.close(); return err("Недопустимое значение таймера")
        cur.execute(
            f"UPDATE {SCHEMA}.chats SET disappearing_seconds=%s WHERE id=%s",
            (seconds, chat_id)
        )
        # Системное сообщение в чат
        now = int(time.time())
        if seconds is None:
            sys_text = "🕐 Исчезающие сообщения отключены"
        else:
            label = (
                "10 секунд" if seconds == 10 else
                "1 минута" if seconds == 60 else
                "5 минут" if seconds == 300 else
                "1 час" if seconds == 3600 else
                "24 часа" if seconds == 86400 else
                "7 дней"
            )
            sys_text = f"🕐 Включён таймер исчезновения: {label}"
        cur.execute(
            f"""INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text, created_at, kind, payload_json)
                VALUES (%s,%s,%s,%s,'system',%s)""",
            (chat_id, int(user_id), sys_text, now, json.dumps({"event": "disappearing", "seconds": seconds}, ensure_ascii=False))
        )
        cur.execute(
            f"UPDATE {SCHEMA}.chats SET last_message=%s, last_message_at=%s WHERE id=%s",
            (sys_text[:100], now, chat_id)
        )
        conn.close()
        return ok({"chat_id": chat_id, "disappearing_seconds": seconds})

    # ── chat_get_settings (узнать таймер чата) ────────────────────────────────
    if action == "chat_get_settings":
        try:
            chat_id = int(body.get("chat_id") or params.get("chat_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверные параметры")
        if chat_id <= 0:
            conn.close(); return err("Нужен chat_id")
        cur.execute(f"SELECT disappearing_seconds FROM {SCHEMA}.chats WHERE id=%s", (chat_id,))
        cr = cur.fetchone()
        if not cr:
            conn.close(); return err("Чат не найден", 404)
        conn.close()
        return ok({"chat_id": chat_id, "disappearing_seconds": int(cr[0]) if cr[0] else None})

    # ── get_user_progress (XP, уровень, бейджи, последние события) ────────────
    if action == "get_user_progress":
        target_id = body.get("user_id") or user_id
        if not target_id:
            conn.close(); return err("Нужен user_id или X-User-Id")
        try:
            target_id = int(target_id)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный user_id")
        cur.execute(
            f"SELECT id, name, avatar_url, COALESCE(xp,0), COALESCE(level,1), COALESCE(daily_streak,0) FROM {SCHEMA}.users WHERE id=%s",
            (target_id,)
        )
        u = cur.fetchone()
        if not u:
            conn.close(); return err("Пользователь не найден", 404)
        cur_xp = int(u[3] or 0); cur_level = int(u[4] or 1)
        prev = _xp_for_level(cur_level)
        nxt = _xp_for_level(cur_level + 1)
        # Бейджи
        cur.execute(
            f"SELECT badge_code, earned_at FROM {SCHEMA}.user_badges WHERE user_id=%s ORDER BY earned_at DESC",
            (target_id,)
        )
        earned = [(r[0], int(r[1])) for r in cur.fetchall()]
        earned_codes = {c for c, _ in earned}
        all_badges = []
        for code, meta in BADGES.items():
            ts = next((t for c, t in earned if c == code), None)
            all_badges.append({
                "code": code, "title": meta["title"], "icon": meta["icon"], "desc": meta["desc"],
                "earned": code in earned_codes, "earned_at": ts,
            })
        # Последние XP-события
        cur.execute(
            f"""SELECT amount, reason, created_at FROM {SCHEMA}.xp_events
                WHERE user_id=%s ORDER BY created_at DESC LIMIT 30""",
            (target_id,)
        )
        events = [{"amount": int(r[0]), "reason": r[1], "created_at": int(r[2])} for r in cur.fetchall()]
        conn.close()
        return ok({
            "user": {"id": u[0], "name": u[1], "avatar_url": u[2]},
            "xp": cur_xp, "level": cur_level,
            "xp_for_current_level": prev,
            "xp_for_next_level": nxt,
            "progress_pct": int(round((cur_xp - prev) * 100 / max(1, nxt - prev))) if nxt > prev else 100,
            "daily_streak": int(u[5] or 0),
            "badges": all_badges,
            "events": events,
        })

    # ── leaderboard ───────────────────────────────────────────────────────────
    if action == "leaderboard":
        scope = body.get("scope") or "global"
        cur.execute(
            f"""SELECT id, name, avatar_url, COALESCE(xp,0), COALESCE(level,1)
                FROM {SCHEMA}.users
                WHERE COALESCE(xp,0) > 0
                ORDER BY xp DESC, id ASC
                LIMIT 50"""
        )
        rows = cur.fetchall()
        items = [{
            "id": r[0], "name": r[1], "avatar_url": r[2],
            "xp": int(r[3]), "level": int(r[4]),
            "rank": i + 1,
        } for i, r in enumerate(rows)]
        my_rank = None
        if user_id:
            cur.execute(
                f"""SELECT COUNT(*)+1 FROM {SCHEMA}.users
                    WHERE COALESCE(xp,0) > (SELECT COALESCE(xp,0) FROM {SCHEMA}.users WHERE id=%s)""",
                (int(user_id),)
            )
            mr = cur.fetchone()
            my_rank = int(mr[0]) if mr else None
        conn.close()
        return ok({"items": items, "my_rank": my_rank, "scope": scope})

    # ── STORIES (24h) ─────────────────────────────────────────────────────────

    if action == "story_publish":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        media_url = (body.get("media_url") or "").strip()
        caption = (body.get("caption") or "").strip()[:200] or None
        media_type = (body.get("media_type") or "image").strip()
        if media_type not in ("image", "video"):
            media_type = "image"
        if not media_url:
            conn.close(); return err("Нужен media_url")
        now = int(time.time())
        expires = now + 24 * 3600
        cur.execute(
            f"""INSERT INTO {SCHEMA}.stories (user_id, media_url, media_type, caption, created_at, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (int(user_id), media_url, media_type, caption, now, expires)
        )
        sid = int(cur.fetchone()[0])
        conn.close()
        return ok({"id": sid, "expires_at": expires})

    if action == "story_feed":
        # Ленту собираем по контактам и моим (активные не истёкшие)
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        now = int(time.time())
        cur.execute(
            f"""SELECT s.id, s.user_id, u.name, u.avatar_url, s.media_url, s.caption, s.created_at, s.expires_at,
                       EXISTS(SELECT 1 FROM {SCHEMA}.story_views v WHERE v.story_id=s.id AND v.viewer_id=%s) AS viewed,
                       COALESCE(s.media_type, 'image')
                FROM {SCHEMA}.stories s
                JOIN {SCHEMA}.users u ON u.id = s.user_id
                WHERE s.expires_at > %s
                  AND (
                    s.user_id = %s
                    OR s.user_id IN (SELECT contact_id FROM {SCHEMA}.contacts WHERE user_id=%s)
                    OR %s IN (SELECT contact_id FROM {SCHEMA}.contacts WHERE user_id=s.user_id)
                  )
                ORDER BY s.user_id, s.created_at ASC""",
            (int(user_id), now, int(user_id), int(user_id), int(user_id))
        )
        rows = cur.fetchall()
        conn.close()
        # Группируем по user_id
        groups = {}
        order = []
        for r in rows:
            uid = int(r[1])
            if uid not in groups:
                groups[uid] = {
                    "user_id": uid, "user_name": r[2], "avatar_url": r[3],
                    "is_me": uid == int(user_id),
                    "stories": [], "all_viewed": True,
                }
                order.append(uid)
            viewed = bool(r[8])
            if not viewed and uid != int(user_id):
                groups[uid]["all_viewed"] = False
            groups[uid]["stories"].append({
                "id": int(r[0]), "media_url": r[4], "caption": r[5],
                "created_at": int(r[6]), "expires_at": int(r[7]), "viewed": viewed,
                "media_type": r[9] or "image",
            })
        # Сначала «Моя», потом непросмотренные, потом просмотренные
        items = [groups[u] for u in order]
        items.sort(key=lambda g: (not g["is_me"], g["all_viewed"], -g["stories"][-1]["created_at"]))
        return ok({"groups": items})

    if action == "story_view":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            sid = int(body.get("story_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный story_id")
        if sid <= 0:
            conn.close(); return err("Нужен story_id")
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.story_views (story_id, viewer_id, viewed_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (story_id, viewer_id) DO NOTHING""",
            (sid, int(user_id), now)
        )
        conn.close()
        return ok({"viewed": True})

    if action == "story_my_views":
        # Вернуть просмотры моей истории (для меня же)
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            sid = int(body.get("story_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный story_id")
        cur.execute(f"SELECT user_id FROM {SCHEMA}.stories WHERE id=%s", (sid,))
        rr = cur.fetchone()
        if not rr or int(rr[0]) != int(user_id):
            conn.close(); return err("Нет доступа", 403)
        cur.execute(
            f"""SELECT v.viewer_id, u.name, u.avatar_url, v.viewed_at
                FROM {SCHEMA}.story_views v
                JOIN {SCHEMA}.users u ON u.id = v.viewer_id
                WHERE v.story_id=%s
                ORDER BY v.viewed_at DESC LIMIT 200""",
            (sid,)
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"views": [{
            "user_id": r[0], "name": r[1], "avatar_url": r[2], "viewed_at": int(r[3]),
        } for r in rows]})

    if action == "story_delete":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            sid = int(body.get("story_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный story_id")
        cur.execute(f"SELECT user_id FROM {SCHEMA}.stories WHERE id=%s", (sid,))
        rr = cur.fetchone()
        if not rr or int(rr[0]) != int(user_id):
            conn.close(); return err("Нет доступа", 403)
        # Не удаляем, а помечаем просроченной
        cur.execute(f"UPDATE {SCHEMA}.stories SET expires_at=%s WHERE id=%s", (int(time.time()) - 1, sid))
        conn.close()
        return ok({"removed": True})

    if action == "story_reply":
        # Ответ на историю — отправляем сообщение в личку автору с цитатой истории
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            sid = int(body.get("story_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный story_id")
        text = (body.get("text") or "").strip()[:500]
        emoji = (body.get("emoji") or "").strip()[:8]
        if not text and not emoji:
            conn.close(); return err("Нужен text или emoji")
        if sid <= 0:
            conn.close(); return err("Нужен story_id")
        cur.execute(
            f"SELECT user_id, media_url, caption, expires_at FROM {SCHEMA}.stories WHERE id=%s",
            (sid,)
        )
        rr = cur.fetchone()
        if not rr:
            conn.close(); return err("История не найдена", 404)
        author_id = int(rr[0])
        if author_id == int(user_id):
            conn.close(); return err("Нельзя отвечать на свою историю", 400)
        media_url = rr[1]
        caption = rr[2]
        # Получаем/создаём чат
        u1, u2 = sorted([int(user_id), author_id])
        cur.execute(
            f"""INSERT INTO {SCHEMA}.chats (user1_id, user2_id, created_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (user1_id, user2_id) DO UPDATE SET user1_id = EXCLUDED.user1_id
                RETURNING id""",
            (u1, u2, int(time.time()))
        )
        chat_id = int(cur.fetchone()[0])
        now = int(time.time())
        msg_text = (emoji + " " + text).strip() if emoji else text
        payload = {
            "story_id": sid,
            "story_media_url": media_url,
            "story_caption": caption,
            "story_author_id": author_id,
        }
        cur.execute(
            f"""INSERT INTO {SCHEMA}.messages
                (chat_id, sender_id, text, created_at, kind, payload_json)
                VALUES (%s, %s, %s, %s, 'story_reply', %s) RETURNING id""",
            (chat_id, int(user_id), msg_text, now, json.dumps(payload, ensure_ascii=False))
        )
        mid = int(cur.fetchone()[0])
        last_msg_preview = (emoji + " " + (text or "Ответ на историю")).strip()
        cur.execute(
            f"UPDATE {SCHEMA}.chats SET last_message=%s, last_message_at=%s WHERE id=%s",
            (last_msg_preview[:100], now, chat_id)
        )
        # Имя отправителя для пуша
        cur.execute(f"SELECT name FROM {SCHEMA}.users WHERE id=%s", (int(user_id),))
        sender_row = cur.fetchone()
        sender_name = sender_row[0] if sender_row else "Кто-то"
        conn.close()
        # Push автору истории
        push_url = os.environ.get("PUSH_NOTIFY_URL", "")
        if push_url:
            try:
                push_payload = json.dumps({
                    "action": "send",
                    "recipient_id": author_id,
                    "sender_name": sender_name,
                    "message": f"📸 Ответ на историю: {(emoji + ' ' + text).strip()[:80]}" if text else f"📸 Отреагировал(а) {emoji} на историю",
                    "chat_id": chat_id,
                }).encode("utf-8")
                req = urllib.request.Request(push_url, data=push_payload, headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=5)
            except Exception:
                pass
        return ok({"message_id": mid, "chat_id": chat_id})

    # ── BOT API ───────────────────────────────────────────────────────────────

    if action == "bot_create":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        name = (body.get("name") or "").strip()
        username = (body.get("username") or "").strip().lstrip("@").lower()
        description = (body.get("description") or "").strip()[:300]
        if not name or len(name) < 2:
            conn.close(); return err("Имя бота слишком короткое")
        if not username or not all(c.isalnum() or c == "_" for c in username) or len(username) < 3 or len(username) > 32:
            conn.close(); return err("Username 3–32 символа: латиница, цифры, _")
        if not username.endswith("bot"):
            conn.close(); return err("Username бота должен заканчиваться на 'bot'")
        cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE LOWER(bot_username)=%s", (username,))
        if cur.fetchone():
            conn.close(); return err("Этот username занят")
        # Лимит: не больше 10 ботов на пользователя
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE bot_owner_id=%s", (int(user_id),))
        if int(cur.fetchone()[0]) >= 10:
            conn.close(); return err("Нельзя иметь больше 10 ботов")
        import secrets as _secrets
        token = f"{int(user_id)}:{_secrets.token_urlsafe(32)}"
        # У бота телефон-заглушка с префиксом @bot для уникальности
        bot_phone = f"bot_{username}_{int(time.time())}"
        cur.execute(
            f"""INSERT INTO {SCHEMA}.users
                (phone, name, is_bot, bot_owner_id, bot_username, bot_token, bot_description, about)
                VALUES (%s, %s, true, %s, %s, %s, %s, %s) RETURNING id""",
            (bot_phone, name, int(user_id), username, token, description or None, description or None)
        )
        bot_id = int(cur.fetchone()[0])
        conn.close()
        return ok({"id": bot_id, "name": name, "username": username, "token": token, "description": description})

    if action == "bot_list_my":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        cur.execute(
            f"""SELECT id, name, bot_username, bot_token, bot_description, bot_webhook_url, avatar_url
                FROM {SCHEMA}.users WHERE bot_owner_id=%s ORDER BY id DESC""",
            (int(user_id),)
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"bots": [{
            "id": r[0], "name": r[1], "username": r[2], "token": r[3],
            "description": r[4], "webhook_url": r[5], "avatar_url": r[6],
        } for r in rows]})

    if action == "bot_update":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            bot_id = int(body.get("bot_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный bot_id")
        cur.execute(f"SELECT bot_owner_id FROM {SCHEMA}.users WHERE id=%s AND is_bot=true", (bot_id,))
        rr = cur.fetchone()
        if not rr or int(rr[0]) != int(user_id):
            conn.close(); return err("Нет доступа", 403)
        sets, params_ = [], []
        if "name" in body and (body.get("name") or "").strip():
            sets.append("name=%s"); params_.append((body.get("name") or "").strip()[:60])
        if "description" in body:
            sets.append("bot_description=%s"); params_.append((body.get("description") or "").strip()[:300] or None)
        if "webhook_url" in body:
            wh = (body.get("webhook_url") or "").strip()
            if wh and not (wh.startswith("https://") or wh.startswith("http://")):
                conn.close(); return err("Webhook URL должен начинаться с http:// или https://")
            sets.append("bot_webhook_url=%s"); params_.append(wh or None)
        if "avatar_url" in body:
            sets.append("avatar_url=%s"); params_.append((body.get("avatar_url") or "").strip() or None)
        if not sets:
            conn.close(); return ok({"updated": False})
        params_.append(bot_id)
        cur.execute(f"UPDATE {SCHEMA}.users SET {', '.join(sets)} WHERE id=%s", tuple(params_))
        conn.close()
        return ok({"updated": True})

    if action == "bot_revoke_token":
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            bot_id = int(body.get("bot_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный bot_id")
        cur.execute(f"SELECT bot_owner_id FROM {SCHEMA}.users WHERE id=%s AND is_bot=true", (bot_id,))
        rr = cur.fetchone()
        if not rr or int(rr[0]) != int(user_id):
            conn.close(); return err("Нет доступа", 403)
        import secrets as _secrets
        new_token = f"{bot_id}:{_secrets.token_urlsafe(32)}"
        cur.execute(f"UPDATE {SCHEMA}.users SET bot_token=%s WHERE id=%s", (new_token, bot_id))
        conn.close()
        return ok({"token": new_token})

    if action == "bot_search":
        q = (body.get("query") or params.get("query") or "").strip().lstrip("@").lower()
        if len(q) < 2:
            conn.close(); return ok({"bots": []})
        cur.execute(
            f"""SELECT id, name, bot_username, bot_description, avatar_url
                FROM {SCHEMA}.users
                WHERE is_bot=true AND (LOWER(bot_username) LIKE %s OR LOWER(name) LIKE %s)
                LIMIT 30""",
            (f"%{q}%", f"%{q}%")
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"bots": [{
            "id": r[0], "name": r[1], "username": r[2], "description": r[3], "avatar_url": r[4],
        } for r in rows]})

    if action == "bot_get_updates":
        # Бот опрашивает новые сообщения; авторизация по токену
        token = (body.get("token") or "").strip()
        try:
            since = int(body.get("since") or 0)
        except (TypeError, ValueError):
            since = 0
        if not token:
            conn.close(); return err("Нужен token")
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE bot_token=%s AND is_bot=true", (token,))
        rr = cur.fetchone()
        if not rr:
            conn.close(); return err("Неверный токен", 403)
        bot_id = int(rr[0])
        cur.execute(
            f"""SELECT m.id, m.chat_id, m.sender_id, u.name, m.text, m.created_at, m.kind, m.payload_json
                FROM {SCHEMA}.messages m
                JOIN {SCHEMA}.chats c ON c.id = m.chat_id
                JOIN {SCHEMA}.users u ON u.id = m.sender_id
                WHERE (c.user1_id=%s OR c.user2_id=%s)
                  AND m.sender_id <> %s
                  AND m.created_at > %s
                  AND m.removed_at IS NULL
                ORDER BY m.created_at ASC LIMIT 100""",
            (bot_id, bot_id, bot_id, since)
        )
        rows = cur.fetchall()
        conn.close()
        out = []
        for r in rows:
            kind = r[6] or "text"
            payload = None
            if r[7]:
                try: payload = json.loads(r[7])
                except Exception: payload = None
            entry = {
                "message_id": r[0], "chat_id": r[1], "from_user_id": r[2],
                "from_user_name": r[3], "text": r[4] or "", "created_at": int(r[5]),
                "type": "callback" if kind == "bot_callback" else "message",
            }
            if kind == "bot_callback" and isinstance(payload, dict):
                entry["callback_data"] = payload.get("callback_data")
                entry["source_message_id"] = payload.get("source_message_id")
            out.append(entry)
        return ok({"updates": out})

    if action == "bot_send_message":
        token = (body.get("token") or "").strip()
        try:
            chat_id = int(body.get("chat_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный chat_id")
        text = (body.get("text") or "").strip()[:4000]
        buttons_in = body.get("buttons")
        if not token or not chat_id or not text:
            conn.close(); return err("Нужны token, chat_id, text")
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE bot_token=%s AND is_bot=true", (token,))
        rr = cur.fetchone()
        if not rr:
            conn.close(); return err("Неверный токен", 403)
        bot_id = int(rr[0])
        # Проверим что бот участник чата
        cur.execute(f"SELECT user1_id, user2_id FROM {SCHEMA}.chats WHERE id=%s", (chat_id,))
        cr = cur.fetchone()
        if not cr or bot_id not in (int(cr[0]), int(cr[1])):
            conn.close(); return err("Бот не участник чата", 403)
        # Валидация кнопок: массив рядов, каждый ряд — массив {text, callback_data?, url?}
        buttons_clean = None
        if isinstance(buttons_in, list) and buttons_in:
            rows_clean = []
            for row in buttons_in[:8]:
                if not isinstance(row, list): continue
                row_clean = []
                for btn in row[:4]:
                    if not isinstance(btn, dict): continue
                    btxt = str(btn.get("text") or "").strip()[:32]
                    if not btxt: continue
                    bcb = str(btn.get("callback_data") or "")[:64] or None
                    burl = str(btn.get("url") or "").strip()[:300] or None
                    if burl and not (burl.startswith("http://") or burl.startswith("https://")):
                        burl = None
                    row_clean.append({"text": btxt, "callback_data": bcb, "url": burl})
                if row_clean:
                    rows_clean.append(row_clean)
            if rows_clean:
                buttons_clean = rows_clean
        now = int(time.time())
        kind = "bot_message" if buttons_clean else "text"
        payload_json = json.dumps({"buttons": buttons_clean}, ensure_ascii=False) if buttons_clean else None
        cur.execute(
            f"""INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text, created_at, kind, payload_json)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (chat_id, bot_id, text, now, kind, payload_json)
        )
        mid = int(cur.fetchone()[0])
        cur.execute(
            f"UPDATE {SCHEMA}.chats SET last_message=%s, last_message_at=%s WHERE id=%s",
            (text[:100], now, chat_id)
        )
        conn.close()
        return ok({"message_id": mid, "created_at": now})

    if action == "bot_callback":
        # Юзер нажал inline-кнопку
        if not user_id:
            conn.close(); return err("Нужен X-User-Id")
        try:
            chat_id = int(body.get("chat_id") or 0)
            message_id = int(body.get("message_id") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверные параметры")
        callback_data = str(body.get("callback_data") or "")[:64]
        if not chat_id or not message_id or not callback_data:
            conn.close(); return err("Нужны chat_id, message_id, callback_data")
        # Проверяем — сообщение реально от бота этого чата
        cur.execute(
            f"""SELECT m.sender_id, c.user1_id, c.user2_id, u.is_bot
                FROM {SCHEMA}.messages m
                JOIN {SCHEMA}.chats c ON c.id = m.chat_id
                JOIN {SCHEMA}.users u ON u.id = m.sender_id
                WHERE m.id=%s AND m.chat_id=%s""",
            (message_id, chat_id)
        )
        rr = cur.fetchone()
        if not rr or not rr[3]:
            conn.close(); return err("Сообщение не от бота", 400)
        if int(user_id) not in (int(rr[1]), int(rr[2])):
            conn.close(); return err("Нет доступа к чату", 403)
        bot_id = int(rr[0])
        now = int(time.time())
        # Записываем callback как невидимое юзерам сервисное сообщение для бота
        cur.execute(
            f"""INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text, created_at, kind, payload_json)
                VALUES (%s, %s, %s, %s, 'bot_callback', %s) RETURNING id""",
            (chat_id, int(user_id), "", now,
             json.dumps({"callback_data": callback_data, "source_message_id": message_id}, ensure_ascii=False))
        )
        cb_id = int(cur.fetchone()[0])
        # Стрельнём webhook боту
        cur.execute(f"SELECT bot_webhook_url FROM {SCHEMA}.users WHERE id=%s", (bot_id,))
        wh_row = cur.fetchone()
        if wh_row and wh_row[0]:
            try:
                wh_body = json.dumps({
                    "callback_id": cb_id,
                    "chat_id": chat_id,
                    "from_user_id": int(user_id),
                    "callback_data": callback_data,
                    "source_message_id": message_id,
                    "created_at": now,
                }).encode("utf-8")
                req2 = urllib.request.Request(wh_row[0], data=wh_body, headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req2, timeout=3)
            except Exception:
                pass
        conn.close()
        return ok({"callback_id": cb_id})

    conn.close()
    return err("Неизвестный action")