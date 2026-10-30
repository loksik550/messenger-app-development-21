import os
import nova_ids
import errlog
import json
import re
import time
import hashlib
import secrets
import base64
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67547116_messenger_app_develo")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Dev-Token",
}

SESSION_TTL = 12 * 3600
PBKDF_ROUNDS = 120000

PUBLIC_ACTIONS = {"login", "register", "check_setup", "panel_info", "vk_start", "vk_poll"}
VK_REDIRECT = "https://novaa.pro/vk-callback"

# Роли и права. owner может всё, остальные — по списку.
ROLES = {
    "owner": {"label": "Основатель", "perms": ["*"]},
    "admin": {"label": "Администратор", "perms": [
        "dashboard", "users", "user_write", "wallet", "chats", "media",
        "reports", "support", "logs", "services", "channels", "team", "settings",
    ]},
    "moderator": {"label": "Модератор", "perms": [
        "dashboard", "users", "user_write", "chats", "media", "reports", "support", "channels",
    ]},
    "analyst": {"label": "Аналитик", "perms": ["dashboard", "users", "logs", "channels"]},
    "developer": {"label": "Разработчик", "perms": ["dashboard", "logs", "services", "users"]},
}

# Действия, которые перед выполнением требуют повторно ввести пароль —
# защита на случай, если админ отошёл от открытого компьютера
CONFIRM_ACTIONS = {
    "delete_user", "purge_user", "purge_deleted", "delete_chat", "bulk_action", "team_update", "team_remove",
    "wallet_set", "payment_refund", "settings_save", "broadcast_send",
    "channel_delete", "create_invite", "auth_strict_save", "reset_decide",
}

ACTION_PERMS = {
    "dashboard": "dashboard",
    "users": "users", "user_detail": "users", "user_devices": "users",
    "ban_user": "user_write", "force_logout": "user_write", "delete_user": "user_write", "purge_user": "user_write", "purge_deleted": "user_write",
    "rename_user": "user_write",
    "topup_wallet": "wallet",
    "user_chats": "chats", "chat_messages": "chats", "delete_message": "chats",
    "delete_chat": "chats", "export_chat": "chats",
    "media_list": "media", "delete_media": "media",
    "reports": "reports", "report_resolve": "reports",
    "support_tickets": "support", "support_messages": "support",
    "support_reply": "support", "support_close": "support",
    "logs": "logs", "errors": "logs", "errors_clear": "logs",
    "services": "services", "invites": "services", "create_invite": "services",
    "channels": "channels", "channel_update": "channels", "channel_delete": "channels",
    "channel_messages": "channels", "channel_message_delete": "channels",
    "channel_members": "channels", "channel_set_test": "channels",
    "channel_post": "channels", "nova_message": "user_write",
    "team": "team", "team_update": "team", "team_remove": "team",
    "settings_get": "dashboard", "settings_save": "settings",
    "change_password": "dashboard", "change_email": "dashboard",
    "update_me": "dashboard",
    "verifications": "reports", "verify_decide": "reports", "set_verified": "reports",
    "set_channel_verified": "channels",
    "notifications": "dashboard", "notifications_read": "dashboard",
    "moderation_summary": "dashboard",
    "plans": "dashboard", "plan_save": "settings", "plan_delete": "settings",
    "pro_features": "dashboard", "pro_features_save": "settings",
    "badges_admin": "dashboard", "badge_grant": "settings", "badge_revoke": "settings", "badge_update": "settings",
    "user_shop_badges": "users",
    "test_skins_list": "dashboard", "test_skin_save": "settings", "test_skin_delete": "settings",
    "test_themes_list": "dashboard", "test_themes_grant": "settings", "test_themes_revoke": "settings",
    "nova_ids_list": "dashboard", "nova_id_check_admin": "dashboard",
    "nova_id_grant": "settings", "nova_ids_settings_save": "settings",
    "broadcast_send": "settings", "broadcast_history": "dashboard",
    "broadcast_preview": "settings",
    "mod_rules": "dashboard", "mod_rule_add": "settings", "mod_rule_delete": "settings",
    "mod_hits": "dashboard", "mod_settings_save": "settings",
    "revenue_chart": "dashboard",
    "payments": "dashboard", "payments_summary": "dashboard",
    "payments_export": "dashboard",
    "user_billing": "users", "wallet_set": "settings",
    "twofa_get": "dashboard", "twofa_save": "dashboard",
    "auth_strict_get": "dashboard", "auth_strict_save": "settings",
    "resets_list": "support", "reset_decide": "user_write",
    "trends": "dashboard", "expiring_soon": "dashboard",
    "live_feed": "dashboard", "system_health": "dashboard", "spark": "dashboard",
    "funnel": "dashboard", "retention": "dashboard",
    "auto_rules": "dashboard", "auto_rule_save": "settings", "auto_rule_delete": "settings",
    "auto_rule_run": "settings", "auto_rule_hits": "dashboard",
    "global_search": "users", "filters_list": "users", "filter_save": "users",
    "filter_delete": "users", "users_filtered": "users",
    "undo_list": "dashboard", "undo_apply": "user_write",
    "backup_export": "settings", "user_full": "users",
    "vk_link_start": "dashboard", "vk_unlink": "dashboard", "vk_me": "dashboard",
    "grant_role": "team", "user_panel_role": "users",
    "app_version_get": "dashboard", "app_version_save": "services",
    "app_versions_stats": "dashboard", "app_update_nudge": "settings", "app_outdated_users": "dashboard",
    "me": "dashboard", "logout": "dashboard", "usage_stats": "dashboard",
    "promos": "dashboard", "promo_activations": "dashboard", "referrals_top": "dashboard",
    "referral_settings": "dashboard",
    "promo_save": "settings", "promo_toggle": "settings", "referral_settings_save": "settings",
    "gift_premium": "wallet",
    "tg_get": "settings", "tg_save": "settings", "tg_test": "settings", "nova_notify_test": "settings", "daily_summary_test": "settings",
    "users_export": "users", "bulk_action": "user_write",
    "canned_list": "support", "canned_save": "support", "canned_delete": "support",
    "payment_refund": "settings", "subscription_extend": "settings",
    "subscription_cancel": "settings",
    "subscriptions_summary": "dashboard",
}


def has_perm(admin, perm):
    role = ROLES.get(admin.get("role") or "", {})
    perms = role.get("perms", [])
    return "*" in perms or perm in perms


def get_conn():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    return conn


def ok(data):
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(msg, code=400):
    return {"statusCode": code, "headers": CORS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def _tg_send(token: str, chat_id: str, text: str) -> bool:
    """Отправляет сообщение в Telegram. Возвращает True при успехе."""
    try:
        data = urlencode({"chat_id": chat_id, "text": text}).encode()
        req = Request(f"https://api.telegram.org/bot{token}/sendMessage", data=data)
        with urlopen(req, timeout=2) as r:
            return json.loads(r.read()).get("ok", False)
    except Exception as e:
        print(f"[tg] sendMessage: {type(e).__name__}: {e}")
        return False


def _looks_like_tg_token(v: str) -> bool:
    return bool(re.fullmatch(r"\d{5,}:[A-Za-z0-9_-]{25,}", (v or "").strip()))


def _tg_call(token: str, method: str) -> dict:
    try:
        with urlopen(Request(f"https://api.telegram.org/bot{token}/{method}"), timeout=2) as r:
            return json.loads(r.read())
    except HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"ok": False}
    except Exception as e:
        print(f"[tg] {method}: {type(e).__name__}: {e}")
        return {"ok": False, "network": True}


TG_UNREACHABLE = ("Сервер не смог связаться с Telegram (нет ответа). Ключ сохранён. "
                  "Похоже, Telegram недоступен с сервера — это не ошибка в ключе")


def tg_notify(cur, kind: str, title: str, body_text: str) -> None:
    """Шлёт уведомление владельцу в Telegram, если это включено."""
    try:
        cur.execute(
            f"SELECT key, value FROM {SCHEMA}.dev_settings "
            f"WHERE key IN ('tg_enabled','tg_bot_token','tg_chat_id','tg_events')"
        )
        st = {r[0]: r[1] for r in cur.fetchall()}
        if st.get("tg_enabled") != "1":
            return
        events = (st.get("tg_events") or "report,support,pay").split(",")
        if kind not in events:
            return
        token, chat = st.get("tg_bot_token"), st.get("tg_chat_id")
        if token and chat:
            _tg_send(token, chat, f"{title}\n\n{body_text}")
    except Exception:
        pass


def remember_undo(cur, admin: dict, action_name: str, label: str, snapshot: dict) -> None:
    """Запоминает прежнее состояние, чтобы действие можно было отменить."""
    try:
        snapshot["label"] = label
        cur.execute(
            f"INSERT INTO {SCHEMA}.dev_undo (admin_id, action, label, payload) "
            f"VALUES (%s, %s, %s, %s)",
            (admin["id"], action_name, label, json.dumps(snapshot, ensure_ascii=False)),
        )
    except Exception:
        pass


def hash_password(password: str, salt: str = "") -> str:
    if not salt:
        salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF_ROUNDS)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    if "$" not in stored:
        return False
    salt, _ = stored.split("$", 1)
    return secrets.compare_digest(hash_password(password, salt), stored)


def client_ip(event) -> str:
    ctx = event.get("requestContext") or {}
    return (ctx.get("identity") or {}).get("sourceIp") or ""


def _notify_user_verified(cur, user_id: int, approved: bool, note: str = ""):
    """Записывает пользователю уведомление о решении по верификации."""
    if approved:
        title = "Аккаунт подтверждён"
        text = "Рядом с вашим именем теперь синяя галочка."
    else:
        title = "Заявка на верификацию отклонена"
        text = note or "Вы можете подать новую заявку с уточнёнными данными."
    cur.execute(
        f"INSERT INTO {SCHEMA}.user_notifications (user_id, kind, title, body) "
        f"VALUES (%s, %s, %s, %s)",
        (int(user_id), "verification", title, text),
    )


def audit(cur, admin, action, details="", ip=""):
    cur.execute(
        f"INSERT INTO {SCHEMA}.dev_audit (admin_id, admin_email, action, details, ip_addr) "
        f"VALUES (%s, %s, %s, %s, %s)",
        (admin.get("id") if admin else None, admin.get("email", "") if admin else "", action, details[:500], ip),
    )


def _rate_limit(cur, key: str, max_per_minute: int) -> bool:
    """True если лимит ОК (можно выполнять), False — превышен."""
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
            (key, window),
        )
        cnt = (cur.fetchone() or [0])[0]
        return cnt <= max_per_minute
    except Exception:
        return True


def auth_admin(cur, event):
    token = (event.get("headers") or {}).get("X-Dev-Token") or ""
    if not token:
        return None
    now = int(time.time())
    cur.execute(
        f"SELECT a.id, a.email, a.name, a.role, a.title, a.avatar_url FROM {SCHEMA}.dev_sessions s "
        f"JOIN {SCHEMA}.dev_admins a ON a.id = s.admin_id "
        f"WHERE s.token = %s AND s.expires_at > %s AND a.disabled = false",
        (token, now),
    )
    row = cur.fetchone()
    if not row:
        return None
    cur.execute(f"UPDATE {SCHEMA}.dev_sessions SET expires_at = %s WHERE token = %s", (now + SESSION_TTL, token))
    return {"id": row[0], "email": row[1], "name": row[2], "role": row[3],
            "title": row[4], "avatar_url": row[5] or ""}



SMS_ENABLED = False  # SMSC.ru временно отключён — включить True, когда снова понадобится


def _send_login_sms(phone: str, code: str) -> bool:
    """Отправить код входа в Dev-панель через SMSC."""
    import urllib.parse as _up
    import urllib.request as _ur
    login = os.environ.get("SMSC_LOGIN", "")
    password = os.environ.get("SMSC_PASSWORD", "")
    sender = os.environ.get("SMSC_SENDER", "")
    digits = "".join(c for c in (phone or "") if c.isdigit())
    if not login or not password or len(digits) < 10:
        print("[dev-sms] SMSC не настроен или неверный номер")
        return False

    def _send(with_sender: bool):
        p = {"login": login, "psw": password, "phones": digits,
             "mes": f"Nova Dev: код входа {code}", "fmt": 3, "charset": "utf-8"}
        if with_sender and sender:
            p["sender"] = sender
        r = _ur.urlopen(f"https://smsc.ru/sys/send.php?{_up.urlencode(p)}", timeout=4)
        return json.loads(r.read().decode("utf-8"))

    try:
        res = _send(True)
        if res.get("error") and sender:
            res = _send(False)
        if res.get("error"):
            print(f"[dev-sms] SMSC error code={res.get('error_code')}")
            return False
        return True
    except Exception as e:
        print(f"[dev-sms] failed: {e}")
        return False

PUSH_URL = "https://functions.poehali.dev/c9d141ca-3552-433f-a968-ac1e92da00af"


def _nova_user_id(cur):
    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE phone = '00000000000'")
    r = cur.fetchone()
    if r:
        cur.execute(f"UPDATE {SCHEMA}.users SET name = 'Nova', verified = TRUE, is_service = TRUE WHERE id = %s AND (name <> 'Nova' OR verified IS NOT TRUE)", (r[0],))
        return int(r[0])
    now = int(time.time())
    cur.execute(
        f"INSERT INTO {SCHEMA}.users (phone, name, verified, is_service, last_seen, created_at) "
        f"VALUES ('00000000000', 'Nova', TRUE, TRUE, %s, %s) RETURNING id",
        (now, now),
    )
    return int(cur.fetchone()[0])


PURGE_TABLES = [
    ("password_resets", "user_id"), ("message_reactions", "user_id"), ("group_message_reactions", "user_id"),
    ("group_message_views", "user_id"), ("favorite_messages", "user_id"), ("message_drafts", "user_id"),
    ("scheduled_messages", "sender_id"), ("typing_status", "user_id"), ("story_views", "viewer_id"),
    ("story_reactions", "user_id"), ("stories", "user_id"), ("close_friends", "user_id"), ("close_friends", "friend_id"),
    ("contacts", "user_id"), ("contacts", "contact_id"), ("user_blocks", "blocker_id"), ("user_blocks", "blocked_id"),
    ("user_sessions", "user_id"), ("user_badges", "user_id"), ("user_sticker_packs", "user_id"),
    ("push_subscriptions", "user_id"), ("xp_daily_counters", "user_id"), ("xp_events", "user_id"),
    ("group_mute", "user_id"), ("group_members", "user_id"), ("chat_settings", "user_id"),
    ("call_signals", "from_user_id"), ("call_signals", "to_user_id"), ("saved_notes", "user_id"),
    ("user_notifications", "user_id"), ("e2e_devices", "user_id"), ("login_events", "user_id"),
    ("moderation_hits", "user_id"), ("auto_rule_hits", "user_id"), ("pending_contacts", "user_id"),
    ("group_messages", "sender_id"), ("native_push_tokens", "user_id"), ("daily_active", "user_id"),
    ("feature_events", "user_id"), ("verification_requests", "user_id"), ("promo_activations", "user_id"),
    ("ban_history", "user_id"), ("reports", "reporter_id"), ("lightning_transactions", "user_id"),
    ("wallet_transactions", "user_id"), ("payment_requests", "from_user_id"), ("payment_requests", "to_user_id"),
    ("support_messages", "sender_id"), ("support_tickets", "user_id"),
]


def _try(cur, sql, args=()):
    """Выполняет запрос; ошибки отдельных таблиц не прерывают стирание (соединение в autocommit)."""
    try:
        cur.execute(sql, args)
        return cur.rowcount
    except Exception as e:
        print(f"[purge] skip: {str(e)[:120]} :: {sql[:80]}")
        return 0


def _purge_user(cur, uid):
    """Полностью стирает пользователя: личные чаты, сообщения, ключи, сессии и сам аккаунт."""
    uid = int(uid)
    for table, col in PURGE_TABLES:
        _try(cur, f"DELETE FROM {SCHEMA}.{table} WHERE {col} = %s", (uid,))
    _try(cur, f"DELETE FROM {SCHEMA}.message_reactions WHERE message_id IN "
              f"(SELECT m.id FROM {SCHEMA}.messages m JOIN {SCHEMA}.chats c ON c.id = m.chat_id "
              f"WHERE c.user1_id = %s OR c.user2_id = %s)", (uid, uid))
    _try(cur, f"DELETE FROM {SCHEMA}.favorite_messages WHERE message_id IN "
              f"(SELECT m.id FROM {SCHEMA}.messages m JOIN {SCHEMA}.chats c ON c.id = m.chat_id "
              f"WHERE c.user1_id = %s OR c.user2_id = %s)", (uid, uid))
    _try(cur, f"DELETE FROM {SCHEMA}.messages WHERE chat_id IN "
              f"(SELECT id FROM {SCHEMA}.chats WHERE user1_id = %s OR user2_id = %s)", (uid, uid))
    _try(cur, f"DELETE FROM {SCHEMA}.messages WHERE sender_id = %s", (uid,))
    _try(cur, f"DELETE FROM {SCHEMA}.chat_settings WHERE chat_id IN "
              f"(SELECT id FROM {SCHEMA}.chats WHERE user1_id = %s OR user2_id = %s)", (uid, uid))
    _try(cur, f"DELETE FROM {SCHEMA}.chats WHERE user1_id = %s OR user2_id = %s", (uid, uid))
    _try(cur, f"UPDATE {SCHEMA}.vk_logins SET user_id = NULL WHERE user_id = %s", (uid,))
    _try(cur, f"UPDATE {SCHEMA}.reports SET reported_user_id = 0 WHERE reported_user_id = %s", (uid,))
    _try(cur, f"UPDATE {SCHEMA}.dev_admins SET nova_user_id = NULL WHERE nova_user_id = %s", (uid,))
    gone = _try(cur, f"DELETE FROM {SCHEMA}.users WHERE id = %s", (uid,))
    if not gone:
        _try(cur, f"UPDATE {SCHEMA}.users SET vk_id = NULL, name = 'Удалённый аккаунт', avatar_url = NULL, "
                  f"about = NULL, nova_id = NULL, phone = %s WHERE id = %s AND phone NOT LIKE 'deleted_%%'",
             (f"deleted_{uid}_{int(time.time())}", uid))
        _try(cur, f"UPDATE {SCHEMA}.users SET vk_id = NULL, nova_id = NULL WHERE id = %s", (uid,))
    return bool(gone)


def send_from_nova(cur, user_id, text):
    """Личное сообщение пользователю от официального аккаунта Nova + push."""
    nova = _nova_user_id(cur)
    uid = int(user_id)
    if uid == nova:
        return None
    a, b = sorted([nova, uid])
    now = int(time.time())
    cur.execute(
        f"INSERT INTO {SCHEMA}.chats (user1_id, user2_id, created_at) VALUES (%s, %s, %s) "
        f"ON CONFLICT (user1_id, user2_id) DO UPDATE SET user1_id = EXCLUDED.user1_id RETURNING id",
        (a, b, now),
    )
    chat_id = cur.fetchone()[0]
    cur.execute(
        f"INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text, created_at) VALUES (%s, %s, %s, %s)",
        (chat_id, nova, text[:4000], now),
    )
    cur.execute(
        f"UPDATE {SCHEMA}.chats SET last_message = %s, last_message_at = %s WHERE id = %s",
        (text[:100], now, chat_id),
    )
    try:
        key = hashlib.sha256((os.environ.get("DATABASE_URL", "") + "|nova-internal").encode()).hexdigest()
        req = Request(PUSH_URL, data=json.dumps({
            "action": "send", "recipient_id": uid, "sender_name": "Nova",
            "message": text[:100], "chat_id": chat_id,
        }).encode(), headers={"Content-Type": "application/json", "X-Internal-Key": key})
        urlopen(req, timeout=3)
    except Exception as e:
        print(f"[nova_msg] push: {e}")
    return chat_id


def _issue_session(cur, event, ip, admin_id):
    now = int(time.time())
    token = secrets.token_urlsafe(32)
    cur.execute(
        f"INSERT INTO {SCHEMA}.dev_sessions (token, admin_id, expires_at, ip_addr, user_agent) "
        f"VALUES (%s, %s, %s, %s, %s)",
        (token, admin_id, now + SESSION_TTL, ip, ((event.get("headers") or {}).get("User-Agent") or "")[:300]),
    )
    cur.execute(f"UPDATE {SCHEMA}.dev_admins SET last_login = %s WHERE id = %s", (now, admin_id))
    return token


def _vk_auth_url(cur, purpose, admin_link_id=None):
    client_id = (os.environ.get("VK_CLIENT_ID") or "").strip()
    if not client_id:
        return None, None, None
    state = secrets.token_urlsafe(24)
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    poll_key = secrets.token_urlsafe(24)
    now = int(time.time())
    cur.execute(f"DELETE FROM {SCHEMA}.vk_logins WHERE created_at < %s", (now - 3600,))
    cur.execute(
        f"INSERT INTO {SCHEMA}.vk_logins (state, code_verifier, poll_key_hash, is_native, created_at, purpose, admin_link_id) "
        f"VALUES (%s, %s, %s, FALSE, %s, %s, %s)",
        (state, verifier, hashlib.sha256(poll_key.encode()).hexdigest(), now, purpose, admin_link_id),
    )
    url = "https://id.vk.com/authorize?" + urlencode({
        "response_type": "code", "client_id": client_id, "redirect_uri": VK_REDIRECT,
        "state": state, "code_challenge": challenge, "code_challenge_method": "S256",
        "scope": "vkid.personal_info",
    })
    return url, state, poll_key


def handler(event: dict, context) -> dict:
    """Nova Dev Panel — вход по коду-приглашению, статистика, пользователи, логи, поддержка."""
    try:
        return _handler(event, context)
    except Exception as e:
        import traceback
        traceback.print_exc()
        errlog.record("dev-panel", event, e)
        if "rate limit" in str(e).lower():
            return err("Сервер сейчас занят, повторите через пару секунд", 503)
        return err(f"Ошибка сервера: {type(e).__name__}. Попробуйте ещё раз", 500)


def _handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body = json.loads(event.get("body") or "{}")
    params = event.get("queryStringParameters") or {}
    action = body.get("action") or params.get("action", "")
    ip = client_ip(event)

    conn = get_conn()
    cur = conn.cursor()

    try:
        admin = None
        if action not in PUBLIC_ACTIONS:
            admin = auth_admin(cur, event)
            if not admin:
                return err("Требуется вход", 401)
            need = ACTION_PERMS.get(action)
            if not need or not has_perm(admin, need):
                return err("Недостаточно прав для этого действия", 403)

            # Опасные действия требуют подтверждения паролем
            if action in CONFIRM_ACTIONS:
                confirm = body.get("confirm_password") or ""
                cur.execute(
                    f"SELECT password_hash FROM {SCHEMA}.dev_admins WHERE id = %s",
                    (admin["id"],),
                )
                prow = cur.fetchone()
                if not confirm or not prow or not verify_password(confirm, prow[0]):
                    return err("Подтвердите паролем", 428)

        # ── Вход через ВКонтакте ─────────────────────────────────────────
        if action == "vk_start":
            if not _rate_limit(cur, f"devvk:ip:{ip}", 10):
                conn.commit()
                return err("Слишком много попыток. Подождите минуту.", 429)
            url, state, poll_key = _vk_auth_url(cur, "admin")
            if not url:
                return err("Вход через ВКонтакте не настроен")
            return ok({"url": url, "state": state, "poll_key": poll_key})

        if action == "vk_poll":
            if not _rate_limit(cur, f"devvkpoll:ip:{ip}", 60):
                conn.commit()
                return err("Слишком много запросов. Подождите минуту.", 429)
            state = str(body.get("state") or "")
            poll_key = str(body.get("poll_key") or "")
            cur.execute(
                f"SELECT id, poll_key_hash, status, vk_user_id, error, purpose FROM {SCHEMA}.vk_logins WHERE state = %s",
                (state,),
            )
            r = cur.fetchone()
            if not r or not poll_key or not secrets.compare_digest(r[1], hashlib.sha256(poll_key.encode()).hexdigest()):
                return err("Заявка не найдена", 404)
            lid, _, status, vk_id, error, purpose = r
            if purpose == "admin_link":
                if status == "linked":
                    cur.execute(f"UPDATE {SCHEMA}.vk_logins SET status = 'used' WHERE id = %s", (lid,))
                    return ok({"status": "linked"})
                return ok({"status": status, "error": error})
            if purpose != "admin":
                return err("Заявка не найдена", 404)
            if status != "admin_ok":
                return ok({"status": status, "error": error})
            cur.execute(f"UPDATE {SCHEMA}.vk_logins SET status = 'used' WHERE id = %s AND status = 'admin_ok'", (lid,))
            if cur.rowcount != 1:
                return ok({"status": "used"})
            cur.execute(
                f"SELECT id, email, name, role, disabled, title, avatar_url FROM {SCHEMA}.dev_admins "
                f"WHERE vk_id = %s ORDER BY id LIMIT 1",
                (int(vk_id),),
            )
            row = cur.fetchone()
            if not row:
                cur.execute(
                    f"SELECT a.id, a.email, a.name, a.role, a.disabled, a.title, a.avatar_url "
                    f"FROM {SCHEMA}.dev_admins a JOIN {SCHEMA}.users u ON u.id = a.nova_user_id "
                    f"WHERE u.vk_id = %s ORDER BY a.id LIMIT 1",
                    (int(vk_id),),
                )
                row = cur.fetchone()
            if not row:
                return ok({"status": "no_access",
                           "error": "Этот ВКонтакте не привязан ни к одному сотруднику панели. Войдите по почте и привяжите ВК в настройках."})
            if row[4]:
                return err("Доступ заблокирован", 403)
            token = _issue_session(cur, event, ip, row[0])
            cur_admin = {"id": row[0], "email": row[1], "name": row[2], "role": row[3],
                         "title": row[5] or "", "avatar_url": row[6] or "",
                         "role_label": ROLES.get(row[3], {}).get("label", row[3])}
            audit(cur, cur_admin, "login", "Вход в панель через ВКонтакте", ip)
            return ok({"status": "done", "token": token, "admin": cur_admin})

        if action == "vk_me":
            cur.execute(f"SELECT vk_id FROM {SCHEMA}.dev_admins WHERE id = %s", (admin["id"],))
            r = cur.fetchone()
            return ok({"linked": bool(r and r[0]), "vk_id": r[0] if r else None})

        if action == "vk_link_start":
            url, state, poll_key = _vk_auth_url(cur, "admin_link", admin["id"])
            if not url:
                return err("Вход через ВКонтакте не настроен")
            return ok({"url": url, "state": state, "poll_key": poll_key})

        if action == "vk_unlink":
            cur.execute(f"UPDATE {SCHEMA}.dev_admins SET vk_id = NULL WHERE id = %s", (admin["id"],))
            audit(cur, admin, "vk_unlink", "Отвязан ВКонтакте", ip)
            return ok({"success": True})

        # ── Роль в панели для пользователя приложения ────────────────────
        if action == "user_panel_role":
            uid = int(body.get("user_id") or 0)
            cur.execute(
                f"SELECT id, role, disabled FROM {SCHEMA}.dev_admins WHERE nova_user_id = %s ORDER BY id LIMIT 1",
                (uid,),
            )
            r = cur.fetchone()
            return ok({
                "role": (r[1] if r and not r[2] else ""),
                "roles": [{"key": k, "label": v["label"]} for k, v in ROLES.items() if k != "owner"],
                "can_grant": has_perm(admin, "team"),
            })

        if action == "grant_role":
            uid = int(body.get("user_id") or 0)
            role = (body.get("role") or "").strip()
            if role and (role not in ROLES or role == "owner"):
                return err("Эту роль выдать нельзя")
            cur.execute(f"SELECT id, name, vk_id, phone FROM {SCHEMA}.users WHERE id = %s", (uid,))
            u = cur.fetchone()
            if not u:
                return err("Пользователь не найден", 404)
            cur.execute(f"SELECT id, role FROM {SCHEMA}.dev_admins WHERE nova_user_id = %s ORDER BY id LIMIT 1", (uid,))
            ex = cur.fetchone()
            if ex and ex[0] == admin["id"]:
                return err("Нельзя менять собственную роль")
            if ex and ex[1] == "owner":
                return err("Роль основателя менять нельзя")
            if not role:
                if ex:
                    cur.execute(f"UPDATE {SCHEMA}.dev_admins SET disabled = TRUE WHERE id = %s", (ex[0],))
                    cur.execute(f"UPDATE {SCHEMA}.dev_sessions SET expires_at = 0 WHERE admin_id = %s", (ex[0],))
                audit(cur, admin, "grant_role", f"Снята роль у {u[1] or 'ID ' + str(uid)}", ip)
                return ok({"success": True, "role": ""})
            label = ROLES[role]["label"]
            if ex:
                cur.execute(
                    f"UPDATE {SCHEMA}.dev_admins SET role = %s, title = %s, disabled = FALSE, "
                    f"vk_id = COALESCE(vk_id, %s) WHERE id = %s",
                    (role, label, u[2], ex[0]),
                )
            else:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.dev_admins (email, password_hash, name, role, title, vk_id, nova_user_id) "
                    f"VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (f"user{uid}@nova.local", hash_password(secrets.token_urlsafe(24)),
                     (u[1] or f"ID {uid}")[:60], role, label, u[2], uid),
                )
            audit(cur, admin, "grant_role", f"Выдана роль «{label}» пользователю {u[1] or 'ID ' + str(uid)}", ip)
            how = ("Войдите через кнопку «Войти через ВКонтакте» — пароль не нужен."
                   if u[2] else
                   "Чтобы войти, сначала привяжите ВКонтакте в приложении: Настройки → Вход через ВКонтакте. "
                   "Затем нажмите в панели «Войти через ВКонтакте».")
            try:
                send_from_nova(cur, uid,
                               f"Вам выдана роль «{label}» в панели Nova.\n\n"
                               f"Вход в панель: https://novaa.pro/dev\n{how}")
            except Exception as e:
                print(f"[grant_role] msg: {e}")
            return ok({"success": True, "role": role, "has_vk": bool(u[2])})

        # ── Версия приложения для окна «Доступна новая версия» ───────────
        if action == "app_version_get":
            cur.execute(f"SELECT key, value FROM {SCHEMA}.dev_settings WHERE key IN ('app_latest_version', 'app_whats_new')")
            kv = {k: v for k, v in cur.fetchall()}
            return ok({"latest": kv.get("app_latest_version") or "", "whats_new": kv.get("app_whats_new") or ""})

        if action == "app_version_save":
            ver = str(body.get("version") or "").strip().lstrip("vV")[:20]
            note = str(body.get("whats_new") or "").strip()[:1000]
            for k, v in (("app_latest_version", ver), ("app_whats_new", note)):
                cur.execute(
                    f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_at, updated_by) VALUES (%s, %s, %s, %s) "
                    f"ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by",
                    (k, v, int(time.time()), admin["id"]),
                )
            audit(cur, admin, "app_version_save", f"Последняя версия приложения: {ver or 'не указана'}", ip)
            return ok({"success": True})

        # ── Версии приложения у пользователей ────────────────────────────
        if action == "app_versions_stats":
            cur.execute(f"SELECT value FROM {SCHEMA}.dev_settings WHERE key = 'app_latest_version'")
            r = cur.fetchone()
            latest = (r[0] if r else "") or ""
            cur.execute(
                f"SELECT COALESCE(app_version, ''), COUNT(*) FROM {SCHEMA}.users "
                f"WHERE COALESCE(app_platform, '') = 'android' AND COALESCE(is_service, FALSE) = FALSE "
                f"GROUP BY 1"
            )
            rows = cur.fetchall()

            def key(v):
                try:
                    return tuple(int(x) for x in v.split("."))
                except ValueError:
                    return (0,)
            items = sorted(({"version": v, "count": int(c)} for v, c in rows), key=lambda x: key(x["version"]), reverse=True)
            if not latest and items:
                latest = items[0]["version"]
            outdated = sum(i["count"] for i in items if latest and key(i["version"]) < key(latest))
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE COALESCE(app_platform, '') = 'web' "
                f"AND COALESCE(is_service, FALSE) = FALSE"
            )
            web = int(cur.fetchone()[0] or 0)
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE app_version IS NULL AND COALESCE(is_service, FALSE) = FALSE"
            )
            unknown = int(cur.fetchone()[0] or 0)
            for i in items:
                i["outdated"] = bool(latest and key(i["version"]) < key(latest))
            return ok({"latest": latest, "items": items, "outdated": outdated, "web": web, "unknown": unknown})

        if action == "app_outdated_users":
            cur.execute(f"SELECT value FROM {SCHEMA}.dev_settings WHERE key = 'app_latest_version'")
            r = cur.fetchone()
            latest = str(body.get("latest") or (r[0] if r else "") or "").strip()

            def key(v):
                try:
                    return tuple(int(x) for x in str(v).split("."))
                except ValueError:
                    return (0,)
            cur.execute(
                f"SELECT id, COALESCE(name, ''), COALESCE(avatar_url, ''), COALESCE(app_version, ''), "
                f"COALESCE(last_seen, 0), COALESCE(app_version_at, 0), COALESCE(update_nudged_version, ''), "
                f"COALESCE(app_platform, '') "
                f"FROM {SCHEMA}.users WHERE COALESCE(is_service, FALSE) = FALSE "
                f"AND COALESCE(name, '') <> 'Удалённый аккаунт' AND COALESCE(app_platform, '') <> 'web' "
                f"AND (app_platform = 'android' OR app_version IS NULL)"
            )
            only = str(body.get("version") or "").strip()
            users = []
            for uid, name, avatar, ver, seen, ver_at, nudged, plat in cur.fetchall():
                if ver and latest and key(ver) >= key(latest):
                    continue
                ver = ver or "неизвестна"
                if only and ver != only:
                    continue
                users.append({
                    "id": uid, "name": name or f"ID {uid}", "avatar_url": avatar or None, "version": ver,
                    "last_seen": int(max(seen or 0, ver_at or 0)), "nudged": nudged == latest,
                })
            users.sort(key=lambda u: u["last_seen"], reverse=True)
            return ok({"latest": latest, "total": len(users), "users": users[:500]})

        if action == "app_update_nudge":
            cur.execute(f"SELECT value FROM {SCHEMA}.dev_settings WHERE key = 'app_latest_version'")
            r = cur.fetchone()
            latest = str(body.get("latest") or (r[0] if r else "") or "").strip()
            if not latest:
                return err("Неизвестна последняя версия — откройте раздел «Публикация в RuStore»")
            text = (body.get("text") or "").strip() or (
                f"Вышла новая версия Nova {latest}! Обновите приложение в RuStore, чтобы получить "
                f"новые функции и исправления: https://www.rustore.ru/catalog/app/ru.nova.messenger"
            )
            def key(v):
                try:
                    return tuple(int(x) for x in str(v).split("."))
                except ValueError:
                    return (0,)
            ids = [int(x) for x in (body.get("user_ids") or []) if str(x).isdigit()][:500]
            if ids:
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.users WHERE id = ANY(%s) AND COALESCE(is_service, FALSE) = FALSE "
                    f"AND COALESCE(banned_until, 0) < %s AND COALESCE(name, '') <> 'Удалённый аккаунт'",
                    (ids, int(time.time())),
                )
                targets = [row[0] for row in cur.fetchall()]
            else:
                cur.execute(
                    f"SELECT id, app_version FROM {SCHEMA}.users WHERE COALESCE(app_platform, '') = 'android' "
                    f"AND app_version IS NOT NULL AND COALESCE(is_service, FALSE) = FALSE "
                    f"AND COALESCE(banned_until, 0) < %s AND COALESCE(update_nudged_version, '') <> %s",
                    (int(time.time()), latest),
                )
                targets = [row[0] for row in cur.fetchall() if key(row[1]) < key(latest)][:500]
            sent = 0
            for uid in targets:
                try:
                    send_from_nova(cur, uid, text)
                    cur.execute(f"UPDATE {SCHEMA}.users SET update_nudged_version = %s WHERE id = %s", (latest, uid))
                    sent += 1
                except Exception as e:
                    print(f"[nudge] {uid}: {e}")
            audit(cur, admin, "app_update_nudge", f"Напоминание об обновлении до {latest}: {sent} чел." + (" (выборочно)" if ids else ""), ip)
            return ok({"success": True, "sent": sent})

        # ── Регистрация по коду-приглашению ──────────────────────────────
        if action == "register":
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""
            name = (body.get("name") or "").strip()
            code = (body.get("invite_code") or "").strip().upper()

            # Защита от перебора кодов-приглашений
            if not _rate_limit(cur, f"devreg:ip:{ip}", 5):
                conn.commit()
                return err("Слишком много попыток. Подождите минуту.", 429)
            conn.commit()

            if "@" not in email or "." not in email.split("@")[-1]:
                return err("Укажите корректный адрес почты")
            if len(password) < 8:
                return err("Пароль должен быть не короче 8 символов")
            if not code:
                return err("Нужен код-приглашение")

            cur.execute(f"SELECT code, used_by, role FROM {SCHEMA}.dev_invites WHERE code = %s", (code,))
            inv = cur.fetchone()
            if not inv:
                return err("Код-приглашение не найден")
            if inv[1]:
                return err("Этот код уже использован")

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.dev_admins")
            first_admin = cur.fetchone()[0] == 0
            new_role = "owner" if first_admin else (inv[2] or "moderator")
            new_title = "Основатель" if first_admin else ROLES.get(new_role, {}).get("label", "")

            cur.execute(f"SELECT id FROM {SCHEMA}.dev_admins WHERE email = %s", (email,))
            if cur.fetchone():
                return err("Аккаунт с такой почтой уже существует")

            cur.execute(
                f"INSERT INTO {SCHEMA}.dev_admins (email, password_hash, name, role, title) "
                f"VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (email, hash_password(password), name or email.split("@")[0], new_role, new_title),
            )
            admin_id = cur.fetchone()[0]

            now = int(time.time())
            cur.execute(
                f"UPDATE {SCHEMA}.dev_invites SET used_by = %s, used_at = %s WHERE code = %s",
                (admin_id, now, code),
            )

            token = secrets.token_urlsafe(32)
            cur.execute(
                f"INSERT INTO {SCHEMA}.dev_sessions (token, admin_id, expires_at, ip_addr, user_agent) "
                f"VALUES (%s, %s, %s, %s, %s)",
                (token, admin_id, now + SESSION_TTL, ip, ((event.get("headers") or {}).get("User-Agent") or "")[:300]),
            )
            new_admin = {"id": admin_id, "email": email, "name": name, "role": new_role,
                         "title": new_title, "role_label": ROLES.get(new_role, {}).get("label", new_role)}
            audit(cur, new_admin, "register", f"Регистрация по коду {code}", ip)
            return ok({"token": token, "admin": new_admin})

        # ── Вход ──────────────────────────────────────────────────────────
        if action == "login":
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""

            # Защита от подбора пароля: не больше 5 попыток в минуту
            # с одного адреса и не больше 5 на одну почту.
            if not _rate_limit(cur, f"devlogin:ip:{ip}", 5) or \
               not _rate_limit(cur, f"devlogin:mail:{email}", 5):
                conn.commit()
                return err("Слишком много попыток входа. Подождите минуту.", 429)
            conn.commit()

            cur.execute(
                f"SELECT id, email, name, role, password_hash, disabled, title, avatar_url, "
                f"COALESCE(twofa_enabled, FALSE), COALESCE(phone, '') "
                f"FROM {SCHEMA}.dev_admins WHERE email = %s",
                (email,),
            )
            row = cur.fetchone()
            if not row or not verify_password(password, row[4]):
                return err("Неверная почта или пароль", 401)
            if row[5]:
                return err("Доступ заблокирован", 403)

            now = int(time.time())

            # Двухэтапный вход: пароль верный, но нужен код из SMS
            if SMS_ENABLED and row[8] and row[9]:
                submitted = (body.get("code") or "").strip()
                if not submitted:
                    code = f"{secrets.randbelow(900000) + 100000}"
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.dev_login_codes "
                        f"(admin_id, code, expires_at, ip_addr) VALUES (%s, %s, %s, %s)",
                        (row[0], code, now + 300, ip),
                    )
                    conn.commit()
                    sent = _send_login_sms(row[9], code)
                    masked = row[9][:-4].replace(row[9][2:-4], "*" * max(len(row[9]) - 6, 0)) + row[9][-4:]
                    if not sent:
                        return err("Не удалось отправить код. Попробуйте позже.", 503)
                    return ok({"need_code": True, "phone_hint": masked})

                cur.execute(
                    f"SELECT id FROM {SCHEMA}.dev_login_codes "
                    f"WHERE admin_id = %s AND code = %s AND used = FALSE AND expires_at > %s "
                    f"ORDER BY id DESC LIMIT 1",
                    (row[0], submitted, now),
                )
                found = cur.fetchone()
                if not found:
                    return err("Неверный или устаревший код", 401)
                cur.execute(
                    f"UPDATE {SCHEMA}.dev_login_codes SET used = TRUE WHERE id = %s",
                    (found[0],),
                )
            token = secrets.token_urlsafe(32)
            cur.execute(
                f"INSERT INTO {SCHEMA}.dev_sessions (token, admin_id, expires_at, ip_addr, user_agent) "
                f"VALUES (%s, %s, %s, %s, %s)",
                (token, row[0], now + SESSION_TTL, ip, ((event.get("headers") or {}).get("User-Agent") or "")[:300]),
            )
            cur.execute(f"UPDATE {SCHEMA}.dev_admins SET last_login = %s WHERE id = %s", (now, row[0]))
            cur_admin = {"id": row[0], "email": row[1], "name": row[2], "role": row[3],
                         "title": row[6] or "", "avatar_url": row[7] or "",
                         "role_label": ROLES.get(row[3], {}).get("label", row[3])}
            audit(cur, cur_admin, "login", "Вход в панель", ip)

            ua = ((event.get("headers") or {}).get("User-Agent") or "")
            device = "Телефон" if "Mobile" in ua else "Компьютер"
            when = time.strftime("%d.%m.%Y в %H:%M", time.localtime(now + 3 * 3600))
            cur.execute(
                f"INSERT INTO {SCHEMA}.dev_notifications (kind, title, body, link_section, read_by) "
                f"VALUES (%s, %s, %s, %s, %s)",
                ("login", f"Вход в панель: {cur_admin['name'] or cur_admin['email']}",
                 f"{cur_admin['role_label']} · {device} · IP {ip} · {when}", "logs", str(cur_admin["id"])),
            )
            return ok({"token": token, "admin": cur_admin, "login_notice": {
                "name": cur_admin["name"] or cur_admin["email"],
                "role": cur_admin["role_label"],
                "device": device, "ip": ip, "when": when,
            }})

        if action == "panel_info":
            cur.execute(
                f"SELECT key, value FROM {SCHEMA}.dev_settings "
                f"WHERE key IN ('panel_name','panel_subtitle','panel_logo_url','panel_logo_icon',"
                f"'panel_bg_style','panel_bg_image')"
            )
            st = {r[0]: r[1] for r in cur.fetchall()}
            return ok({
                "name": st.get("panel_name") or "Nova Dev Panel",
                "subtitle": st.get("panel_subtitle") or "Панель управления мессенджером",
                "logo_url": st.get("panel_logo_url") or "",
                "logo_icon": st.get("panel_logo_icon") or "Terminal",
                "bg_style": st.get("panel_bg_style") or "aurora",
                "bg_image": st.get("panel_bg_image") or "",
            })

        if action == "check_setup":
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.dev_admins")
            return ok({"has_admins": cur.fetchone()[0] > 0})

        if action == "me":
            role = ROLES.get(admin.get("role") or "", {})
            cur.execute(f"SELECT key, value FROM {SCHEMA}.dev_settings")
            settings = {r[0]: r[1] for r in cur.fetchall()}
            return ok({
                "admin": {**admin, "role_label": role.get("label", admin.get("role"))},
                "perms": role.get("perms", []),
                "settings": settings,
            })

        if action == "logout":
            token = (event.get("headers") or {}).get("X-Dev-Token") or ""
            cur.execute(f"DELETE FROM {SCHEMA}.dev_sessions WHERE token = %s", (token,))
            audit(cur, admin, "logout", "Выход из панели", ip)
            return ok({"success": True})

        # ── Статистика использования ──────────────────────────────────────
        if action == "usage_stats":
            days = max(7, min(int(body.get("days") or 30), 90))
            cur.execute(
                f"""SELECT d::date, COALESCE(a.cnt, 0)
                    FROM generate_series(CURRENT_DATE - (%s - 1), CURRENT_DATE, interval '1 day') d
                    LEFT JOIN (SELECT day, COUNT(*) cnt FROM {SCHEMA}.daily_active
                               WHERE day > CURRENT_DATE - %s GROUP BY day) a ON a.day = d::date
                    ORDER BY d""",
                (days, days)
            )
            dau = [{"day": r[0].isoformat(), "users": int(r[1])} for r in cur.fetchall()]
            cur.execute(
                f"SELECT COUNT(DISTINCT user_id) FROM {SCHEMA}.daily_active WHERE day > CURRENT_DATE - 7"
            )
            wau = int(cur.fetchone()[0] or 0)
            cur.execute(
                f"SELECT COUNT(DISTINCT user_id) FROM {SCHEMA}.daily_active WHERE day > CURRENT_DATE - 30"
            )
            mau = int(cur.fetchone()[0] or 0)
            since = int(time.time()) - days * 86400
            cur.execute(
                f"""SELECT feature, COUNT(*), COUNT(DISTINCT user_id)
                    FROM {SCHEMA}.feature_events WHERE created_at > %s
                    GROUP BY feature ORDER BY COUNT(*) DESC LIMIT 40""",
                (since,)
            )
            features = [{"feature": r[0], "uses": int(r[1]), "users": int(r[2])} for r in cur.fetchall()]
            cur.execute(
                f"""SELECT COUNT(*),
                           COUNT(*) FILTER (WHERE status = 'answered'),
                           COUNT(*) FILTER (WHERE status = 'missed'),
                           COALESCE(SUM(duration), 0),
                           COUNT(*) FILTER (WHERE is_video)
                    FROM {SCHEMA}.call_log WHERE started_at > %s""",
                (since,)
            )
            c = cur.fetchone()
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.referrals WHERE created_at > %s", (since,)
            )
            refs = int(cur.fetchone()[0] or 0)
            return ok({
                "days": days, "dau": dau, "wau": wau, "mau": mau,
                "dau_today": dau[-1]["users"] if dau else 0,
                "features": features,
                "calls": {"total": int(c[0] or 0), "answered": int(c[1] or 0), "missed": int(c[2] or 0),
                          "minutes": round(int(c[3] or 0) / 60), "video": int(c[4] or 0)},
                "referrals": refs,
            })

        # ── Дашборд ───────────────────────────────────────────────────────
        if action == "dashboard":
            now = int(time.time())

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
            total_users = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE last_seen > %s", (now - 300,))
            online_now = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE last_seen > %s", (now - 86400,))
            active_24h = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE created_at > %s", (now - 86400,))
            new_24h = cur.fetchone()[0]

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages")
            total_msgs = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE created_at > %s", (now - 86400,))
            msgs_24h = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE created_at > %s", (now - 3600,))
            msgs_1h = cur.fetchone()[0]

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.chats")
            total_chats = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.groups")
            total_groups = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.groups WHERE is_channel = true")
            total_channels = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.stories WHERE expires_at > %s", (now,))
            active_stories = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.call_signals WHERE created_at > %s", (now - 86400,))
            calls_24h = cur.fetchone()[0]

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.reports")
            reports_total = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.support_tickets WHERE status != 'closed'")
            open_tickets = cur.fetchone()[0]

            # График сообщений по часам за сутки
            cur.execute(
                f"SELECT FLOOR((%s - created_at) / 3600) AS h, COUNT(*) "
                f"FROM {SCHEMA}.messages WHERE created_at > %s GROUP BY h ORDER BY h",
                (now, now - 86400),
            )
            buckets = {int(r[0]): int(r[1]) for r in cur.fetchall()}
            chart = [{"hour": f"{23 - i}ч", "value": buckets.get(23 - i, 0)} for i in range(24)]

            return ok({
                "users": {"total": total_users, "online": online_now, "active_24h": active_24h, "new_24h": new_24h},
                "messages": {"total": total_msgs, "last_24h": msgs_24h, "last_hour": msgs_1h},
                "content": {"chats": total_chats, "groups": total_groups, "channels": total_channels,
                            "stories": active_stories, "calls_24h": calls_24h},
                "moderation": {"reports": reports_total, "open_tickets": open_tickets},
                "chart": chart,
                "server_time": now,
            })

        # ── Пользователи ──────────────────────────────────────────────────
        if action == "users":
            q = (body.get("query") or "").strip()
            limit = min(int(body.get("limit") or 50), 200)
            offset = int(body.get("offset") or 0)

            if q:
                like = f"%{q}%"
                cur.execute(
                    f"SELECT id, name, phone, created_at, last_seen, avatar_url, COALESCE(verified, FALSE), vk_id, nova_id "
                    f"FROM {SCHEMA}.users "
                    f"WHERE id > 0 AND (name ILIKE %s OR phone ILIKE %s OR CAST(vk_id AS TEXT) ILIKE %s OR nova_id = %s) "
                    f"ORDER BY last_seen DESC NULLS LAST LIMIT %s OFFSET %s",
                    (like, like, like, q.replace(" ", ""), limit, offset),
                )
            else:
                cur.execute(
                    f"SELECT id, name, phone, created_at, last_seen, avatar_url, COALESCE(verified, FALSE), vk_id, nova_id "
                    f"FROM {SCHEMA}.users WHERE id > 0 "
                    f"ORDER BY last_seen DESC NULLS LAST LIMIT %s OFFSET %s",
                    (limit, offset),
                )
            rows = cur.fetchall()
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE id > 0")
            total = cur.fetchone()[0]

            now = int(time.time())
            users = [{
                "id": r[0], "name": r[1], "phone": r[2],
                "created_at": r[3], "last_seen": r[4], "avatar_url": r[5],
                "verified": bool(r[6]) if len(r) > 6 else False,
                "online": bool(r[4] and r[4] > now - 60),
                "vk_id": r[7], "phone_missing": str(r[2] or "").startswith("vk"),
                "nova_id": r[8],
            } for r in rows]
            return ok({"users": users, "total": total})

        if action == "user_detail":
            uid = int(body.get("user_id") or 0)
            cur.execute(
                f"SELECT id, name, phone, created_at, last_seen, avatar_url, about, banned_until, banned_reason, "
                f"COALESCE(wallet_balance, 0), COALESCE(verified, FALSE), vk_id, nova_id FROM {SCHEMA}.users WHERE id = %s",
                (uid,),
            )
            r = cur.fetchone()
            if not r:
                return err("Пользователь не найден", 404)
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE sender_id = %s", (uid,))
            msg_count = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.contacts WHERE user_id = %s", (uid,))
            contacts = cur.fetchone()[0]
            return ok({"user": {
                "id": r[0], "name": r[1], "phone": r[2], "created_at": r[3],
                "last_seen": r[4], "avatar_url": r[5], "about": r[6],
                "banned_until": r[7], "banned_reason": r[8], "wallet_balance": int(r[9] or 0),
                "verified": bool(r[10]) if len(r) > 10 else False,
                "messages": msg_count, "contacts": contacts,
                "vk_id": r[11], "phone_missing": str(r[2] or "").startswith("vk"),
                "nova_id": r[12],
            }})

        if action == "ban_user":
            uid = int(body.get("user_id") or 0)
            days = int(body.get("days") or 0)
            reason = (body.get("reason") or "Нарушение правил").strip()
            now = int(time.time())

            cur.execute(
                f"SELECT COALESCE(banned_until, 0), COALESCE(banned_reason, ''), name "
                f"FROM {SCHEMA}.users WHERE id = %s",
                (uid,),
            )
            _prev = cur.fetchone()
            if _prev:
                remember_undo(
                    cur, admin, "ban_user",
                    f"{'Блокировка' if days > 0 else 'Разблокировка'} {_prev[2] or f'ID {uid}'}",
                    {"user_id": uid, "banned_until": int(_prev[0] or 0) or None,
                     "banned_reason": _prev[1] or None},
                )
                cur.execute(
                    f"INSERT INTO {SCHEMA}.ban_history (user_id, until_ts, reason, by_admin, kind) "
                    f"VALUES (%s, %s, %s, %s, %s)",
                    (uid, now + days * 86400 if days > 0 else None, reason,
                     admin["email"], "ban" if days > 0 else "unban"),
                )
            if days > 0:
                until = now + days * 86400
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET banned_until = %s, banned_reason = %s, banned_at = %s WHERE id = %s",
                    (until, reason, now, uid),
                )
                audit(cur, admin, "ban_user", f"Блокировка ID {uid} на {days} дн: {reason}", ip)
                human = "навсегда" if days >= 3650 else f"на {days} дн."
                cur.execute(
                    f"INSERT INTO {SCHEMA}.user_notifications (user_id, kind, title, body) "
                    f"VALUES (%s, %s, %s, %s)",
                    (uid, "ban", f"Аккаунт заблокирован {human}", reason),
                )

            else:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET banned_until = NULL, banned_reason = NULL WHERE id = %s",
                    (uid,),
                )
                audit(cur, admin, "unban_user", f"Разблокировка ID {uid}", ip)
                cur.execute(
                    f"INSERT INTO {SCHEMA}.user_notifications (user_id, kind, title, body) "
                    f"VALUES (%s, %s, %s, %s)",
                    (uid, "unban", "Блокировка снята", "Доступ к аккаунту восстановлен."),
                )
            return ok({"success": True})

        if action == "reports":
            cur.execute(
                f"SELECT r.id, r.reporter_id, ru.name, r.reported_user_id, tu.name, "
                f"r.reason, r.comment, r.status, r.created_at FROM {SCHEMA}.reports r "
                f"LEFT JOIN {SCHEMA}.users ru ON ru.id = r.reporter_id "
                f"LEFT JOIN {SCHEMA}.users tu ON tu.id = r.reported_user_id "
                f"ORDER BY r.created_at DESC LIMIT 100"
            )
            reports = [{
                "id": r[0], "reporter_id": r[1], "reporter_name": r[2] or f"ID {r[1]}",
                "target_id": r[3], "target_name": r[4] or f"ID {r[3]}",
                "reason": r[5], "comment": r[6], "status": r[7], "created_at": r[8],
            } for r in cur.fetchall()]
            return ok({"reports": reports})

        if action == "report_resolve":
            rid = int(body.get("report_id") or 0)
            cur.execute(f"UPDATE {SCHEMA}.reports SET status = 'resolved' WHERE id = %s", (rid,))
            audit(cur, admin, "report_resolve", f"Жалоба #{rid} рассмотрена", ip)
            return ok({"success": True})

        # ── Профиль: устройства, чаты, медиа ──────────────────────────────
        if action == "user_devices":
            uid = int(body.get("user_id") or 0)
            cur.execute(
                f"SELECT id, endpoint, created_at FROM {SCHEMA}.push_subscriptions "
                f"WHERE user_id = %s ORDER BY created_at DESC",
                (uid,),
            )
            devices = []
            for r in cur.fetchall():
                ep = r[1] or ""
                if "mozilla" in ep:
                    kind = "Firefox"
                elif "apple" in ep:
                    kind = "Apple / Safari"
                elif "google" in ep or "fcm" in ep:
                    kind = "Chrome / Android"
                else:
                    kind = "Браузер"
                devices.append({"id": r[0], "kind": kind, "created_at": r[2]})
            return ok({"devices": devices})

        if action == "user_chats":
            uid = int(body.get("user_id") or 0)
            cur.execute(
                f"SELECT c.id, c.user1_id, c.user2_id, c.last_message, c.last_message_at, "
                f"u1.name, u2.name FROM {SCHEMA}.chats c "
                f"LEFT JOIN {SCHEMA}.users u1 ON u1.id = c.user1_id "
                f"LEFT JOIN {SCHEMA}.users u2 ON u2.id = c.user2_id "
                f"WHERE c.user1_id = %s OR c.user2_id = %s "
                f"ORDER BY c.last_message_at DESC NULLS LAST LIMIT 100",
                (uid, uid),
            )
            chats = []
            for r in cur.fetchall():
                partner_id = r[2] if r[1] == uid else r[1]
                partner_name = r[6] if r[1] == uid else r[5]
                chats.append({
                    "id": r[0], "partner_id": partner_id,
                    "partner_name": partner_name or f"ID {partner_id}",
                    "last_message": r[3], "last_message_at": r[4],
                })
            return ok({"chats": chats})

        if action == "chat_messages":
            chat_id = int(body.get("chat_id") or 0)
            cur.execute(
                f"SELECT m.id, m.sender_id, u.name, m.text, m.created_at, m.media_type, "
                f"m.media_url, m.removed_at FROM {SCHEMA}.messages m "
                f"LEFT JOIN {SCHEMA}.users u ON u.id = m.sender_id "
                f"WHERE m.chat_id = %s ORDER BY m.created_at ASC LIMIT 500",
                (chat_id,),
            )
            msgs = [{
                "id": r[0], "sender_id": r[1], "sender_name": r[2] or f"ID {r[1]}",
                "text": r[3], "created_at": r[4], "media_type": r[5],
                "media_url": r[6], "removed": bool(r[7]),
            } for r in cur.fetchall()]
            audit(cur, admin, "view_chat", f"Просмотр переписки #{chat_id}", ip)
            return ok({"messages": msgs})

        if action == "delete_message":
            mid = int(body.get("message_id") or 0)
            cur.execute(
                f"UPDATE {SCHEMA}.messages SET removed_at = %s WHERE id = %s",
                (int(time.time()), mid),
            )
            audit(cur, admin, "delete_message", f"Удалено сообщение #{mid}", ip)
            return ok({"success": True})

        if action == "delete_chat":
            chat_id = int(body.get("chat_id") or 0)
            now = int(time.time())
            cur.execute(f"UPDATE {SCHEMA}.messages SET removed_at = %s WHERE chat_id = %s", (now, chat_id))
            audit(cur, admin, "delete_chat", f"Очищена переписка #{chat_id}", ip)
            return ok({"success": True})

        if action == "export_chat":
            chat_id = int(body.get("chat_id") or 0)
            cur.execute(
                f"SELECT m.id, u.name, m.text, m.created_at FROM {SCHEMA}.messages m "
                f"LEFT JOIN {SCHEMA}.users u ON u.id = m.sender_id "
                f"WHERE m.chat_id = %s ORDER BY m.created_at ASC",
                (chat_id,),
            )
            rows = [{"id": r[0], "author": r[1] or "—", "text": r[2],
                     "time": time.strftime("%Y-%m-%d %H:%M", time.localtime(r[3] or 0))}
                    for r in cur.fetchall()]
            audit(cur, admin, "export_chat", f"Выгрузка переписки #{chat_id}", ip)
            return ok({"chat_id": chat_id, "count": len(rows), "messages": rows})

        if action == "media_list":
            uid = int(body.get("user_id") or 0)
            cur.execute(
                f"SELECT id, media_type, media_url, file_name, file_size, created_at "
                f"FROM {SCHEMA}.messages WHERE sender_id = %s AND media_url IS NOT NULL "
                f"AND media_url != '' ORDER BY created_at DESC LIMIT 200",
                (uid,),
            )
            files = [{
                "id": r[0], "type": r[1] or "file", "url": r[2],
                "name": r[3] or "без имени", "size": r[4] or 0, "created_at": r[5],
            } for r in cur.fetchall()]
            return ok({"files": files})

        if action == "delete_media":
            mid = int(body.get("message_id") or 0)
            cur.execute(
                f"UPDATE {SCHEMA}.messages SET media_url = NULL, image_url = NULL, "
                f"removed_at = %s WHERE id = %s",
                (int(time.time()), mid),
            )
            audit(cur, admin, "delete_media", f"Удалён файл из сообщения #{mid}", ip)
            return ok({"success": True})

        # ── Действия над пользователем ────────────────────────────────────
        if action == "force_logout":
            uid = int(body.get("user_id") or 0)
            cur.execute(f"DELETE FROM {SCHEMA}.push_subscriptions WHERE user_id = %s", (uid,))
            cur.execute(f"UPDATE {SCHEMA}.users SET last_seen = 0 WHERE id = %s", (uid,))
            cur.execute(f"UPDATE {SCHEMA}.user_sessions SET revoked = TRUE WHERE user_id = %s", (uid,))
            audit(cur, admin, "force_logout", f"Выход со всех устройств ID {uid}", ip)
            return ok({"success": True})

        if action == "rename_user":
            uid = int(body.get("user_id") or 0)
            new_name = (body.get("name") or "").strip()
            if not new_name:
                return err("Имя не может быть пустым")
            cur.execute(f"SELECT name FROM {SCHEMA}.users WHERE id = %s", (uid,))
            _old = cur.fetchone()
            if _old:
                remember_undo(cur, admin, "rename_user",
                              f"Переименование «{_old[0]}» → «{new_name}»",
                              {"user_id": uid, "name": _old[0]})
            cur.execute(f"UPDATE {SCHEMA}.users SET name = %s WHERE id = %s", (new_name[:64], uid))
            audit(cur, admin, "rename_user", f"ID {uid} переименован в «{new_name}»", ip)
            return ok({"success": True})

        if action == "topup_wallet":
            uid = int(body.get("user_id") or 0)
            amount = int(body.get("amount") or 0)
            if amount == 0:
                return err("Укажите сумму")
            cur.execute(f"SELECT COALESCE(wallet_balance, 0) FROM {SCHEMA}.users WHERE id = %s", (uid,))
            row = cur.fetchone()
            if not row:
                return err("Пользователь не найден", 404)
            new_balance = int(row[0]) + amount
            if new_balance < 0:
                return err("Недостаточно средств для списания")
            cur.execute(f"UPDATE {SCHEMA}.users SET wallet_balance = %s WHERE id = %s", (new_balance, uid))
            cur.execute(
                f"INSERT INTO {SCHEMA}.wallet_transactions "
                f"(user_id, amount, kind, description, balance_after, created_at) "
                f"VALUES (%s, %s, %s, %s, %s, %s)",
                (uid, amount, "admin", f"Начисление из панели ({admin['email']})",
                 new_balance, int(time.time())),
            )
            audit(cur, admin, "topup_wallet", f"ID {uid}: {amount:+d} ₽, стало {new_balance} ₽", ip)
            return ok({"success": True, "balance": new_balance})

        if action == "delete_user":
            uid = int(body.get("user_id") or 0)
            if not has_perm(admin, "*") and admin.get("role") != "admin":
                return err("Удалять пользователей может только владелец или администратор", 403)
            now = int(time.time())
            cur.execute(f"SELECT name, phone FROM {SCHEMA}.users WHERE id = %s", (uid,))
            row = cur.fetchone()
            if not row:
                return err("Пользователь не найден", 404)
            cur.execute(
                f"UPDATE {SCHEMA}.users SET name = %s, phone = %s, avatar_url = NULL, about = NULL, vk_id = NULL, "
                f"banned_until = %s, banned_reason = %s, banned_at = %s, last_seen = 0 WHERE id = %s",
                ("Удалённый аккаунт", f"deleted_{uid}_{now}", now + 3650 * 86400,
                 "Аккаунт удалён администратором", now, uid),
            )
            cur.execute(f"UPDATE {SCHEMA}.messages SET removed_at = %s WHERE sender_id = %s", (now, uid))
            cur.execute(f"DELETE FROM {SCHEMA}.push_subscriptions WHERE user_id = %s", (uid,))
            audit(cur, admin, "delete_user", f"Удалён аккаунт ID {uid} ({row[0]}, {row[1]})", ip)
            return ok({"success": True})

        if action in ("purge_user", "purge_deleted"):
            if not has_perm(admin, "*") and admin.get("role") != "admin":
                return err("Стирать пользователей может только владелец или администратор", 403)
            if action == "purge_user":
                if int(body.get("user_id") or 0) <= 0:
                    return err("Это служебная запись системы, её удалять нельзя")
                ids = [int(body.get("user_id") or 0)]
            else:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE phone LIKE 'deleted_%%' LIMIT 200")
                ids = [r[0] for r in cur.fetchall()]
            nova = _nova_user_id(cur)
            done, kept = [], []
            for uid in ids:
                if uid <= 0 or uid == nova:
                    continue
                cur.execute(f"SELECT name, phone FROM {SCHEMA}.users WHERE id = %s AND COALESCE(is_service, FALSE) = FALSE", (uid,))
                row = cur.fetchone()
                if not row:
                    continue
                if _purge_user(cur, uid):
                    done.append(uid)
                else:
                    kept.append(uid)
                audit(cur, admin, "purge_user", f"Полностью стёрт аккаунт ID {uid} ({row[0]}, {row[1]})", ip)
            return ok({"success": True, "purged": len(done), "kept": len(kept)})

        # ── Каналы и группы ───────────────────────────────────────────────
        if action == "channels":
            cur.execute(
                f"SELECT g.id, g.name, g.description, g.avatar_url, g.is_channel, g.owner_id, "
                f"u.name, g.created_at, g.last_message_at, g.invite_link, "
                f"(SELECT COUNT(*) FROM {SCHEMA}.group_members m WHERE m.group_id = g.id AND m.role <> 'removed'), "
                f"(SELECT COUNT(*) FROM {SCHEMA}.group_messages gm WHERE gm.group_id = g.id AND gm.removed_at IS NULL), "
                f"COALESCE(g.verified, FALSE), COALESCE(g.is_test, FALSE), g.only_admins_post, g.last_message "
                f"FROM {SCHEMA}.groups g LEFT JOIN {SCHEMA}.users u ON u.id = g.owner_id "
                f"WHERE g.removed_at IS NULL "
                f"ORDER BY g.last_message_at DESC NULLS LAST LIMIT 100"
            )
            channels = [{
                "id": r[0], "name": r[1], "description": r[2], "avatar_url": r[3],
                "is_channel": bool(r[4]), "owner_id": r[5], "owner_name": r[6] or f"ID {r[5]}",
                "created_at": r[7], "last_message_at": r[8], "invite_link": r[9],
                "members": r[10], "messages": r[11],
                "verified": bool(r[12]) if len(r) > 12 else False,
                "is_test": bool(r[13]), "only_admins_post": bool(r[14]), "last_message": r[15] or "",
            } for r in cur.fetchall()]
            return ok({"channels": channels})

        if action == "channel_messages":
            gid = int(body.get("channel_id") or 0)
            before = int(body.get("before") or 0)
            cur.execute(
                f"SELECT m.id, m.sender_id, u.name, u.avatar_url, m.text, m.media_type, m.media_url, "
                f"m.kind, m.file_name, m.created_at, m.removed_at, m.edited_at "
                f"FROM {SCHEMA}.group_messages m LEFT JOIN {SCHEMA}.users u ON u.id = m.sender_id "
                f"WHERE m.group_id = %s AND (%s = 0 OR m.id < %s) "
                f"ORDER BY m.id DESC LIMIT 60",
                (gid, before, before),
            )
            rows = cur.fetchall()
            return ok({"messages": [{
                "id": r[0], "sender_id": r[1], "sender_name": r[2] or f"ID {r[1]}",
                "sender_avatar": r[3] or "", "text": r[4] or "", "media_type": r[5],
                "media_url": r[6], "kind": r[7] or "", "file_name": r[8], "created_at": r[9],
                "removed": r[10] is not None, "edited": bool(r[11]),
            } for r in reversed(rows)], "has_more": len(rows) == 60})

        if action == "channel_message_delete":
            mid = int(body.get("message_id") or 0)
            now = int(time.time())
            cur.execute(
                f"UPDATE {SCHEMA}.group_messages SET removed_at = %s, text = '', media_url = NULL "
                f"WHERE id = %s AND removed_at IS NULL RETURNING group_id",
                (now, mid),
            )
            row = cur.fetchone()
            if row:
                cur.execute(
                    f"SELECT text FROM {SCHEMA}.group_messages WHERE group_id = %s AND removed_at IS NULL "
                    f"ORDER BY id DESC LIMIT 1", (row[0],),
                )
                last = cur.fetchone()
                cur.execute(f"UPDATE {SCHEMA}.groups SET last_message = %s WHERE id = %s",
                            ((last[0] if last else "") or "", row[0]))
                audit(cur, admin, "channel_message_delete", f"Удалено сообщение #{mid} в группе #{row[0]}", ip)
            return ok({"success": True})

        if action == "channel_members":
            gid = int(body.get("channel_id") or 0)
            cur.execute(
                f"SELECT u.id, u.name, u.avatar_url, gm.role, gm.joined_at "
                f"FROM {SCHEMA}.group_members gm JOIN {SCHEMA}.users u ON u.id = gm.user_id "
                f"WHERE gm.group_id = %s AND gm.role <> 'removed' "
                f"ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, gm.joined_at",
                (gid,),
            )
            return ok({"members": [{
                "id": r[0], "name": r[1], "avatar_url": r[2] or "", "role": r[3], "joined_at": r[4],
            } for r in cur.fetchall()]})

        if action == "channel_post":
            gid = int(body.get("channel_id") or 0)
            text = (body.get("text") or "").strip()[:4000]
            media_url = (body.get("media_url") or "").strip() or None
            media_type = (body.get("media_type") or "").strip() or None
            if not text and not media_url:
                return err("Напишите текст поста")
            cur.execute(f"SELECT name, is_channel FROM {SCHEMA}.groups WHERE id = %s AND removed_at IS NULL", (gid,))
            g = cur.fetchone()
            if not g:
                return err("Группа не найдена", 404)
            nova = _nova_user_id(cur)
            now = int(time.time())
            cur.execute(
                f"INSERT INTO {SCHEMA}.group_members (group_id, user_id, role, joined_at) VALUES (%s, %s, 'admin', %s) "
                f"ON CONFLICT (group_id, user_id) DO UPDATE SET role = CASE WHEN {SCHEMA}.group_members.role = 'owner' "
                f"THEN 'owner' ELSE 'admin' END",
                (gid, nova, now),
            )
            cur.execute(
                f"INSERT INTO {SCHEMA}.group_messages (group_id, sender_id, text, media_type, media_url, created_at) "
                f"VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (gid, nova, text, media_type, media_url, now),
            )
            mid = cur.fetchone()[0]
            preview = text[:100] if text else "[медиа]"
            cur.execute(f"UPDATE {SCHEMA}.groups SET last_message = %s, last_message_at = %s WHERE id = %s", (preview, now, gid))
            try:
                key = hashlib.sha256((os.environ.get("DATABASE_URL", "") + "|nova-internal").encode()).hexdigest()
                req = Request(PUSH_URL, data=json.dumps({
                    "action": "send_group", "group_id": gid, "group_name": g[0], "sender_id": nova,
                    "message": preview, "message_id": mid, "is_channel": bool(g[1]),
                }).encode(), headers={"Content-Type": "application/json", "X-Internal-Key": key})
                urlopen(req, timeout=4)
            except Exception as e:
                print(f"[channel_post] push: {e}")
            audit(cur, admin, "channel_post", f"Пост от Nova в «{g[0]}» (#{gid}): {text[:80]}", ip)
            return ok({"success": True, "id": mid})

        if action == "nova_message":
            text = (body.get("text") or "").strip()[:4000]
            if not text:
                return err("Напишите сообщение")
            ids = []
            for x in (body.get("user_ids") or [])[:500]:
                try:
                    ids.append(int(x))
                except (TypeError, ValueError):
                    pass
            if not ids:
                return err("Выберите получателей")
            cur.execute(
                f"SELECT id FROM {SCHEMA}.users WHERE id = ANY(%s) AND COALESCE(is_service, FALSE) = FALSE "
                f"AND phone NOT LIKE 'deleted_%%'",
                (ids,),
            )
            targets = [r[0] for r in cur.fetchall()]
            sent = 0
            for uid in targets:
                try:
                    send_from_nova(cur, uid, text)
                    sent += 1
                except Exception as e:
                    print(f"[nova_message] {uid}: {e}")
            audit(cur, admin, "nova_message", f"Сообщение от Nova для {sent} чел.: {text[:80]}", ip)
            return ok({"success": True, "sent": sent})

        if action == "channel_set_test":
            gid = int(body.get("channel_id") or 0)
            value = bool(body.get("is_test"))
            cur.execute(f"UPDATE {SCHEMA}.groups SET is_test = %s WHERE id = %s", (value, gid))
            audit(cur, admin, "channel_set_test",
                  f"Группа #{gid}: {'скрыта от поиска' if value else 'снова видна в поиске'}", ip)
            return ok({"success": True})

        if action == "set_channel_verified":
            gid = int(body.get("channel_id") or 0)
            value = bool(body.get("verified"))
            now = int(time.time())
            cur.execute(
                f"UPDATE {SCHEMA}.groups SET verified = %s, verified_at = %s WHERE id = %s",
                (value, now if value else None, gid),
            )
            cur.execute(f"SELECT name, owner_id FROM {SCHEMA}.groups WHERE id = %s", (gid,))
            g = cur.fetchone()
            if value:
                cur.execute(
                    f"UPDATE {SCHEMA}.verification_requests SET status = 'approved', reviewer_id = %s, "
                    f"reviewed_at = %s WHERE target_type = 'channel' AND target_id = %s AND status = 'pending'",
                    (admin["id"], now, gid),
                )
            if g and g[1]:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.user_notifications (user_id, kind, title, body) "
                    f"VALUES (%s, %s, %s, %s)",
                    (g[1], "verification",
                     "Галочка выдана" if value else "Галочка снята",
                     f"«{g[0]}»: " + ("подтверждён" if value else "подтверждение отозвано")),
                )
            audit(cur, admin, "set_channel_verified",
                  f"Канал #{gid}: галочка {'выдана' if value else 'снята'}", ip)
            return ok({"success": True})

        if action == "channel_update":
            gid = int(body.get("channel_id") or 0)
            name = (body.get("name") or "").strip()
            desc = (body.get("description") or "").strip()
            if not name:
                return err("Название не может быть пустым")
            cur.execute(
                f"UPDATE {SCHEMA}.groups SET name = %s, description = %s WHERE id = %s",
                (name[:100], desc[:500], gid),
            )
            if "only_admins_post" in body:
                cur.execute(f"UPDATE {SCHEMA}.groups SET only_admins_post = %s WHERE id = %s",
                            (bool(body.get("only_admins_post")), gid))
            audit(cur, admin, "channel_update", f"Изменён канал #{gid}: {name}", ip)
            return ok({"success": True})

        if action == "channel_delete":
            gid = int(body.get("channel_id") or 0)
            now = int(time.time())
            cur.execute(f"UPDATE {SCHEMA}.group_messages SET removed_at = %s WHERE group_id = %s", (now, gid))
            cur.execute(f"DELETE FROM {SCHEMA}.group_members WHERE group_id = %s", (gid,))
            cur.execute(
                f"UPDATE {SCHEMA}.groups SET removed_at = %s, invite_link = NULL WHERE id = %s",
                (now, gid),
            )
            audit(cur, admin, "channel_delete", f"Удалён канал #{gid}", ip)
            return ok({"success": True})

        # ── Команда панели ────────────────────────────────────────────────
        if action == "team":
            cur.execute(
                f"SELECT id, email, name, role, title, created_at, last_login, disabled, avatar_url "
                f"FROM {SCHEMA}.dev_admins ORDER BY created_at ASC"
            )
            team = [{
                "id": r[0], "email": r[1], "name": r[2], "role": r[3], "title": r[4],
                "role_label": ROLES.get(r[3], {}).get("label", r[3]),
                "created_at": r[5], "last_login": r[6], "disabled": r[7],
                "avatar_url": r[8] or "",
            } for r in cur.fetchall()]
            return ok({"team": team, "roles": [
                {"key": k, "label": v["label"]} for k, v in ROLES.items()
            ]})

        if action == "team_update":
            tid = int(body.get("admin_id") or 0)
            role = (body.get("role") or "").strip()
            title = (body.get("title") or "").strip()
            if role and role not in ROLES:
                return err("Неизвестная роль")
            if tid == admin["id"] and role and role != admin["role"]:
                return err("Нельзя менять собственную роль")
            if role:
                cur.execute(f"UPDATE {SCHEMA}.dev_admins SET role = %s WHERE id = %s", (role, tid))
            cur.execute(f"UPDATE {SCHEMA}.dev_admins SET title = %s WHERE id = %s", (title[:40], tid))
            audit(cur, admin, "team_update", f"Изменён сотрудник #{tid}: {role or 'роль без изменений'}", ip)
            return ok({"success": True})

        if action == "team_remove":
            tid = int(body.get("admin_id") or 0)
            if tid == admin["id"]:
                return err("Нельзя отключить самого себя")
            cur.execute(f"UPDATE {SCHEMA}.dev_admins SET disabled = true WHERE id = %s", (tid,))
            cur.execute(f"UPDATE {SCHEMA}.dev_sessions SET expires_at = 0 WHERE admin_id = %s", (tid,))
            audit(cur, admin, "team_remove", f"Отключён доступ #{tid}", ip)
            return ok({"success": True})

        if action == "update_me":
            new_name = (body.get("name") or "").strip()
            avatar = (body.get("avatar_url") or "").strip()
            if new_name:
                cur.execute(f"UPDATE {SCHEMA}.dev_admins SET name = %s WHERE id = %s",
                            (new_name[:60], admin["id"]))
            cur.execute(f"UPDATE {SCHEMA}.dev_admins SET avatar_url = %s WHERE id = %s",
                        (avatar[:500], admin["id"]))
            audit(cur, admin, "update_me", "Изменён профиль администратора", ip)
            cur.execute(
                f"SELECT id, email, name, role, title, avatar_url FROM {SCHEMA}.dev_admins WHERE id = %s",
                (admin["id"],),
            )
            r = cur.fetchone()
            return ok({"admin": {
                "id": r[0], "email": r[1], "name": r[2], "role": r[3],
                "title": r[4], "avatar_url": r[5] or "",
                "role_label": ROLES.get(r[3], {}).get("label", r[3]),
            }})

        # ── Смена пароля и почты (свой аккаунт) ───────────────────────────
        if action == "change_password":
            old_pass = body.get("old_password") or ""
            new_pass = body.get("new_password") or ""
            if len(new_pass) < 8:
                return err("Новый пароль должен быть не короче 8 символов")
            cur.execute(f"SELECT password_hash FROM {SCHEMA}.dev_admins WHERE id = %s", (admin["id"],))
            row = cur.fetchone()
            if not row or not verify_password(old_pass, row[0]):
                return err("Текущий пароль указан неверно", 403)
            cur.execute(
                f"UPDATE {SCHEMA}.dev_admins SET password_hash = %s WHERE id = %s",
                (hash_password(new_pass), admin["id"]),
            )
            token = (event.get("headers") or {}).get("X-Dev-Token") or ""
            cur.execute(
                f"UPDATE {SCHEMA}.dev_sessions SET expires_at = 0 WHERE admin_id = %s AND token != %s",
                (admin["id"], token),
            )
            audit(cur, admin, "change_password", "Пароль изменён", ip)
            return ok({"success": True})

        if action == "change_email":
            password = body.get("password") or ""
            new_email = (body.get("new_email") or "").strip().lower()
            if "@" not in new_email or "." not in new_email.split("@")[-1]:
                return err("Укажите корректный адрес почты")
            cur.execute(f"SELECT password_hash FROM {SCHEMA}.dev_admins WHERE id = %s", (admin["id"],))
            row = cur.fetchone()
            if not row or not verify_password(password, row[0]):
                return err("Пароль указан неверно", 403)
            cur.execute(
                f"SELECT id FROM {SCHEMA}.dev_admins WHERE email = %s AND id != %s",
                (new_email, admin["id"]),
            )
            if cur.fetchone():
                return err("Эта почта уже занята")
            cur.execute(f"UPDATE {SCHEMA}.dev_admins SET email = %s WHERE id = %s", (new_email, admin["id"]))
            audit(cur, admin, "change_email", f"Почта изменена на {new_email}", ip)
            return ok({"success": True, "email": new_email})

        # ── Верификация ───────────────────────────────────────────────────
        if action == "verifications":
            status = (body.get("status") or "pending").strip()
            if status == "all":
                cur.execute(
                    f"SELECT v.id, v.user_id, u.name, u.phone, u.avatar_url, u.verified, "
                    f"v.target_type, v.target_id, v.full_name, v.category, v.links, v.comment, "
                    f"v.status, v.reviewer_note, v.created_at, v.reviewed_at "
                    f"FROM {SCHEMA}.verification_requests v "
                    f"LEFT JOIN {SCHEMA}.users u ON u.id = v.user_id "
                    f"ORDER BY v.created_at DESC LIMIT 100"
                )
            else:
                cur.execute(
                    f"SELECT v.id, v.user_id, u.name, u.phone, u.avatar_url, u.verified, "
                    f"v.target_type, v.target_id, v.full_name, v.category, v.links, v.comment, "
                    f"v.status, v.reviewer_note, v.created_at, v.reviewed_at "
                    f"FROM {SCHEMA}.verification_requests v "
                    f"LEFT JOIN {SCHEMA}.users u ON u.id = v.user_id "
                    f"WHERE v.status = %s ORDER BY v.created_at DESC LIMIT 100",
                    (status,),
                )
            items = [{
                "id": r[0], "user_id": r[1], "user_name": r[2] or f"ID {r[1]}",
                "phone": r[3], "avatar_url": r[4], "already_verified": bool(r[5]),
                "target_type": r[6], "target_id": r[7], "full_name": r[8],
                "category": r[9], "links": r[10], "comment": r[11],
                "status": r[12], "reviewer_note": r[13],
                "created_at": r[14], "reviewed_at": r[15],
            } for r in cur.fetchall()]

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.verification_requests WHERE status = 'pending'")
            pending = cur.fetchone()[0]
            return ok({"items": items, "pending": pending})

        if action == "verify_decide":
            vid = int(body.get("request_id") or 0)
            approve = bool(body.get("approve"))
            note = (body.get("note") or "").strip()
            now = int(time.time())

            cur.execute(
                f"SELECT user_id, target_type, target_id, full_name, category "
                f"FROM {SCHEMA}.verification_requests WHERE id = %s",
                (vid,),
            )
            row = cur.fetchone()
            if not row:
                return err("Заявка не найдена", 404)
            uid, target_type, target_id, full_name, category = row

            cur.execute(
                f"UPDATE {SCHEMA}.verification_requests SET status = %s, reviewer_id = %s, "
                f"reviewer_note = %s, reviewed_at = %s WHERE id = %s",
                ("approved" if approve else "rejected", admin["id"], note, now, vid),
            )

            if approve:
                if target_type == "channel" and target_id:
                    cur.execute(
                        f"UPDATE {SCHEMA}.groups SET verified = true, verified_at = %s WHERE id = %s",
                        (now, target_id),
                    )
                else:
                    cur.execute(
                        f"UPDATE {SCHEMA}.users SET verified = true, verified_at = %s, verified_kind = %s "
                        f"WHERE id = %s",
                        (now, category or "personal", uid),
                    )
                _notify_user_verified(cur, uid, True)
            else:
                _notify_user_verified(cur, uid, False, note)

            audit(cur, admin, "verify_decide",
                  f"Заявка #{vid} ({full_name or uid}): {'одобрена' if approve else 'отклонена'}", ip)
            return ok({"success": True})

        if action == "set_verified":
            uid = int(body.get("user_id") or 0)
            value = bool(body.get("verified"))
            now = int(time.time())
            cur.execute(
                f"UPDATE {SCHEMA}.users SET verified = %s, verified_at = %s WHERE id = %s",
                (value, now if value else None, uid),
            )
            if value:
                cur.execute(
                    f"UPDATE {SCHEMA}.verification_requests SET status = 'approved', reviewer_id = %s, "
                    f"reviewed_at = %s WHERE user_id = %s AND status = 'pending'",
                    (admin["id"], now, uid),
                )
            _notify_user_verified(cur, uid, value)
            audit(cur, admin, "set_verified",
                  f"ID {uid}: галочка {'выдана' if value else 'снята'}", ip)
            return ok({"success": True})

        # ── Уведомления панели ────────────────────────────────────────────
        if action == "notifications":
            cur.execute(
                f"SELECT id, kind, title, body, link_section, read_by, created_at "
                f"FROM {SCHEMA}.dev_notifications ORDER BY created_at DESC LIMIT 50"
            )
            me = str(admin["id"])
            items = []
            unread = 0
            seen = set()
            for r in cur.fetchall():
                key = (r[1], r[2], r[3])
                if key in seen:
                    continue
                seen.add(key)
                read = me in [x.strip() for x in (r[5] or "").split(",")]
                if not read:
                    unread += 1
                items.append({
                    "id": r[0], "kind": r[1], "title": r[2], "body": r[3],
                    "section": r[4], "read": read, "created_at": r[6],
                })
            return ok({"items": items, "unread": unread})

        if action == "notifications_read":
            me = str(admin["id"])
            nid = int(body.get("id") or 0)
            cur.execute(
                f"UPDATE {SCHEMA}.dev_notifications "
                f"SET read_by = CASE WHEN COALESCE(read_by, '') = '' THEN %s ELSE read_by || ',' || %s END "
                f"WHERE NOT (%s = ANY(string_to_array(COALESCE(read_by, ''), ','))) "
                f"AND (%s = 0 OR id = %s)",
                (me, me, me, nid, nid),
            )
            return ok({"success": True})

        # ── Сводка модерации для дашборда ─────────────────────────────────
        if action == "moderation_summary":
            now = int(time.time())
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.reports WHERE status != 'resolved'")
            open_reports = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.verification_requests WHERE status = 'pending'")
            pending_verif = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.support_tickets WHERE status != 'closed'")
            open_tickets = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE banned_until > %s", (now,))
            banned = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE verified = true")
            verified = cur.fetchone()[0]
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE removed_at IS NOT NULL AND removed_at > %s",
                (now - 86400,),
            )
            deleted_msgs = cur.fetchone()[0]
            return ok({"moderation": {
                "open_reports": open_reports,
                "pending_verifications": pending_verif,
                "open_tickets": open_tickets,
                "banned_users": banned,
                "verified_users": verified,
                "removed_messages_24h": deleted_msgs,
            }})

        # ── Тарифы Premium ────────────────────────────────────────────────
        if action == "plans":
            cur.execute(
                f"SELECT id, code, title, subtitle, badge, price, old_price, currency, "
                f"duration_days, is_trial, active, sort_order, features, "
                f"limit_file_mb, limit_storage_gb, limit_pinned_chats, "
                f"limit_group_members, limit_voice_minutes, limit_devices, updated_at "
                f"FROM {SCHEMA}.premium_plans ORDER BY sort_order, id"
            )
            plans = [{
                "id": r[0], "code": r[1], "title": r[2], "subtitle": r[3], "badge": r[4],
                "price": float(r[5] or 0), "old_price": float(r[6]) if r[6] is not None else None,
                "currency": r[7], "duration_days": r[8], "is_trial": bool(r[9]),
                "active": bool(r[10]), "sort_order": r[11],
                "features": [f for f in (r[12] or "").split("|") if f],
                "limits": {
                    "file_mb": r[13], "storage_gb": r[14], "pinned_chats": r[15],
                    "group_members": r[16], "voice_minutes": r[17], "devices": r[18],
                },
                "updated_at": r[19],
            } for r in cur.fetchall()]
            now = int(time.time())
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE pro_until IS NOT NULL AND pro_until > %s",
                (now,),
            )
            return ok({"plans": plans, "active_subscriptions": cur.fetchone()[0]})

        if action == "test_skins_list":
            cur.execute(f"SELECT id, name, base_style, image_url, ticker, active, sort_order FROM {SCHEMA}.test_skins ORDER BY sort_order, created_at")
            return ok({"skins": [{"id": r[0], "name": r[1], "base": r[2], "image": r[3], "ticker": r[4] or "", "active": bool(r[5]), "sort_order": r[6]} for r in cur.fetchall()]})

        if action == "test_skin_save":
            sid = re.sub(r"[^a-z0-9_-]", "", str(body.get("id") or "").lower())[:32]
            name = str(body.get("name") or "").strip()[:40]
            base = str(body.get("base") or "rain")
            if base not in ("rain", "cyber", "sakura"):
                return err("Неизвестный стиль")
            ticker = str(body.get("ticker") or "").strip()[:600]
            active = bool(body.get("active", True))
            if not name:
                return err("Укажите название темы")
            image_url = str(body.get("image_url") or "").strip()
            img_b64 = body.get("image_base64")
            if img_b64:
                import boto3
                raw = base64.b64decode(str(img_b64).split(",")[-1])
                if len(raw) > 6 * 1024 * 1024:
                    return err("Картинка больше 6 МБ")
                ctype = str(body.get("image_type") or "image/jpeg")
                ext = {"image/png": "png", "image/webp": "webp"}.get(ctype, "jpg")
                key = f"skins/{secrets.token_hex(8)}.{ext}"
                s3 = boto3.client("s3", endpoint_url="https://bucket.poehali.dev",
                                  aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"], aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"])
                s3.put_object(Bucket="files", Key=key, Body=raw, ContentType=ctype)
                image_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
            if not sid:
                sid = "s" + secrets.token_hex(4)
                if not image_url:
                    return err("Загрузите картинку фона")
                cur.execute(
                    f"INSERT INTO {SCHEMA}.test_skins (id, name, base_style, image_url, ticker, active, sort_order, created_at) "
                    f"VALUES (%s, %s, %s, %s, %s, %s, 100, %s)",
                    (sid, name, base, image_url, ticker, active, int(time.time())),
                )
                audit(cur, admin, "test_skin_save", f"Новая тестовая тема «{name}»", ip)
            else:
                if image_url:
                    cur.execute(f"UPDATE {SCHEMA}.test_skins SET name=%s, base_style=%s, ticker=%s, active=%s, image_url=%s WHERE id=%s", (name, base, ticker, active, image_url, sid))
                else:
                    cur.execute(f"UPDATE {SCHEMA}.test_skins SET name=%s, base_style=%s, ticker=%s, active=%s WHERE id=%s", (name, base, ticker, active, sid))
                audit(cur, admin, "test_skin_save", f"Тестовая тема «{name}» изменена", ip)
            return ok({"success": True, "id": sid})

        if action == "test_skin_delete":
            sid = str(body.get("id") or "")[:32]
            cur.execute(f"DELETE FROM {SCHEMA}.test_skins WHERE id = %s RETURNING name", (sid,))
            r = cur.fetchone()
            if r:
                audit(cur, admin, "test_skin_delete", f"Удалена тестовая тема «{r[0]}»", ip)
            return ok({"success": True})

        if action == "test_themes_list":
            cur.execute(
                f"SELECT t.user_id, u.name, u.phone, t.created_at, a.name FROM {SCHEMA}.test_themes_access t "
                f"LEFT JOIN {SCHEMA}.users u ON u.id = t.user_id LEFT JOIN {SCHEMA}.dev_admins a ON a.id = t.granted_by ORDER BY t.created_at DESC"
            )
            return ok({"users": [{"id": r[0], "name": r[1], "phone": r[2], "created_at": r[3], "admin_name": r[4]} for r in cur.fetchall()]})

        if action == "test_themes_grant":
            uid = int(body.get("user_id") or 0)
            cur.execute(f"SELECT name FROM {SCHEMA}.users WHERE id = %s", (uid,))
            u = cur.fetchone()
            if not u:
                return err("Пользователь не найден")
            cur.execute(
                f"INSERT INTO {SCHEMA}.test_themes_access (user_id, granted_by, created_at) VALUES (%s, %s, %s) ON CONFLICT (user_id) DO NOTHING",
                (uid, admin["id"], int(time.time())),
            )
            audit(cur, admin, "test_themes_grant", f"Тестовые темы открыты: {u[0]} (ID {uid})", ip)
            return ok({"success": True})

        if action == "test_themes_revoke":
            uid = int(body.get("user_id") or 0)
            cur.execute(f"DELETE FROM {SCHEMA}.test_themes_access WHERE user_id = %s", (uid,))
            audit(cur, admin, "test_themes_revoke", f"Тестовые темы закрыты для ID {uid}", ip)
            return ok({"success": True})

        if action == "badges_admin":
            cur.execute(
                f"SELECT code, title, description, rarity, price_lightning, supply, issued, on_sale, sort_order FROM {SCHEMA}.badges ORDER BY sort_order, code"
            )
            badges = [{"code": r[0], "title": r[1], "description": r[2], "rarity": r[3], "price": r[4], "supply": r[5],
                       "issued": r[6], "on_sale": bool(r[7]), "sort_order": r[8]} for r in cur.fetchall()]
            cur.execute(
                f"SELECT ub.id, ub.user_id, u.name, u.phone, ub.badge_code, ub.serial, ub.method, ub.price_lightning, ub.created_at, ub.revoked_at, a.name "
                f"FROM {SCHEMA}.user_shop_badges ub LEFT JOIN {SCHEMA}.users u ON u.id = ub.user_id "
                f"LEFT JOIN {SCHEMA}.dev_admins a ON a.id = ub.granted_by ORDER BY ub.id DESC LIMIT 200"
            )
            items = [{"id": r[0], "user_id": r[1], "user_name": r[2], "phone": r[3], "code": r[4], "serial": r[5], "method": r[6],
                      "price": r[7], "created_at": r[8], "revoked_at": r[9], "admin_name": r[10]} for r in cur.fetchall()]
            cur.execute(f"SELECT COALESCE(SUM(price_lightning), 0), COUNT(*) FROM {SCHEMA}.user_shop_badges WHERE method = 'lightning'")
            t = cur.fetchone()
            cur.execute(
                f"SELECT e.code, e.title, e.price_lightning, e.duration_days, e.on_sale, "
                f"(SELECT COUNT(*) FROM {SCHEMA}.user_name_effects x WHERE x.effect_code = e.code) FROM {SCHEMA}.name_effects e ORDER BY e.sort_order"
            )
            effects = [{"code": r[0], "title": r[1], "price": r[2], "duration_days": r[3], "on_sale": bool(r[4]), "buyers": r[5]} for r in cur.fetchall()]
            return ok({"badges": badges, "items": items, "totals": {"lightning": int(t[0] or 0), "sold": int(t[1] or 0)}, "effects": effects})

        if action == "user_shop_badges":
            uid = int(body.get("user_id") or 0)
            cur.execute(
                f"SELECT ub.badge_code, ub.serial, b.title, b.rarity, ub.note, ub.method, ub.created_at FROM {SCHEMA}.user_shop_badges ub JOIN {SCHEMA}.badges b ON b.code = ub.badge_code "
                f"WHERE ub.user_id = %s AND ub.revoked_at IS NULL ORDER BY ub.id",
                (uid,),
            )
            return ok({"badges": [{"code": r[0], "serial": r[1], "title": r[2], "rarity": r[3], "note": r[4], "method": r[5], "created_at": r[6]} for r in cur.fetchall()]})

        if action == "badge_grant":
            uid = int(body.get("user_id") or 0)
            code = str(body.get("code") or "")[:32]
            note = (str(body.get("note") or "").strip()[:120]) or None
            cur.execute(f"SELECT title FROM {SCHEMA}.badges WHERE code = %s", (code,))
            b = cur.fetchone()
            cur.execute(f"SELECT name FROM {SCHEMA}.users WHERE id = %s", (uid,))
            u = cur.fetchone()
            if not b or not u:
                return err("Пользователь или значок не найден")
            cur.execute(f"SELECT 1 FROM {SCHEMA}.user_shop_badges WHERE user_id = %s AND badge_code = %s AND revoked_at IS NULL", (uid, code))
            if cur.fetchone():
                return err("У пользователя уже есть этот значок")
            cur.execute(f"UPDATE {SCHEMA}.badges SET issued = issued + 1 WHERE code = %s RETURNING issued", (code,))
            serial = int(cur.fetchone()[0])
            now = int(time.time())
            cur.execute(
                f"INSERT INTO {SCHEMA}.user_shop_badges (user_id, badge_code, serial, method, granted_by, created_at, note) VALUES (%s, %s, %s, 'admin', %s, %s, %s)",
                (uid, code, serial, admin["id"], now, note),
            )
            audit(cur, admin, "badge_grant", f"Значок «{b[0]}» №{serial} → {u[0]} (ID {uid})" + (f": {note}" if note else ""), ip)
            return ok({"success": True, "serial": serial})

        if action == "badge_revoke":
            uid = int(body.get("user_id") or 0)
            code = str(body.get("code") or "")[:32]
            cur.execute(
                f"UPDATE {SCHEMA}.user_shop_badges SET revoked_at = %s WHERE user_id = %s AND badge_code = %s AND revoked_at IS NULL RETURNING serial",
                (int(time.time()), uid, code),
            )
            r = cur.fetchone()
            if not r:
                return err("У пользователя нет этого значка")
            audit(cur, admin, "badge_revoke", f"Забран значок {code} №{r[0]} у ID {uid}", ip)
            return ok({"success": True})

        if action == "badge_update":
            code = str(body.get("code") or "")[:32]
            price = body.get("price")
            supply = body.get("supply")
            try:
                price = None if price in (None, "") else max(1, int(price))
                supply = None if supply in (None, "") else max(1, int(supply))
            except (TypeError, ValueError):
                return err("Цена и тираж — числа")
            on_sale = bool(body.get("on_sale"))
            if on_sale and price is None:
                return err("Чтобы продавать значок, укажите цену")
            cur.execute(f"SELECT issued FROM {SCHEMA}.badges WHERE code = %s", (code,))
            ir = cur.fetchone()
            if not ir:
                return err("Значок не найден")
            if supply is not None and supply < int(ir[0]):
                return err(f"Уже выдано {ir[0]} — тираж не может быть меньше")
            cur.execute(
                f"UPDATE {SCHEMA}.badges SET price_lightning = %s, supply = %s, on_sale = %s WHERE code = %s RETURNING title, issued",
                (price, supply, on_sale, code),
            )
            r = cur.fetchone()
            audit(cur, admin, "badge_update", f"Значок «{r[0]}»: цена {price}, тираж {supply or '∞'}, {'в продаже' if on_sale else 'снят'}", ip)
            return ok({"success": True})

        if action == "pro_features":
            cur.execute(
                f"SELECT key, value FROM {SCHEMA}.dev_settings "
                f"WHERE key IN ('file_limit_free_mb', 'file_limit_pro_mb', 'pin_limit_free', 'pin_limit_pro', 'folder_limit_free', 'folder_limit_pro')"
            )
            cfg = {r[0]: r[1] for r in cur.fetchall()}
            def _int(v, d):
                try:
                    return int(v)
                except (TypeError, ValueError):
                    return d
            now = int(time.time())
            cur.execute(
                f"SELECT COUNT(*) FILTER (WHERE COALESCE(incognito, FALSE)), "
                f"COUNT(*) FILTER (WHERE emoji_status IS NOT NULL AND emoji_status <> ''), "
                f"COUNT(*) FILTER (WHERE name_color IS NOT NULL AND name_color <> ''), "
                f"COUNT(*) FILTER (WHERE avatar_video_url IS NOT NULL AND avatar_video_url <> ''), "
                f"COUNT(*) FILTER (WHERE app_icon IS NOT NULL AND app_icon <> 'classic') "
                f"FROM {SCHEMA}.users WHERE COALESCE(pro_until, 0) > %s",
                (now,),
            )
            inc, emo, col, avv, aic = cur.fetchone()
            return ok({
                "file_limit_free_mb": _int(cfg.get("file_limit_free_mb"), 50),
                "file_limit_pro_mb": _int(cfg.get("file_limit_pro_mb"), 1024),
                "pin_limit_free": _int(cfg.get("pin_limit_free"), 5),
                "pin_limit_pro": _int(cfg.get("pin_limit_pro"), 20),
                "folder_limit_free": _int(cfg.get("folder_limit_free"), 2),
                "folder_limit_pro": _int(cfg.get("folder_limit_pro"), 10),
                "usage": {"incognito": inc or 0, "emoji_status": emo or 0, "name_color": col or 0, "avatar_video": avv or 0, "app_icon": aic or 0},
            })

        if action == "pro_features_save":
            try:
                free_mb = int(body.get("file_limit_free_mb"))
                pro_mb = int(body.get("file_limit_pro_mb"))
            except (TypeError, ValueError):
                return err("Укажите лимиты числами")
            if free_mb < 1 or free_mb > 2048:
                return err("Лимит без Pro: от 1 до 2048 МБ")
            if pro_mb < free_mb or pro_mb > 2048:
                return err("Лимит с Pro: не меньше лимита без Pro и не больше 2048 МБ")
            extra = []
            for k, lo, hi, label in (("pin_limit_free", 0, 100, "Закреплённых чатов без Pro"), ("pin_limit_pro", 0, 500, "Закреплённых чатов с Pro"),
                                     ("folder_limit_free", 0, 50, "Папок без Pro"), ("folder_limit_pro", 0, 200, "Папок с Pro")):
                if body.get(k) is None:
                    continue
                try:
                    v = int(body.get(k))
                except (TypeError, ValueError):
                    return err(f"{label}: укажите число")
                if v < lo or v > hi:
                    return err(f"{label}: от {lo} до {hi}")
                extra.append((k, v))
            ex = dict(extra)
            if "pin_limit_free" in ex and "pin_limit_pro" in ex and ex["pin_limit_pro"] < ex["pin_limit_free"]:
                return err("Закреплённых чатов с Pro должно быть не меньше, чем без Pro")
            if "folder_limit_free" in ex and "folder_limit_pro" in ex and ex["folder_limit_pro"] < ex["folder_limit_free"]:
                return err("Папок с Pro должно быть не меньше, чем без Pro")
            now = int(time.time())
            for k, v in [("file_limit_free_mb", free_mb), ("file_limit_pro_mb", pro_mb)] + extra:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_at, updated_by) VALUES (%s, %s, %s, %s) "
                    f"ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by",
                    (k, str(v), now, admin["id"]),
                )
            audit(cur, admin, "pro_features_save", f"Лимиты: файлы {free_mb}/{pro_mb} МБ" + (f", закрепы {ex.get('pin_limit_free')}/{ex.get('pin_limit_pro')}, папки {ex.get('folder_limit_free')}/{ex.get('folder_limit_pro')}" if ex else ""), ip)
            return ok({"success": True})

        if action == "nova_ids_list":
            q = (body.get("q") or "").strip()[:40]
            where, args = "", []
            if q:
                where = "WHERE p.nova_id ILIKE %s OR u.name ILIKE %s OR u.phone ILIKE %s"
                args = [f"%{q}%", f"%{q}%", f"%{q}%"]
            cur.execute(
                f"SELECT p.id, p.user_id, u.name, u.phone, p.nova_id, p.old_nova_id, p.method, "
                f"p.price_lightning, p.price_rub, p.note, p.created_at, a.name, u.nova_id "
                f"FROM {SCHEMA}.nova_id_purchases p "
                f"LEFT JOIN {SCHEMA}.users u ON u.id = p.user_id "
                f"LEFT JOIN {SCHEMA}.dev_admins a ON a.id = p.admin_id "
                f"{where} ORDER BY p.id DESC LIMIT 200",
                args,
            )
            items = [{
                "id": r[0], "user_id": r[1], "user_name": r[2], "phone": r[3], "nova_id": r[4],
                "old_nova_id": r[5], "method": r[6], "price_lightning": r[7], "price_rub": float(r[8] or 0),
                "note": r[9], "created_at": r[10], "admin_name": r[11],
                "still_owned": (r[12] == r[4]),
            } for r in cur.fetchall()]
            cur.execute(
                f"SELECT COUNT(*), COALESCE(SUM(price_lightning),0), COALESCE(SUM(price_rub),0), "
                f"COUNT(*) FILTER (WHERE method='admin') FROM {SCHEMA}.nova_id_purchases"
            )
            t = cur.fetchone()
            cfg = nova_ids.load_config(cur, SCHEMA)
            return ok({
                "items": items,
                "totals": {"count": t[0], "lightning": int(t[1]), "rub": float(t[2]), "granted": t[3]},
                "settings": {
                    "enabled": cfg["enabled"],
                    "prices": {str(k): v for k, v in cfg["prices"].items()},
                    "beauty_mult": cfg["beauty_mult"],
                    "reserved": ", ".join(sorted(cfg["reserved"])),
                },
            })

        if action == "nova_id_check_admin":
            nid = nova_ids.normalize(body.get("nova_id"))
            cfg = nova_ids.load_config(cur, SCHEMA)
            bad = nova_ids.validate(nid) if not (nid.isdigit() and len(nid) == 8) else None
            if bad:
                return ok({"available": False, "reason": bad, "nova_id": nid})
            cur.execute(f"SELECT id, name FROM {SCHEMA}.users WHERE nova_id = %s", (nid,))
            r = cur.fetchone()
            if r:
                return ok({"available": False, "reason": f"Занят: {r[1]} (#{r[0]})", "nova_id": nid, "owner_id": r[0]})
            return ok({"available": True, "nova_id": nid, "price": nova_ids.price_for(nid, cfg) if len(nid) <= 7 else None,
                       "reserved": nid in cfg["reserved"]})

        if action == "nova_id_grant":
            try:
                target = int(body.get("user_id") or 0)
            except (TypeError, ValueError):
                target = 0
            nid = nova_ids.normalize(body.get("nova_id"))
            note = (body.get("note") or "").strip()[:300]
            if not target:
                return err("Укажите пользователя")
            if not nid.isdigit() or not (3 <= len(nid) <= 8) or nid[0] == "0":
                return err("ID — от 3 до 8 цифр, не с нуля")
            cur.execute(f"SELECT name FROM {SCHEMA}.users WHERE id = %s", (target,))
            u = cur.fetchone()
            if not u:
                return err("Пользователь не найден", 404)
            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE nova_id = %s", (nid,))
            r = cur.fetchone()
            if r and int(r[0]) != target:
                return err("Этот ID занят другим пользователем")
            if r:
                return err("У пользователя уже этот ID")
            nova_ids.assign(cur, SCHEMA, target, nid, "admin", admin_id=admin["id"], note=note)
            cur.execute(
                f"INSERT INTO {SCHEMA}.user_notifications (user_id, kind, title, body) VALUES (%s, 'premium', %s, %s)",
                (target, "Новый ID", f"Вам выдан ID в Nova: {nid}"),
            )
            audit(cur, admin, "nova_id_grant", f"Выдан ID {nid} пользователю «{u[0]}» (#{target})", ip)
            return ok({"success": True, "nova_id": nid})

        if action == "nova_ids_settings_save":
            prices = body.get("prices") or {}
            now = int(time.time())
            rows = []
            for ln in range(nova_ids.MIN_LEN, nova_ids.MAX_LEN + 1):
                p = prices.get(str(ln)) or {}
                try:
                    lv = max(0, int(p.get("lightning") or 0))
                    rv = max(0.0, round(float(p.get("rub") or 0), 2))
                except (TypeError, ValueError):
                    return err("Цены — числами")
                if rv and rv < 1:
                    return err("Цена в рублях — от 1 ₽")
                rows.append((f"nova_id_price_{ln}", json.dumps({"lightning": lv, "rub": rv})))
            try:
                mult = max(1.0, min(20.0, float(body.get("beauty_mult") or 1)))
            except (TypeError, ValueError):
                return err("Множитель — числом")
            reserved = ",".join(
                x for x in (nova_ids.normalize(v) for v in str(body.get("reserved") or "").replace("\n", ",").split(","))
                if x.isdigit()
            )[:2000]
            rows += [("nova_id_beauty_mult", str(mult)), ("nova_id_reserved", reserved),
                     ("nova_id_enabled", "1" if body.get("enabled", True) else "0")]
            for k, v in rows:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_at, updated_by) VALUES (%s, %s, %s, %s) "
                    f"ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by",
                    (k, v, now, admin["id"]),
                )
            audit(cur, admin, "nova_ids_settings_save", "Изменены цены и правила красивых ID", ip)
            return ok({"success": True})

        if action == "plan_save":
            pid = int(body.get("id") or 0)
            code = (body.get("code") or "").strip().lower()
            title = (body.get("title") or "").strip()
            if not code or not title:
                return err("Укажите код и название тарифа")

            feats = body.get("features") or []
            if isinstance(feats, str):
                feats = [f.strip() for f in feats.split("|")]
            features = "|".join([f.strip() for f in feats if f and f.strip()])[:2000]

            lim = body.get("limits") or {}
            vals = (
                code[:40], title[:80], (body.get("subtitle") or "")[:120],
                (body.get("badge") or "")[:20],
                float(body.get("price") or 0),
                float(body["old_price"]) if body.get("old_price") else None,
                (body.get("currency") or "RUB")[:8],
                int(body.get("duration_days") or 30),
                bool(body.get("is_trial")),
                bool(body.get("active", True)),
                int(body.get("sort_order") or 0),
                features,
                int(lim.get("file_mb") or 5),
                int(lim.get("storage_gb") or 1),
                int(lim.get("pinned_chats") or 5),
                int(lim.get("group_members") or 200),
                int(lim.get("voice_minutes") or 5),
                int(lim.get("devices") or 3),
                int(time.time()),
            )
            if pid:
                cur.execute(
                    f"UPDATE {SCHEMA}.premium_plans SET code=%s, title=%s, subtitle=%s, badge=%s, "
                    f"price=%s, old_price=%s, currency=%s, duration_days=%s, is_trial=%s, active=%s, "
                    f"sort_order=%s, features=%s, limit_file_mb=%s, limit_storage_gb=%s, "
                    f"limit_pinned_chats=%s, limit_group_members=%s, limit_voice_minutes=%s, "
                    f"limit_devices=%s, updated_at=%s WHERE id=%s",
                    vals + (pid,),
                )
                audit(cur, admin, "plan_save", f"Изменён тариф «{title}» ({code})", ip)
            else:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.premium_plans "
                    f"(code, title, subtitle, badge, price, old_price, currency, duration_days, "
                    f"is_trial, active, sort_order, features, limit_file_mb, limit_storage_gb, "
                    f"limit_pinned_chats, limit_group_members, limit_voice_minutes, limit_devices, updated_at) "
                    f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                    f"ON CONFLICT (code) DO UPDATE SET title=EXCLUDED.title, price=EXCLUDED.price",
                    vals,
                )
                audit(cur, admin, "plan_save", f"Создан тариф «{title}» ({code})", ip)
            return ok({"success": True})

        if action == "plan_delete":
            pid = int(body.get("id") or 0)
            cur.execute(f"SELECT code, title FROM {SCHEMA}.premium_plans WHERE id = %s", (pid,))
            r = cur.fetchone()
            if not r:
                return err("Тариф не найден", 404)
            cur.execute(f"UPDATE {SCHEMA}.premium_plans SET active = false WHERE id = %s", (pid,))
            audit(cur, admin, "plan_delete", f"Отключён тариф «{r[1]}» ({r[0]})", ip)
            return ok({"success": True})

        if action == "subscriptions_summary":
            now = int(time.time())
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE pro_until IS NOT NULL AND pro_until > %s",
                (now,),
            )
            active = cur.fetchone()[0]
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE pro_until IS NOT NULL "
                f"AND pro_until > %s AND pro_until < %s",
                (now, now + 7 * 86400),
            )
            expiring = cur.fetchone()[0]
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE COALESCE(pro_trial_used, FALSE) = TRUE"
            )
            trials = cur.fetchone()[0]
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE pro_until IS NOT NULL AND pro_until <= %s",
                (now,),
            )
            expired = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.premium_plans WHERE active = TRUE")
            plans_count = cur.fetchone()[0]
            cur.execute(
                f"SELECT COALESCE(SUM(amount), 0), COUNT(*) FROM {SCHEMA}.pro_subscriptions "
                f"WHERE created_at > %s",
                (now - 30 * 86400,),
            )
            rev_row = cur.fetchone()
            cur.execute(
                f"SELECT plan, COUNT(*), COALESCE(SUM(amount), 0) FROM {SCHEMA}.pro_subscriptions "
                f"GROUP BY plan ORDER BY COUNT(*) DESC LIMIT 8"
            )
            by_plan = [{"plan": r[0], "count": r[1], "sum": float(r[2] or 0)} for r in cur.fetchall()]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.promo_activations WHERE created_at > %s",
                        (now - 30 * 86400,))
            promo_used = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.referrals")
            refs = cur.fetchone()[0]
            return ok({"subscriptions": {
                "active": active, "expiring_7d": expiring, "trials_used": trials,
                "expired": expired, "plans": plans_count,
                "revenue_30d": float(rev_row[0] or 0), "purchases_30d": int(rev_row[1] or 0),
                "by_plan": by_plan, "promo_activations_30d": promo_used, "referrals": refs,
            }})

        if action == "wallet_set":
            uid = int(body.get("user_id") or 0)
            mode = (body.get("mode") or "set").strip()
            raw = body.get("amount")
            reason = (body.get("reason") or "Изменение баланса администратором").strip()

            cur.execute(
                f"SELECT COALESCE(wallet_balance, 0), name FROM {SCHEMA}.users WHERE id = %s",
                (uid,),
            )
            u = cur.fetchone()
            if not u:
                return err("Пользователь не найден", 404)
            old_balance = float(u[0] or 0)

            try:
                amount = float(raw or 0)
            except (TypeError, ValueError):
                return err("Некорректная сумма")

            if mode == "reset":
                new_balance = 0.0
            elif mode == "add":
                new_balance = old_balance + amount
            elif mode == "subtract":
                new_balance = old_balance - amount
            else:
                new_balance = amount

            if new_balance < 0:
                new_balance = 0.0
            if new_balance > 1000000:
                return err("Слишком большая сумма")

            diff = round(new_balance - old_balance, 2)
            cur.execute(
                f"UPDATE {SCHEMA}.users SET wallet_balance = %s WHERE id = %s",
                (new_balance, uid),
            )

            if abs(diff) > 0.001:
                try:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.wallet_transactions "
                        f"(user_id, amount, kind, description, balance_after, created_at) "
                        f"VALUES (%s, %s, %s, %s, %s, %s)",
                        (uid, abs(diff), "topup" if diff > 0 else "writeoff",
                         reason[:200], new_balance, int(time.time())),
                    )
                except Exception:
                    pass

                cur.execute(
                    f"INSERT INTO {SCHEMA}.user_notifications (user_id, kind, title, body) "
                    f"VALUES (%s, 'system', %s, %s)",
                    (uid,
                     "Баланс кошелька изменён",
                     f"{'Начислено' if diff > 0 else 'Списано'} {abs(diff):.2f} руб. "
                     f"Текущий баланс: {new_balance:.2f} руб. {reason}"),
                )

            audit(cur, admin, "wallet_set",
                  f"Баланс ID {uid}: {old_balance:.2f} -> {new_balance:.2f} ({reason})", ip)
            return ok({"success": True, "balance": new_balance, "diff": diff})

        if action == "user_billing":
            uid = int(body.get("user_id") or 0)
            now = int(time.time())

            cur.execute(
                f"SELECT COALESCE(pro_until, 0), COALESCE(pro_trial_used, FALSE), "
                f"COALESCE(wallet_balance, 0) FROM {SCHEMA}.users WHERE id = %s",
                (uid,),
            )
            u = cur.fetchone()
            if not u:
                return err("Пользователь не найден", 404)
            pro_until = int(u[0] or 0)

            cur.execute(
                f"SELECT id, order_number, amount, status, created_at, paid_at, purpose, "
                f"COALESCE(payment_method, ''), COALESCE(refunded_amount, 0) "
                f"FROM {SCHEMA}.orders WHERE nova_user_id = %s ORDER BY created_at DESC LIMIT 30",
                (uid,),
            )
            payments = [{
                "id": r[0], "order_number": r[1], "amount": float(r[2] or 0),
                "status": r[3] or "pending",
                "created_at": r[4].isoformat() if r[4] else None,
                "paid_at": r[5].isoformat() if r[5] else None,
                "purpose": r[6] or "", "method": r[7],
                "refunded": float(r[8] or 0),
            } for r in cur.fetchall()]

            cur.execute(
                f"SELECT plan, amount, source, starts_at, ends_at, is_trial, created_at "
                f"FROM {SCHEMA}.pro_subscriptions WHERE user_id = %s "
                f"ORDER BY created_at DESC LIMIT 30",
                (uid,),
            )
            subs = [{
                "plan": r[0], "amount": float(r[1] or 0), "source": r[2],
                "starts_at": r[3], "ends_at": r[4], "is_trial": bool(r[5]),
                "created_at": r[6],
            } for r in cur.fetchall()]

            cur.execute(
                f"SELECT code, granted_days, created_at FROM {SCHEMA}.promo_activations "
                f"WHERE user_id = %s ORDER BY created_at DESC LIMIT 10",
                (uid,),
            )
            promos = [{"code": r[0], "days": r[1], "created_at": r[2]} for r in cur.fetchall()]

            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.referrals WHERE inviter_id = %s", (uid,)
            )
            invited = cur.fetchone()[0]

            paid_total = sum(p["amount"] for p in payments
                             if p["status"] in ("paid", "succeeded"))
            refunded_total = sum(p["refunded"] for p in payments)

            return ok({
                "billing": {
                    "pro_until": pro_until or None,
                    "is_pro": pro_until > now,
                    "trial_used": bool(u[1]),
                    "wallet": float(u[2] or 0),
                    "paid_total": paid_total,
                    "refunded_total": refunded_total,
                    "invited": invited,
                },
                "payments": payments,
                "subscriptions": subs,
                "promos": promos,
            })

        # ── Платежи ───────────────────────────────────────────────────────
        if action == "payments":
            status_f = (body.get("status") or "all").strip()
            query = (body.get("query") or "").strip()
            limit = min(int(body.get("limit") or 50), 200)

            where = []
            params = []
            if status_f == "succeeded":
                where.append("o.status IN ('paid', 'succeeded')")
            elif status_f == "pending":
                where.append("o.status = 'pending'")
            elif status_f == "canceled":
                where.append("o.status IN ('canceled', 'failed')")
            elif status_f == "refunded":
                where.append("o.refunded_amount > 0")
            if query:
                where.append("(o.order_number ILIKE %s OR o.user_email ILIKE %s OR u.name ILIKE %s)")
                like = f"%{query}%"
                params += [like, like, like]

            where_sql = ("WHERE " + " AND ".join(where)) if where else ""
            params.append(limit)

            cur.execute(
                f"SELECT o.id, o.order_number, o.user_email, o.amount, o.status, "
                f"o.yookassa_payment_id, o.created_at, o.paid_at, o.nova_user_id, u.name, "
                f"o.purpose, COALESCE(o.payment_method, ''), COALESCE(o.refunded_amount, 0), "
                f"o.refunded_at, COALESCE(o.refund_reason, ''), COALESCE(o.cancel_reason, '') "
                f"FROM {SCHEMA}.orders o LEFT JOIN {SCHEMA}.users u ON u.id = o.nova_user_id "
                f"{where_sql} ORDER BY o.created_at DESC LIMIT %s",
                tuple(params),
            )
            items = [{
                "id": r[0], "order_number": r[1], "email": r[2],
                "amount": float(r[3] or 0), "status": r[4] or "pending",
                "payment_id": r[5] or "", 
                "created_at": r[6].isoformat() if r[6] else None,
                "paid_at": r[7].isoformat() if r[7] else None,
                "user_id": r[8], "user_name": r[9] or (f"ID {r[8]}" if r[8] else "—"),
                "purpose": r[10] or "", "method": r[11],
                "refunded": float(r[12] or 0),
                "refunded_at": r[13].isoformat() if r[13] else None,
                "refund_reason": r[14], "cancel_reason": r[15],
            } for r in cur.fetchall()]
            return ok({"payments": items})

        if action == "payments_export":
            date_from = (body.get("from") or "").strip()
            date_to = (body.get("to") or "").strip()
            only_paid = bool(body.get("only_paid", True))

            where = []
            params = []
            if only_paid:
                where.append("o.status IN ('paid', 'succeeded')")
            if date_from:
                where.append("o.created_at >= %s")
                params.append(date_from)
            if date_to:
                where.append("o.created_at <= %s")
                params.append(date_to + " 23:59:59")
            where_sql = ("WHERE " + " AND ".join(where)) if where else ""

            cur.execute(
                f"SELECT o.created_at, o.paid_at, o.order_number, o.amount, o.status, "
                f"COALESCE(o.payment_method, ''), o.purpose, o.user_email, "
                f"COALESCE(u.name, ''), COALESCE(u.phone, ''), o.nova_user_id, "
                f"COALESCE(o.refunded_amount, 0), COALESCE(o.yookassa_payment_id, '') "
                f"FROM {SCHEMA}.orders o LEFT JOIN {SCHEMA}.users u ON u.id = o.nova_user_id "
                f"{where_sql} ORDER BY o.created_at DESC LIMIT 5000",
                tuple(params),
            )

            method_names = {
                "bank_card": "Карта", "card": "Карта", "sbp": "СБП",
                "sberbank": "SberPay", "tinkoff_bank": "T-Pay", "yoo_money": "ЮMoney",
            }
            status_names = {
                "paid": "Оплачен", "succeeded": "Оплачен", "pending": "Ожидает",
                "canceled": "Отменён", "failed": "Не прошёл", "refunded": "Возвращён",
            }
            purpose_names = {
                "wallet_topup": "Пополнение кошелька",
                "pro_month": "Premium месяц", "pro_year": "Premium год",
                "lightning": "Молнии",
            }

            rows = []
            total = 0.0
            total_refund = 0.0
            for r in cur.fetchall():
                amount = float(r[3] or 0)
                refunded = float(r[11] or 0)
                if r[4] in ("paid", "succeeded"):
                    total += amount
                total_refund += refunded
                rows.append({
                    "created": r[0].strftime("%d.%m.%Y %H:%M") if r[0] else "",
                    "paid": r[1].strftime("%d.%m.%Y %H:%M") if r[1] else "",
                    "order": r[2] or "",
                    "amount": amount,
                    "status": status_names.get(r[4], r[4] or ""),
                    "method": method_names.get(r[5], r[5] or ""),
                    "purpose": purpose_names.get(r[6], r[6] or ""),
                    "email": r[7] or "",
                    "name": r[8] or "",
                    "phone": r[9] or "",
                    "user_id": r[10],
                    "refunded": refunded,
                    "payment_id": r[12] or "",
                })

            audit(cur, admin, "payments_export",
                  f"Выгрузка платежей: {len(rows)} строк", ip)
            return ok({
                "rows": rows,
                "total": round(total, 2),
                "total_refunded": round(total_refund, 2),
                "count": len(rows),
            })

        if action == "payments_summary":
            cur.execute(
                f"SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM {SCHEMA}.orders "
                f"WHERE status IN ('paid', 'succeeded')"
            )
            ok_row = cur.fetchone()
            cur.execute(
                f"SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM {SCHEMA}.orders "
                f"WHERE status IN ('paid', 'succeeded') AND created_at > NOW() - INTERVAL '30 days'"
            )
            m30 = cur.fetchone()
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.orders WHERE status = 'pending'")
            pending = cur.fetchone()[0]
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.orders WHERE status IN ('canceled', 'failed')"
            )
            failed = cur.fetchone()[0]
            cur.execute(
                f"SELECT COUNT(*), COALESCE(SUM(refunded_amount), 0) FROM {SCHEMA}.orders "
                f"WHERE refunded_amount > 0"
            )
            ref = cur.fetchone()
            cur.execute(
                f"SELECT COALESCE(payment_method, 'не указан'), COUNT(*), COALESCE(SUM(amount), 0) "
                f"FROM {SCHEMA}.orders WHERE status IN ('paid', 'succeeded') "
                f"GROUP BY payment_method ORDER BY COUNT(*) DESC"
            )
            by_method = [{"method": r[0], "count": r[1], "sum": float(r[2] or 0)}
                         for r in cur.fetchall()]

            total_attempts = int(ok_row[0] or 0) + failed
            conversion = round(int(ok_row[0] or 0) / total_attempts * 100, 1) if total_attempts else 0.0

            return ok({"summary": {
                "success_count": int(ok_row[0] or 0), "success_sum": float(ok_row[1] or 0),
                "sum_30d": float(m30[1] or 0), "count_30d": int(m30[0] or 0),
                "pending": pending, "failed": failed,
                "refund_count": int(ref[0] or 0), "refund_sum": float(ref[1] or 0),
                "conversion": conversion, "by_method": by_method,
            }})

        if action == "payment_refund":
            oid = int(body.get("order_id") or 0)
            reason = (body.get("reason") or "Возврат по обращению").strip()
            amount_req = body.get("amount")

            cur.execute(
                f"SELECT amount, status, yookassa_payment_id, nova_user_id, "
                f"COALESCE(refunded_amount, 0) FROM {SCHEMA}.orders WHERE id = %s",
                (oid,),
            )
            r = cur.fetchone()
            if not r:
                return err("Платёж не найден", 404)
            if r[1] not in ("paid", "succeeded"):
                return err("Возврат возможен только по успешному платежу")
            paid = float(r[0] or 0)
            already = float(r[4] or 0)
            amount = float(amount_req) if amount_req else (paid - already)
            if amount <= 0 or already + amount > paid:
                return err("Некорректная сумма возврата")

            shop_id = os.environ.get("YOOKASSA_SHOP_ID", "")
            secret_key = os.environ.get("YOOKASSA_SECRET_KEY", "")
            yk_error = ""
            if shop_id and secret_key and r[2]:
                try:
                    auth = base64.b64encode(f"{shop_id}:{secret_key}".encode()).decode()
                    payload = json.dumps({
                        "payment_id": r[2],
                        "amount": {"value": f"{amount:.2f}", "currency": "RUB"},
                        "description": reason[:250],
                    }).encode()
                    req = Request(
                        "https://api.yookassa.ru/v3/refunds",
                        data=payload,
                        headers={
                            "Authorization": f"Basic {auth}",
                            "Idempotence-Key": secrets.token_hex(16),
                            "Content-Type": "application/json",
                        },
                        method="POST",
                    )
                    with urlopen(req, timeout=25) as resp:
                        json.loads(resp.read().decode())
                except HTTPError as e:
                    yk_error = e.read().decode()[:200]
                except Exception as e:
                    yk_error = str(e)[:200]

            if yk_error:
                return err(f"Платёжная система отклонила возврат: {yk_error}")

            cur.execute(
                f"UPDATE {SCHEMA}.orders SET refunded_amount = COALESCE(refunded_amount, 0) + %s, "
                f"refunded_at = NOW(), refund_reason = %s, refunded_by = %s, "
                f"status = CASE WHEN COALESCE(refunded_amount, 0) + %s >= amount "
                f"THEN 'refunded' ELSE status END WHERE id = %s",
                (amount, reason, admin["id"], amount, oid),
            )
            if r[3]:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.user_notifications (user_id, kind, title, body) "
                    f"VALUES (%s, 'system', %s, %s)",
                    (r[3], "Возврат оформлен",
                     f"{amount:.2f} руб. вернутся на счёт в течение нескольких дней. {reason}"),
                )
            audit(cur, admin, "payment_refund", f"Возврат {amount:.2f} руб. по заказу #{oid}: {reason}", ip)
            return ok({"success": True, "refunded": amount})

        if action == "subscription_extend":
            uid = int(body.get("user_id") or 0)
            days = int(body.get("days") or 0)
            reason = (body.get("reason") or "Компенсация от команды Nova").strip()
            if uid <= 0 or days == 0:
                return err("Укажите пользователя и количество дней")

            now = int(time.time())
            cur.execute(f"SELECT COALESCE(pro_until, 0), name FROM {SCHEMA}.users WHERE id = %s", (uid,))
            u = cur.fetchone()
            if not u:
                return err("Пользователь не найден", 404)
            base = max(int(u[0] or 0), now)
            new_until = base + days * 86400
            if new_until < now:
                new_until = now
            cur.execute(f"UPDATE {SCHEMA}.users SET pro_until = %s WHERE id = %s", (new_until, uid))
            cur.execute(
                f"INSERT INTO {SCHEMA}.pro_subscriptions "
                f"(user_id, plan, amount, source, starts_at, ends_at, is_trial, created_at) "
                f"VALUES (%s, 'manual', 0, 'manual', %s, %s, FALSE, %s)",
                (uid, now, new_until, now),
            )
            if days > 0:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.user_notifications (user_id, kind, title, body) "
                    f"VALUES (%s, 'premium', %s, %s)",
                    (uid, f"Premium продлён на {days} дн.", reason),
                )
            audit(cur, admin, "subscription_extend",
                  f"Подписка ID {uid} изменена на {days} дн.: {reason}", ip)
            return ok({"success": True, "pro_until": new_until})

        if action == "subscription_cancel":
            uid = int(body.get("user_id") or 0)
            reason = (body.get("reason") or "").strip()
            cur.execute(f"UPDATE {SCHEMA}.users SET pro_until = NULL WHERE id = %s", (uid,))
            cur.execute(
                f"INSERT INTO {SCHEMA}.user_notifications (user_id, kind, title, body) "
                f"VALUES (%s, 'system', %s, %s)",
                (uid, "Подписка Premium отключена", reason or "Обратитесь в поддержку за подробностями."),
            )
            audit(cur, admin, "subscription_cancel", f"Отключена подписка ID {uid}", ip)
            return ok({"success": True})

        # ── Промокоды ─────────────────────────────────────────────────────
        if action == "promos":
            cur.execute(
                f"SELECT id, code, title, kind, discount_percent, discount_amount, free_days, "
                f"plan_code, max_activations, used_count, per_user_limit, starts_at, expires_at, "
                f"active, note, created_at FROM {SCHEMA}.promo_codes ORDER BY created_at DESC LIMIT 200"
            )
            promos = [{
                "id": r[0], "code": r[1], "title": r[2], "kind": r[3],
                "discount_percent": r[4], "discount_amount": float(r[5] or 0),
                "free_days": r[6], "plan_code": r[7], "max_activations": r[8],
                "used_count": r[9], "per_user_limit": r[10],
                "starts_at": r[11], "expires_at": r[12],
                "active": bool(r[13]), "note": r[14], "created_at": r[15],
            } for r in cur.fetchall()]

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.promo_activations")
            total_act = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.promo_activations WHERE suspicious = TRUE")
            susp = cur.fetchone()[0]
            return ok({"promos": promos, "total_activations": total_act, "suspicious": susp})

        if action == "promo_save":
            pid = int(body.get("id") or 0)
            code = (body.get("code") or "").strip().upper()
            if not code:
                return err("Укажите код промокода")
            vals = (
                code[:40], (body.get("title") or "")[:120],
                (body.get("kind") or "discount")[:20],
                int(body.get("discount_percent") or 0),
                float(body.get("discount_amount") or 0),
                int(body.get("free_days") or 0),
                (body.get("plan_code") or "")[:40],
                int(body.get("max_activations") or 0),
                int(body.get("per_user_limit") or 1),
                int(body["starts_at"]) if body.get("starts_at") else None,
                int(body["expires_at"]) if body.get("expires_at") else None,
                bool(body.get("active", True)),
                (body.get("note") or "")[:300],
            )
            if pid:
                cur.execute(
                    f"UPDATE {SCHEMA}.promo_codes SET code=%s, title=%s, kind=%s, discount_percent=%s, "
                    f"discount_amount=%s, free_days=%s, plan_code=%s, max_activations=%s, "
                    f"per_user_limit=%s, starts_at=%s, expires_at=%s, active=%s, note=%s WHERE id=%s",
                    vals + (pid,),
                )
                audit(cur, admin, "promo_save", f"Изменён промокод {code}", ip)
            else:
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.promo_codes WHERE code = %s", (code,)
                )
                if cur.fetchone():
                    return err("Такой промокод уже есть")
                cur.execute(
                    f"INSERT INTO {SCHEMA}.promo_codes (code, title, kind, discount_percent, "
                    f"discount_amount, free_days, plan_code, max_activations, per_user_limit, "
                    f"starts_at, expires_at, active, note, created_by) "
                    f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    vals + (admin["id"],),
                )
                audit(cur, admin, "promo_save", f"Создан промокод {code}", ip)
            return ok({"success": True})

        if action == "promo_toggle":
            pid = int(body.get("id") or 0)
            cur.execute(
                f"UPDATE {SCHEMA}.promo_codes SET active = NOT active WHERE id = %s RETURNING code, active",
                (pid,),
            )
            r = cur.fetchone()
            if not r:
                return err("Промокод не найден", 404)
            audit(cur, admin, "promo_toggle",
                  f"Промокод {r[0]}: {'включён' if r[1] else 'выключен'}", ip)
            return ok({"success": True, "active": bool(r[1])})

        if action == "promo_activations":
            only_susp = bool(body.get("suspicious"))
            where = "WHERE a.suspicious = TRUE" if only_susp else ""
            cur.execute(
                f"SELECT a.id, a.code, a.user_id, u.name, a.granted_days, a.discount_applied, "
                f"a.ip_addr, a.suspicious, a.suspicious_reason, a.created_at "
                f"FROM {SCHEMA}.promo_activations a "
                f"LEFT JOIN {SCHEMA}.users u ON u.id = a.user_id "
                f"{where} ORDER BY a.created_at DESC LIMIT 100"
            )
            items = [{
                "id": r[0], "code": r[1], "user_id": r[2], "user_name": r[3] or f"ID {r[2]}",
                "granted_days": r[4], "discount": float(r[5] or 0), "ip": r[6],
                "suspicious": bool(r[7]), "reason": r[8], "created_at": r[9],
            } for r in cur.fetchall()]
            return ok({"items": items})

        # ── Подарочный Premium ────────────────────────────────────────────
        if action == "gift_premium":
            uid = int(body.get("user_id") or 0)
            days = int(body.get("days") or 0)
            reason = (body.get("reason") or "Подарок от команды Nova").strip()
            if uid <= 0 or days <= 0:
                return err("Укажите пользователя и количество дней")

            now = int(time.time())
            cur.execute(f"SELECT COALESCE(pro_until, 0), name FROM {SCHEMA}.users WHERE id = %s", (uid,))
            r = cur.fetchone()
            if not r:
                return err("Пользователь не найден", 404)
            new_until = max(int(r[0] or 0), now) + days * 86400
            cur.execute(f"UPDATE {SCHEMA}.users SET pro_until = %s WHERE id = %s", (new_until, uid))
            cur.execute(
                f"INSERT INTO {SCHEMA}.pro_subscriptions "
                f"(user_id, plan, amount, source, starts_at, ends_at, is_trial, created_at) "
                f"VALUES (%s, 'gift', 0, 'gift', %s, %s, FALSE, %s)",
                (uid, now, new_until, now),
            )
            cur.execute(
                f"INSERT INTO {SCHEMA}.user_notifications (user_id, kind, title, body) "
                f"VALUES (%s, 'premium', %s, %s)",
                (uid, f"Premium на {days} дн. в подарок", reason),
            )
            audit(cur, admin, "gift_premium", f"Подарен Premium на {days} дн. ID {uid}", ip)
            return ok({"success": True, "pro_until": new_until})

        # ── Реферальная программа ─────────────────────────────────────────
        if action == "referral_settings":
            cur.execute(
                f"SELECT key, value FROM {SCHEMA}.dev_settings WHERE key LIKE 'referral_%%'"
            )
            cfg = {r[0]: r[1] for r in cur.fetchall()}
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.referrals")
            total = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.referrals WHERE rewarded = TRUE")
            rewarded = cur.fetchone()[0]
            return ok({"settings": {
                "enabled": cfg.get("referral_enabled", "true") == "true",
                "inviter_days": int(cfg.get("referral_inviter_days", "7") or 7),
                "invited_days": int(cfg.get("referral_invited_days", "7") or 7),
            }, "stats": {"total": total, "rewarded": rewarded}})

        if action == "referral_settings_save":
            pairs = {
                "referral_enabled": "true" if body.get("enabled") else "false",
                "referral_inviter_days": str(int(body.get("inviter_days") or 0)),
                "referral_invited_days": str(int(body.get("invited_days") or 0)),
            }
            for k, v in pairs.items():
                cur.execute(
                    f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_at, updated_by) "
                    f"VALUES (%s, %s, %s, %s) ON CONFLICT (key) DO UPDATE "
                    f"SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, "
                    f"updated_by = EXCLUDED.updated_by",
                    (k, v, int(time.time()), admin["id"]),
                )
            audit(cur, admin, "referral_settings_save", "Изменены настройки рефералов", ip)
            return ok({"success": True})

        if action == "referrals_top":
            cur.execute(
                f"SELECT r.inviter_id, u.name, COUNT(*), SUM(CASE WHEN r.rewarded THEN 1 ELSE 0 END) "
                f"FROM {SCHEMA}.referrals r LEFT JOIN {SCHEMA}.users u ON u.id = r.inviter_id "
                f"GROUP BY r.inviter_id, u.name ORDER BY COUNT(*) DESC LIMIT 20"
            )
            items = [{
                "user_id": r[0], "name": r[1] or f"ID {r[0]}",
                "invited": r[2], "rewarded": r[3] or 0,
            } for r in cur.fetchall()]
            return ok({"items": items})

        # ── Настройки панели ──────────────────────────────────────────────
        if action == "twofa_get":
            cur.execute(
                f"SELECT COALESCE(twofa_enabled, FALSE), COALESCE(phone, '') "
                f"FROM {SCHEMA}.dev_admins WHERE id = %s",
                (admin["id"],),
            )
            r = cur.fetchone() or (False, "")
            sms_ready = SMS_ENABLED and bool(os.environ.get("SMSC_LOGIN") and os.environ.get("SMSC_PASSWORD"))
            return ok({"enabled": bool(r[0]), "phone": r[1], "sms_ready": sms_ready})

        if action == "twofa_save":
            enabled = bool(body.get("enabled"))
            phone = "".join(c for c in str(body.get("phone") or "") if c.isdigit())
            if enabled:
                if len(phone) < 11:
                    return err("Укажите номер телефона полностью, например 79991234567")
                if not SMS_ENABLED:
                    return err("SMS временно отключены")
                if not (os.environ.get("SMSC_LOGIN") and os.environ.get("SMSC_PASSWORD")):
                    return err("SMS не настроены. Добавьте доступы SMSC в секреты проекта.")
            cur.execute(
                f"UPDATE {SCHEMA}.dev_admins SET twofa_enabled = %s, phone = %s WHERE id = %s",
                (enabled, phone[:20], admin["id"]),
            )
            audit(cur, admin, "twofa_save",
                  "Включена защита входа кодом" if enabled else "Отключена защита входа", ip)
            return ok({"success": True, "enabled": enabled})

        if action == "resets_list":
            now = int(time.time())
            cur.execute(
                f"UPDATE {SCHEMA}.password_resets SET status = 'expired' WHERE status = 'pending' AND expires_at < %s",
                (now,),
            )
            cur.execute(
                f"SELECT r.id, r.user_id, u.name, u.phone, r.route, r.status, r.device_name, r.ip_addr, r.created_at, "
                f"(SELECT MAX(created_at) FROM {SCHEMA}.login_events le WHERE le.user_id = r.user_id) "
                f"FROM {SCHEMA}.password_resets r JOIN {SCHEMA}.users u ON u.id = r.user_id "
                f"WHERE r.route = 'admin' ORDER BY (r.status = 'pending') DESC, r.id DESC LIMIT 50"
            )
            items = [{
                "id": x[0], "user_id": x[1], "name": x[2], "phone": x[3], "route": x[4], "status": x[5],
                "device": x[6], "ip": x[7], "created_at": int(x[8]), "last_login": int(x[9]) if x[9] else None,
            } for x in cur.fetchall()]
            return ok({"items": items, "pending": sum(1 for i in items if i["status"] == "pending")})

        if action == "reset_decide":
            rid = int(body.get("id") or 0)
            approve = bool(body.get("approve"))
            now = int(time.time())
            cur.execute(
                f"SELECT user_id, new_password_hash FROM {SCHEMA}.password_resets "
                f"WHERE id = %s AND status = 'pending' AND route = 'admin' AND expires_at > %s",
                (rid, now),
            )
            r = cur.fetchone()
            if not r:
                return err("Заявка не найдена или устарела", 404)
            if approve:
                cur.execute(f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE id = %s", (r[1], r[0]))
                cur.execute(f"UPDATE {SCHEMA}.user_sessions SET revoked = TRUE WHERE user_id = %s", (r[0],))
            cur.execute(
                f"UPDATE {SCHEMA}.password_resets SET status = %s, decided_at = %s, decided_by = %s WHERE id = %s",
                ("approved" if approve else "rejected", now, f"admin:{admin['id']}", rid),
            )
            audit(cur, admin, "reset_decide",
                  f"{'Одобрен' if approve else 'Отклонён'} сброс пароля пользователя ID {r[0]}", ip)
            return ok({"success": True})

        if action == "auth_strict_get":
            cur.execute(f"SELECT value FROM {SCHEMA}.dev_settings WHERE key = 'auth_strict'")
            r = cur.fetchone()
            day = int(time.time()) - 86400
            cur.execute(
                f"SELECT COUNT(DISTINCT user_id) FROM {SCHEMA}.user_sessions "
                f"WHERE token_hash IS NOT NULL AND revoked = FALSE AND last_active_at > %s",
                (day,),
            )
            with_key = int(cur.fetchone()[0])
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.users "
                f"WHERE last_seen > %s AND COALESCE(is_bot, FALSE) = FALSE AND id NOT IN ("
                f"SELECT user_id FROM {SCHEMA}.user_sessions WHERE token_hash IS NOT NULL AND revoked = FALSE)",
                (day,),
            )
            without_key = int(cur.fetchone()[0])
            return ok({"enabled": bool(r and r[0] == "1"), "with_key": with_key, "without_key": without_key})

        if action == "auth_strict_save":
            enabled = bool(body.get("enabled"))
            cur.execute(
                f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_at, updated_by) VALUES ('auth_strict', %s, %s, %s) "
                f"ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by",
                ("1" if enabled else "0", int(time.time()), admin["id"]),
            )
            audit(cur, admin, "auth_strict_save",
                  "Включена строгая проверка входа" if enabled else "Выключена строгая проверка входа", ip)
            return ok({"success": True, "enabled": enabled})

        if action == "settings_get":
            cur.execute(f"SELECT key, value FROM {SCHEMA}.dev_settings")
            return ok({"settings": {r[0]: r[1] for r in cur.fetchall()}})

        if action == "settings_save":
            items = body.get("settings") or {}
            now = int(time.time())
            for key, value in items.items():
                cur.execute(
                    f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_at, updated_by) "
                    f"VALUES (%s, %s, %s, %s) ON CONFLICT (key) DO UPDATE "
                    f"SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by",
                    (str(key)[:50], str(value)[:2000], now, admin["id"]),
                )
            audit(cur, admin, "settings_save", "Изменены настройки панели", ip)
            return ok({"success": True})

        # ── Уведомления в Telegram ────────────────────────────────────────
        if action == "tg_get":
            cur.execute(
                f"SELECT key, value FROM {SCHEMA}.dev_settings WHERE key LIKE 'tg_%%'"
            )
            st = {r[0]: r[1] for r in cur.fetchall()}
            return ok({
                "enabled": st.get("tg_enabled") == "1",
                "has_token": bool(st.get("tg_bot_token")),
                "chat_id": st.get("tg_chat_id") or "",
                "events": (st.get("tg_events") or "report,support,pay").split(","),
            })

        if action == "tg_save":
            pairs = {}
            if body.get("token") is not None:
                pairs["tg_bot_token"] = re.sub(r"\s+", "", body.get("token") or "")
            if body.get("chat_id") is not None:
                pairs["tg_chat_id"] = re.sub(r"\s+", "", body.get("chat_id") or "")
            if _looks_like_tg_token(pairs.get("tg_chat_id", "")):
                if not pairs.get("tg_bot_token"):
                    pairs["tg_bot_token"] = pairs["tg_chat_id"]
                pairs["tg_chat_id"] = ""
            cur.execute(f"SELECT key, value FROM {SCHEMA}.dev_settings WHERE key IN ('tg_bot_token', 'tg_chat_id')")
            prev = {r[0]: r[1] for r in cur.fetchall()}
            if not pairs.get("tg_bot_token") and not prev.get("tg_bot_token") and _looks_like_tg_token(prev.get("tg_chat_id") or ""):
                pairs["tg_bot_token"] = prev["tg_chat_id"].strip()
            if not pairs.get("tg_bot_token") and not pairs.get("tg_chat_id"):
                saved = [prev.get("tg_bot_token")]
                if saved and saved[0]:
                    upd = _tg_call(saved[0], "getUpdates")
                    for u in reversed(upd.get("result") or []):
                        chat = ((u.get("message") or u.get("my_chat_member") or {}).get("chat") or {})
                        if chat.get("id"):
                            pairs["tg_chat_id"] = str(chat["id"])
                            break
            if pairs.get("tg_chat_id") and not re.fullmatch(r"-?\d{3,20}|@[A-Za-z0-9_]{4,64}", pairs["tg_chat_id"]):
                return err("«Кому отправлять» — это номер из цифр. Оставьте поле пустым, панель найдёт его сама")
            if body.get("events") is not None:
                pairs["tg_events"] = ",".join(body.get("events") or [])
            pairs["tg_enabled"] = "1" if body.get("enabled") else "0"

            bot_name = ""
            tg_down = False
            if pairs.get("tg_bot_token"):
                if not _looks_like_tg_token(pairs["tg_bot_token"]):
                    return err("Это не похоже на ключ бота. Он выглядит так: 1234567890:AAH… — с двоеточием посередине")
                me = _tg_call(pairs["tg_bot_token"], "getMe")
                tg_down = bool(me.get("network"))
                if not me.get("ok") and not tg_down:
                    return err("Telegram ответил, что такого ключа нет. Возьмите актуальный ключ в @BotFather → /mybots → бот → API Token")
                bot_name = (me.get("result") or {}).get("username") or ""
                if not pairs.get("tg_chat_id") and not tg_down:
                    upd = _tg_call(pairs["tg_bot_token"], "getUpdates")
                    for u in reversed(upd.get("result") or []):
                        chat = ((u.get("message") or u.get("my_chat_member") or {}).get("chat") or {})
                        if chat.get("id"):
                            pairs["tg_chat_id"] = str(chat["id"])
                            break
            now_ts = int(time.time())
            for k, v in pairs.items():
                cur.execute(
                    f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_at, updated_by) "
                    f"VALUES (%s, %s, %s, %s) ON CONFLICT (key) DO UPDATE "
                    f"SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by",
                    (k, v, now_ts, admin["id"]),
                )
            audit(cur, admin, "tg_save", "Настроены уведомления в Telegram", ip)
            if pairs.get("tg_bot_token") and tg_down:
                return ok({"success": True, "warning": TG_UNREACHABLE, "chat_id": pairs.get("tg_chat_id")})
            return ok({"success": True, "bot": bot_name, "chat_id": pairs.get("tg_chat_id")})

        if action == "daily_summary_test":
            from owner_notify import send_daily_summary
            n = send_daily_summary(cur, SCHEMA)
            if not n:
                return err("Ни один владелец не привязан к аккаунту Nova. Привяжите аккаунт в разделе «Команда»")
            return ok({"sent": n})

        if action == "nova_notify_test":
            cur.execute(
                f"SELECT DISTINCT nova_user_id FROM {SCHEMA}.dev_admins "
                f"WHERE role = 'owner' AND COALESCE(disabled, FALSE) = FALSE AND nova_user_id IS NOT NULL"
            )
            owners = [int(r[0]) for r in cur.fetchall()]
            if not owners:
                return err("Ни один владелец не привязан к аккаунту Nova. Привяжите аккаунт в разделе «Команда»")
            for uid in owners:
                send_from_nova(cur, uid, "Проверка уведомлений\n\nСюда будут приходить жалобы, оплаты и обращения в поддержку.")
            return ok({"sent": len(owners)})

        if action == "tg_test":
            cur.execute(
                f"SELECT key, value FROM {SCHEMA}.dev_settings "
                f"WHERE key IN ('tg_bot_token', 'tg_chat_id')"
            )
            st = {r[0]: r[1] for r in cur.fetchall()}
            token, chat = st.get("tg_bot_token"), st.get("tg_chat_id")
            if _looks_like_tg_token(chat or ""):
                token = token or chat
                chat = ""
            if not token:
                return err("Вставьте ключ бота из @BotFather в поле «Ключ бота» и нажмите «Сохранить»")
            if not chat:
                upd = _tg_call(token, "getUpdates")
                if upd.get("network"):
                    return err(TG_UNREACHABLE)
                for u in reversed(upd.get("result") or []):
                    c = ((u.get("message") or u.get("my_chat_member") or {}).get("chat") or {})
                    if c.get("id"):
                        chat = str(c["id"])
                        break
                if not chat:
                    me = _tg_call(token, "getMe")
                    if me.get("network"):
                        return err(TG_UNREACHABLE)
                    if not me.get("ok"):
                        return err("Telegram ответил, что такого ключа нет. Возьмите актуальный ключ в @BotFather → /mybots → бот → API Token")
                    bn = (me.get("result") or {}).get("username") or "вашего бота"
                    return err(f"Откройте @{bn} в Telegram, нажмите «Старт» и снова нажмите «Проверить»")
            for k, v in (("tg_bot_token", token), ("tg_chat_id", chat)):
                cur.execute(
                    f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_at, updated_by) "
                    f"VALUES (%s, %s, %s, %s) ON CONFLICT (key) DO UPDATE "
                    f"SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by",
                    (k, v, int(time.time()), admin["id"]),
                )
            sent = _tg_send(token, chat,
                            "Проверка связи\n\nУведомления Nova настроены — сообщения будут приходить сюда.")
            if not sent:
                me = _tg_call(token, "getMe")
                if me.get("network"):
                    return err(TG_UNREACHABLE)
                if not me.get("ok"):
                    return err("Telegram ответил, что такого ключа нет. Возьмите актуальный ключ в @BotFather → /mybots → бот → API Token")
                bn = (me.get("result") or {}).get("username") or "вашему боту"
                return err(f"Бот не может написать получателю. Откройте @{bn} в Telegram, нажмите «Старт» и проверьте номер получателя (его показывает @userinfobot)")
            return ok({"success": True, "chat_id": chat})

        # ── Карточка пользователя целиком ─────────────────────────────────
        if action == "user_full":
            uid = int(body.get("user_id") or 0)
            now_ts = int(time.time())

            cur.execute(
                f"SELECT id, name, COALESCE(phone, ''), created_at, COALESCE(last_seen, 0), "
                f"COALESCE(avatar_url, ''), COALESCE(about, ''), COALESCE(banned_until, 0), "
                f"COALESCE(banned_reason, ''), COALESCE(wallet_balance, 0), "
                f"COALESCE(verified, FALSE), COALESCE(pro_until, 0), vk_id, nova_id "
                f"FROM {SCHEMA}.users WHERE id = %s",
                (uid,),
            )
            u = cur.fetchone()
            if not u:
                return err("Пользователь не найден", 404)

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE sender_id = %s", (uid,))
            msgs = int(cur.fetchone()[0] or 0)
            cur.execute(
                f"SELECT COALESCE(SUM(amount), 0), COUNT(*) FROM {SCHEMA}.orders "
                f"WHERE nova_user_id = %s AND status IN ('paid','succeeded')",
                (uid,),
            )
            pay = cur.fetchone()

            cur.execute(
                f"SELECT r.reason, COALESCE(r.comment, ''), r.status, r.created_at, "
                f"COALESCE(ru.name, '—') FROM {SCHEMA}.reports r "
                f"LEFT JOIN {SCHEMA}.users ru ON ru.id = r.reporter_id "
                f"WHERE r.reported_user_id = %s ORDER BY r.created_at DESC LIMIT 20",
                (uid,),
            )
            reports = [{"reason": r[0], "comment": r[1], "status": r[2],
                        "ts": r[3], "from": r[4]} for r in cur.fetchall()]

            cur.execute(
                f"SELECT until_ts, COALESCE(reason, ''), COALESCE(by_admin, ''), kind, created_at "
                f"FROM {SCHEMA}.ban_history WHERE user_id = %s ORDER BY created_at DESC LIMIT 20",
                (uid,),
            )
            bans = [{"until": r[0], "reason": r[1], "by": r[2], "kind": r[3], "ts": r[4]}
                    for r in cur.fetchall()]

            cur.execute(
                f"SELECT id, amount, status, EXTRACT(epoch FROM created_at)::bigint "
                f"FROM {SCHEMA}.orders WHERE nova_user_id = %s ORDER BY created_at DESC LIMIT 20",
                (uid,),
            )
            orders = [{"id": r[0], "amount": float(r[1] or 0), "status": r[2],
                       "ts": int(r[3] or 0)} for r in cur.fetchall()]

            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.moderation_hits WHERE user_id = %s", (uid,)
            )
            mod_hits = int(cur.fetchone()[0] or 0)

            risk = min(100, len(reports) * 15 + mod_hits * 10 + (30 if int(u[7] or 0) > now_ts else 0))

            return ok({
                "user": {
                    "id": u[0], "name": u[1], "phone": u[2], "created_at": u[3],
                    "last_seen": u[4], "avatar_url": u[5], "about": u[6],
                    "banned_until": int(u[7] or 0), "banned_reason": u[8],
                    "wallet": float(u[9] or 0), "verified": bool(u[10]),
                    "pro_until": int(u[11] or 0),
                    "online": bool(u[4] and u[4] > now_ts - 300),
                    "vk_id": u[12], "phone_missing": str(u[2] or "").startswith("vk"),
                    "nova_id": u[13],
                },
                "stats": {
                    "messages": msgs, "paid_total": float(pay[0] or 0),
                    "orders_count": int(pay[1] or 0), "mod_hits": mod_hits,
                    "reports_count": len(reports), "risk": risk,
                },
                "reports": reports, "bans": bans, "orders": orders,
            })

        # ── Общий поиск по всей панели ────────────────────────────────────
        if action == "global_search":
            q = (body.get("query") or "").strip()
            if len(q) < 2:
                return ok({"groups": []})
            like = f"%{q}%"
            digits = "".join(c for c in q if c.isdigit())
            groups = []

            cur.execute(
                f"SELECT id, name, COALESCE(phone, ''), COALESCE(avatar_url, '') "
                f"FROM {SCHEMA}.users WHERE name ILIKE %s OR COALESCE(phone, '') ILIKE %s "
                f"OR CAST(id AS TEXT) = %s OR nova_id = %s LIMIT 8",
                (like, like, digits or "0", digits or "-"),
            )
            rows = [{"id": r[0], "title": r[1] or "Без имени",
                     "sub": r[2] or f"ID {r[0]}", "avatar": r[3]} for r in cur.fetchall()]
            if rows:
                groups.append({"key": "users", "label": "Пользователи", "section": "users", "items": rows})

            cur.execute(
                f"SELECT id, name, COALESCE(is_channel, FALSE) FROM {SCHEMA}.groups "
                f"WHERE name ILIKE %s LIMIT 6",
                (like,),
            )
            rows = [{"id": r[0], "title": r[1], "sub": "Канал" if r[2] else "Группа"}
                    for r in cur.fetchall()]
            if rows:
                groups.append({"key": "channels", "label": "Каналы и группы",
                               "section": "channels", "items": rows})

            if digits:
                cur.execute(
                    f"SELECT o.id, COALESCE(u.name, o.user_name, '—'), o.amount, o.status "
                    f"FROM {SCHEMA}.orders o LEFT JOIN {SCHEMA}.users u ON u.id = o.nova_user_id "
                    f"WHERE CAST(o.id AS TEXT) LIKE %s LIMIT 6",
                    (f"%{digits}%",),
                )
                rows = [{"id": r[0], "title": f"Заказ №{r[0]} — {float(r[2] or 0):.0f} ₽",
                         "sub": f"{r[1]} · {r[3]}"} for r in cur.fetchall()]
                if rows:
                    groups.append({"key": "payments", "label": "Платежи",
                                   "section": "payments", "items": rows})

            cur.execute(
                f"SELECT t.id, COALESCE(u.name, '—'), t.subject FROM {SCHEMA}.support_tickets t "
                f"LEFT JOIN {SCHEMA}.users u ON u.id = t.user_id "
                f"WHERE t.subject ILIKE %s LIMIT 6",
                (like,),
            )
            rows = [{"id": r[0], "title": r[2] or "Без темы", "sub": r[1]}
                    for r in cur.fetchall()]
            if rows:
                groups.append({"key": "support", "label": "Обращения",
                               "section": "support", "items": rows})

            return ok({"groups": groups})

        # ── Сохранённые фильтры ───────────────────────────────────────────
        if action == "filters_list":
            cur.execute(
                f"SELECT id, name, filters FROM {SCHEMA}.dev_saved_filters "
                f"WHERE shared = TRUE OR admin_id = %s ORDER BY id",
                (admin["id"],),
            )
            return ok({"items": [{"id": r[0], "name": r[1], "filters": json.loads(r[2])}
                                 for r in cur.fetchall()]})

        if action == "filter_save":
            name = (body.get("name") or "").strip()[:80]
            filters = body.get("filters") or {}
            if not name:
                return err("Укажите название фильтра")
            cur.execute(
                f"INSERT INTO {SCHEMA}.dev_saved_filters (admin_id, name, filters) "
                f"VALUES (%s, %s, %s)",
                (admin["id"], name, json.dumps(filters, ensure_ascii=False)),
            )
            return ok({"success": True})

        if action == "filter_delete":
            cur.execute(f"DELETE FROM {SCHEMA}.dev_saved_filters WHERE id = %s",
                        (int(body.get("id") or 0),))
            return ok({"success": True})

        # Список пользователей с условиями (для фильтров)
        if action == "users_filtered":
            f = body.get("filters") or {}
            now_ts = int(time.time())
            where, params = ["id > 0"], []

            if f.get("premium") == "yes":
                where.append("COALESCE(pro_until, 0) > %s"); params.append(now_ts)
            elif f.get("premium") == "no":
                where.append("COALESCE(pro_until, 0) <= %s"); params.append(now_ts)
            if f.get("banned") == "yes":
                where.append("COALESCE(banned_until, 0) > %s"); params.append(now_ts)
            if f.get("verified") == "yes":
                where.append("COALESCE(verified, FALSE) = TRUE")
            if f.get("inactive_days"):
                where.append("COALESCE(last_seen, 0) < %s")
                params.append(now_ts - int(f["inactive_days"]) * 86400)
            if f.get("new_days"):
                where.append("created_at > %s")
                params.append(now_ts - int(f["new_days"]) * 86400)
            if f.get("has_wallet") == "yes":
                where.append("COALESCE(wallet_balance, 0) > 0")
            if f.get("vk") == "yes":
                where.append("vk_id IS NOT NULL")
            elif f.get("vk") == "no_phone":
                where.append("phone LIKE 'vk%%'")
            elif f.get("vk") == "no":
                where.append("vk_id IS NULL")

            sql = (f"SELECT id, name, COALESCE(phone, ''), created_at, last_seen, "
                   f"COALESCE(avatar_url, ''), COALESCE(verified, FALSE), "
                   f"COALESCE(pro_until, 0), COALESCE(banned_until, 0), vk_id "
                   f"FROM {SCHEMA}.users WHERE " + " AND ".join(where) +
                   " ORDER BY created_at DESC LIMIT 200")
            cur.execute(sql, tuple(params))
            users = [{
                "id": r[0], "name": r[1], "phone": r[2], "created_at": r[3],
                "last_seen": r[4], "avatar_url": r[5], "verified": bool(r[6]),
                "online": bool(r[4] and r[4] > now_ts - 300),
                "premium": int(r[7] or 0) > now_ts,
                "banned": int(r[8] or 0) > now_ts,
                "vk_id": r[9], "phone_missing": str(r[2] or "").startswith("vk"),
            } for r in cur.fetchall()]
            return ok({"users": users, "total": len(users)})

        # ── Отмена последнего действия ────────────────────────────────────
        if action == "undo_list":
            cur.execute(
                f"SELECT id, action, label, created_at FROM {SCHEMA}.dev_undo "
                f"WHERE admin_id = %s AND undone = FALSE AND created_at > %s "
                f"ORDER BY created_at DESC LIMIT 10",
                (admin["id"], int(time.time()) - 3600),
            )
            return ok({"items": [{"id": r[0], "action": r[1], "label": r[2], "ts": r[3]}
                                 for r in cur.fetchall()]})

        if action == "undo_apply":
            cur.execute(
                f"SELECT id, action, payload FROM {SCHEMA}.dev_undo "
                f"WHERE id = %s AND admin_id = %s AND undone = FALSE",
                (int(body.get("id") or 0), admin["id"]),
            )
            row = cur.fetchone()
            if not row:
                return err("Действие не найдено или уже отменено")
            snap = json.loads(row[2])

            if row[1] == "ban_user":
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET banned_until = %s, banned_reason = %s "
                    f"WHERE id = %s",
                    (snap.get("banned_until"), snap.get("banned_reason"), snap["user_id"]),
                )
            elif row[1] == "wallet_set":
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET wallet_balance = %s WHERE id = %s",
                    (snap.get("wallet_balance"), snap["user_id"]),
                )
            elif row[1] == "rename_user":
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET name = %s WHERE id = %s",
                    (snap.get("name"), snap["user_id"]),
                )
            elif row[1] == "bulk_action":
                for item in snap.get("users", []):
                    cur.execute(
                        f"UPDATE {SCHEMA}.users SET banned_until = %s, pro_until = %s "
                        f"WHERE id = %s",
                        (item.get("banned_until"), item.get("pro_until"), item["id"]),
                    )
            else:
                return err("Это действие нельзя отменить")

            cur.execute(f"UPDATE {SCHEMA}.dev_undo SET undone = TRUE WHERE id = %s", (row[0],))
            audit(cur, admin, "undo_apply", f"Отменено: {snap.get('label', row[1])}", ip)
            return ok({"success": True})

        # ── Резервная копия основных данных ───────────────────────────────
        if action == "backup_export":
            out = {}
            cur.execute(
                f"SELECT id, name, COALESCE(phone, ''), created_at, COALESCE(pro_until, 0), "
                f"COALESCE(wallet_balance, 0), COALESCE(verified, FALSE) "
                f"FROM {SCHEMA}.users ORDER BY id"
            )
            out["users"] = [{
                "id": r[0], "name": r[1], "phone": r[2], "created_at": r[3],
                "pro_until": int(r[4] or 0), "wallet": float(r[5] or 0), "verified": bool(r[6]),
            } for r in cur.fetchall()]

            cur.execute(
                f"SELECT id, COALESCE(nova_user_id, 0), amount, status, "
                f"EXTRACT(epoch FROM created_at)::bigint FROM {SCHEMA}.orders ORDER BY id"
            )
            out["orders"] = [{"id": r[0], "user_id": r[1], "amount": float(r[2] or 0),
                              "status": r[3], "created_at": int(r[4] or 0)} for r in cur.fetchall()]

            cur.execute(f"SELECT id, name, COALESCE(is_channel, FALSE) FROM {SCHEMA}.groups ORDER BY id")
            out["groups"] = [{"id": r[0], "name": r[1], "is_channel": bool(r[2])}
                             for r in cur.fetchall()]

            cur.execute(f"SELECT key, value FROM {SCHEMA}.dev_settings")
            out["settings"] = {r[0]: r[1] for r in cur.fetchall()}

            audit(cur, admin, "backup_export", "Скачана резервная копия", ip)
            return ok({
                "backup": out, "made_at": int(time.time()),
                "counts": {k: len(v) if isinstance(v, list) else len(v) for k, v in out.items()},
            })

        # ── Автоправила модерации ─────────────────────────────────────────
        if action == "auto_rules":
            cur.execute(
                f"SELECT id, name, trigger_kind, threshold, window_hours, action, "
                f"action_days, enabled, fired_count, last_fired_at "
                f"FROM {SCHEMA}.auto_rules ORDER BY id"
            )
            rules = [{
                "id": r[0], "name": r[1], "trigger_kind": r[2], "threshold": r[3],
                "window_hours": r[4], "action": r[5], "action_days": r[6],
                "enabled": bool(r[7]), "fired_count": r[8], "last_fired_at": r[9],
            } for r in cur.fetchall()]
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.auto_rule_hits WHERE created_at > %s",
                (int(time.time()) - 86400,),
            )
            return ok({"rules": rules, "hits_24h": int(cur.fetchone()[0] or 0)})

        if action == "auto_rule_save":
            rid = body.get("id")
            name = (body.get("name") or "").strip()[:120]
            kind = body.get("trigger_kind") or "reports"
            threshold = max(1, int(body.get("threshold") or 3))
            window = max(1, int(body.get("window_hours") or 24))
            act = body.get("rule_action") or "notify"
            act_days = max(0, int(body.get("action_days") or 0))
            enabled = bool(body.get("enabled"))
            if not name:
                return err("Укажите название правила")
            if kind not in ("reports", "msg_rate", "mod_hits"):
                return err("Неизвестное условие")
            if act not in ("ban", "freeze", "notify"):
                return err("Неизвестное действие")

            if rid:
                cur.execute(
                    f"UPDATE {SCHEMA}.auto_rules SET name = %s, trigger_kind = %s, "
                    f"threshold = %s, window_hours = %s, action = %s, action_days = %s, "
                    f"enabled = %s WHERE id = %s",
                    (name, kind, threshold, window, act, act_days, enabled, int(rid)),
                )
            else:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.auto_rules "
                    f"(name, trigger_kind, threshold, window_hours, action, action_days, enabled) "
                    f"VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (name, kind, threshold, window, act, act_days, enabled),
                )
            audit(cur, admin, "auto_rule_save", f"Автоправило: {name}", ip)
            return ok({"success": True})

        if action == "auto_rule_delete":
            cur.execute(f"DELETE FROM {SCHEMA}.auto_rules WHERE id = %s",
                        (int(body.get("id") or 0),))
            audit(cur, admin, "auto_rule_delete", "Удалено автоправило", ip)
            return ok({"success": True})

        if action == "auto_rule_hits":
            cur.execute(
                f"SELECT h.id, h.user_id, COALESCE(u.name, '—'), r.name, h.detail, h.created_at "
                f"FROM {SCHEMA}.auto_rule_hits h "
                f"LEFT JOIN {SCHEMA}.users u ON u.id = h.user_id "
                f"LEFT JOIN {SCHEMA}.auto_rules r ON r.id = h.rule_id "
                f"ORDER BY h.created_at DESC LIMIT 60"
            )
            return ok({"items": [{
                "id": r[0], "user_id": r[1], "user_name": r[2],
                "rule": r[3] or "удалённое правило", "detail": r[4], "ts": r[5],
            } for r in cur.fetchall()]})

        # Проверка правил: находит нарушителей и применяет действие
        if action == "auto_rule_run":
            now_ts = int(time.time())
            cur.execute(
                f"SELECT id, name, trigger_kind, threshold, window_hours, action, action_days "
                f"FROM {SCHEMA}.auto_rules WHERE enabled = TRUE"
            )
            rules = cur.fetchall()
            applied = []

            for rid, rname, kind, thr, win, act, act_days in rules:
                since = now_ts - win * 3600
                if kind == "reports":
                    cur.execute(
                        f"SELECT reported_user_id, COUNT(*) FROM {SCHEMA}.reports "
                        f"WHERE created_at > %s GROUP BY reported_user_id HAVING COUNT(*) >= %s",
                        (since, thr),
                    )
                elif kind == "msg_rate":
                    cur.execute(
                        f"SELECT sender_id, COUNT(*) FROM {SCHEMA}.messages "
                        f"WHERE created_at > %s GROUP BY sender_id HAVING COUNT(*) >= %s",
                        (since, thr),
                    )
                else:
                    cur.execute(
                        f"SELECT user_id, COUNT(*) FROM {SCHEMA}.moderation_hits "
                        f"WHERE created_at > %s GROUP BY user_id HAVING COUNT(*) >= %s",
                        (since, thr),
                    )
                found = cur.fetchall()

                for uid, cnt in found:
                    if not uid:
                        continue
                    # Не наказываем дважды за то же правило в том же окне
                    cur.execute(
                        f"SELECT 1 FROM {SCHEMA}.auto_rule_hits "
                        f"WHERE rule_id = %s AND user_id = %s AND created_at > %s LIMIT 1",
                        (rid, uid, since),
                    )
                    if cur.fetchone():
                        continue

                    detail = f"{cnt} за {win} ч"
                    if act in ("ban", "freeze"):
                        days = act_days or (1 if act == "freeze" else 7)
                        until = now_ts + days * 86400
                        cur.execute(
                            f"UPDATE {SCHEMA}.users SET banned_until = %s, banned_reason = %s, "
                            f"banned_at = %s WHERE id = %s",
                            (until, f"Автоправило: {rname}", now_ts, uid),
                        )
                        cur.execute(
                            f"INSERT INTO {SCHEMA}.ban_history (user_id, until_ts, reason, by_admin, kind) "
                            f"VALUES (%s, %s, %s, %s, %s)",
                            (uid, until, f"Автоправило: {rname}", "автоматически", "ban"),
                        )
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.dev_notifications (kind, title, body, link_section) "
                        f"VALUES (%s, %s, %s, %s)",
                        ("report", f"Автоправило сработало: {rname}",
                         f"Пользователь ID {uid} — {detail}", "moderation"),
                    )
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.auto_rule_hits (rule_id, user_id, detail) "
                        f"VALUES (%s, %s, %s)",
                        (rid, uid, detail),
                    )
                    cur.execute(
                        f"UPDATE {SCHEMA}.auto_rules SET fired_count = fired_count + 1, "
                        f"last_fired_at = %s WHERE id = %s",
                        (now_ts, rid),
                    )
                    applied.append({"rule": rname, "user_id": uid, "detail": detail, "action": act})

            audit(cur, admin, "auto_rule_run", f"Проверка автоправил: {len(applied)} срабатываний", ip)
            return ok({"applied": applied, "count": len(applied), "checked": len(rules)})

        # ── Воронка: путь от регистрации до оплаты ───────────────────────
        if action == "funnel":
            days = int(body.get("days") or 30)
            since = int(time.time()) - days * 86400

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE created_at > %s", (since,))
            registered = int(cur.fetchone()[0] or 0)

            cur.execute(
                f"SELECT COUNT(DISTINCT u.id) FROM {SCHEMA}.users u "
                f"WHERE u.created_at > %s AND EXISTS ("
                f"  SELECT 1 FROM {SCHEMA}.messages m WHERE m.sender_id = u.id)",
                (since,),
            )
            wrote = int(cur.fetchone()[0] or 0)

            cur.execute(
                f"SELECT COUNT(DISTINCT u.id) FROM {SCHEMA}.users u "
                f"WHERE u.created_at > %s AND EXISTS ("
                f"  SELECT 1 FROM {SCHEMA}.messages m WHERE m.sender_id = u.id) "
                f"AND COALESCE(u.last_seen, 0) > u.created_at + 86400",
                (since,),
            )
            active = int(cur.fetchone()[0] or 0)

            cur.execute(
                f"SELECT COUNT(DISTINCT u.id) FROM {SCHEMA}.users u "
                f"WHERE u.created_at > %s AND COALESCE(u.pro_until, 0) > 0",
                (since,),
            )
            paid = int(cur.fetchone()[0] or 0)

            # Шаги идут по вложенности, поэтому каждый следующий не больше предыдущего
            wrote = min(wrote, registered)
            active = min(active, wrote)
            paid = min(paid, registered)

            steps = [
                {"key": "registered", "label": "Зарегистрировались", "value": registered},
                {"key": "wrote", "label": "Написали первое сообщение", "value": wrote},
                {"key": "active", "label": "Вернулись на следующий день", "value": active},
                {"key": "paid", "label": "Купили Premium", "value": paid},
            ]
            base = registered or 1
            for i, st in enumerate(steps):
                st["percent"] = round(st["value"] / base * 100)
                prev = steps[i - 1]["value"] if i else st["value"]
                st["drop"] = (0 if i == 0 or prev == 0
                              else max(0, round((prev - st["value"]) / prev * 100)))
            return ok({"steps": steps, "days": days})

        # ── Удержание: возвращаются ли люди ──────────────────────────────
        if action == "retention":
            now_ts = int(time.time())
            weeks = []
            for w in range(4, 0, -1):
                a, b = now_ts - w * 7 * 86400, now_ts - (w - 1) * 7 * 86400
                cur.execute(
                    f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE created_at BETWEEN %s AND %s",
                    (a, b),
                )
                total = int(cur.fetchone()[0] or 0)
                cur.execute(
                    f"SELECT COUNT(*) FROM {SCHEMA}.users "
                    f"WHERE created_at BETWEEN %s AND %s AND COALESCE(last_seen, 0) > %s",
                    (a, b, now_ts - 7 * 86400),
                )
                back = int(cur.fetchone()[0] or 0)
                weeks.append({
                    "label": f"{w} нед. назад" if w > 1 else "На прошлой неделе",
                    "total": total, "back": back,
                    "percent": 0 if total == 0 else round(back / total * 100),
                })

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE COALESCE(last_seen, 0) > %s",
                        (now_ts - 86400,))
            dau = int(cur.fetchone()[0] or 0)
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE COALESCE(last_seen, 0) > %s",
                        (now_ts - 30 * 86400,))
            mau = int(cur.fetchone()[0] or 0)
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users "
                        f"WHERE COALESCE(last_seen, 0) < %s AND COALESCE(last_seen, 0) > 0",
                        (now_ts - 30 * 86400,))
            sleeping = int(cur.fetchone()[0] or 0)

            return ok({
                "weeks": weeks, "dau": dau, "mau": mau, "sleeping": sleeping,
                "stickiness": 0 if mau == 0 else round(dau / mau * 100),
            })

        # ── Лента последних событий (как в дашборде на макете) ───────────
        if action == "live_feed":
            now_ts = int(time.time())
            feed = []

            cur.execute(
                f"SELECT id, name, created_at FROM {SCHEMA}.users "
                f"WHERE created_at > %s ORDER BY created_at DESC LIMIT 12",
                (now_ts - 3 * 86400,),
            )
            for r in cur.fetchall():
                feed.append({
                    "tag": "AUTH", "title": f"{r[1] or 'Без имени'} зарегистрировался",
                    "sub": f"ID {r[0]}", "ts": int(r[2]), "section": "users",
                    "user_id": r[0], "user_name": r[1] or f"ID {r[0]}",
                })

            cur.execute(
                f"SELECT m.id, u.name, m.created_at FROM {SCHEMA}.messages m "
                f"LEFT JOIN {SCHEMA}.users u ON u.id = m.sender_id "
                f"WHERE m.created_at > %s ORDER BY m.created_at DESC LIMIT 12",
                (now_ts - 86400,),
            )
            for r in cur.fetchall():
                feed.append({
                    "tag": "MESSAGE", "title": "Новое сообщение",
                    "sub": f"От: {r[1] or 'неизвестно'}", "ts": int(r[2]), "section": "chats",
                })

            cur.execute(
                f"SELECT r.id, u.name, r.reason, r.created_at FROM {SCHEMA}.reports r "
                f"LEFT JOIN {SCHEMA}.users u ON u.id = r.reported_user_id "
                f"ORDER BY r.created_at DESC LIMIT 8"
            )
            for r in cur.fetchall():
                feed.append({
                    "tag": "WARN", "title": f"Жалоба на {r[1] or 'пользователя'}",
                    "sub": (r[2] or "без причины")[:60], "ts": int(r[3]), "section": "reports",
                })

            cur.execute(
                f"SELECT id, amount, status, EXTRACT(epoch FROM created_at)::bigint "
                f"FROM {SCHEMA}.orders ORDER BY created_at DESC LIMIT 8"
            )
            for r in cur.fetchall():
                paid = r[2] in ("paid", "succeeded")
                feed.append({
                    "tag": "PAY" if paid else "ERROR",
                    "title": f"Оплата {float(r[1] or 0):.0f} ₽" if paid else "Платёж не прошёл",
                    "sub": f"Заказ №{r[0]}", "ts": int(r[3] or 0), "section": "payments",
                })

            cur.execute(
                f"SELECT admin_email, action, details, created_at FROM {SCHEMA}.dev_audit "
                f"ORDER BY created_at DESC LIMIT 10"
            )
            for r in cur.fetchall():
                feed.append({
                    "tag": "PANEL", "title": (r[2] or r[1])[:70],
                    "sub": r[0], "ts": int(r[3]), "section": "logs",
                })

            feed.sort(key=lambda x: x["ts"], reverse=True)
            return ok({"items": feed[:40]})

        # ── Состояние системы для нижней строки ───────────────────────────
        if action == "system_health":
            now_ts = int(time.time())
            t0 = time.time()
            cur.execute("SELECT 1")
            db_ms = round((time.time() - t0) * 1000)

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE last_seen > %s", (now_ts - 300,))
            online = int(cur.fetchone()[0] or 0)
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE created_at > %s", (now_ts - 60,))
            per_min = int(cur.fetchone()[0] or 0)
            cur.execute(f"SELECT pg_database_size(current_database())")
            db_size = int(cur.fetchone()[0] or 0)
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE created_at > %s", (now_ts - 86400,))
            msgs_24h = int(cur.fetchone()[0] or 0)

            return ok({
                "db_ms": db_ms,
                "online": online,
                "per_min": per_min,
                "db_size_mb": round(db_size / 1048576, 1),
                "msgs_24h": msgs_24h,
                "server_time": now_ts,
                "env": os.environ.get("APP_ENV", "PRODUCTION").upper(),
                "healthy": db_ms < 500,
            })

        # ── Мини-графики для карточек ─────────────────────────────────────
        if action == "spark":
            now_ts = int(time.time())
            out = {}
            for key, sql in (
                ("users", f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE created_at BETWEEN %s AND %s"),
                ("messages", f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE created_at BETWEEN %s AND %s"),
                ("online", f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE last_seen BETWEEN %s AND %s"),
            ):
                pts = []
                for i in range(11, -1, -1):
                    a, b = now_ts - (i + 1) * 7200, now_ts - i * 7200
                    cur.execute(sql, (a, b))
                    pts.append(int(cur.fetchone()[0] or 0))
                out[key] = pts
            return ok({"spark": out})

        # ── Сравнение с прошлой неделей ───────────────────────────────────
        if action == "trends":
            now_ts = int(time.time())
            week = 7 * 86400
            cur_from, prev_from = now_ts - week, now_ts - 2 * week

            def pair(sql_tpl, col):
                cur.execute(sql_tpl, (cur_from, now_ts))
                a = int(cur.fetchone()[0] or 0)
                cur.execute(sql_tpl, (prev_from, cur_from))
                b = int(cur.fetchone()[0] or 0)
                delta = None if b == 0 else round((a - b) / b * 100)
                return {"key": col, "now": a, "prev": b, "delta": delta}

            items = [
                pair(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE created_at BETWEEN %s AND %s", "users"),
                pair(f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE created_at BETWEEN %s AND %s", "messages"),
            ]
            cur.execute(
                f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.orders "
                f"WHERE status IN ('paid','succeeded') AND created_at > to_timestamp(%s)",
                (cur_from,),
            )
            rev_now = float(cur.fetchone()[0] or 0)
            cur.execute(
                f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.orders "
                f"WHERE status IN ('paid','succeeded') "
                f"AND created_at BETWEEN to_timestamp(%s) AND to_timestamp(%s)",
                (prev_from, cur_from),
            )
            rev_prev = float(cur.fetchone()[0] or 0)
            items.append({
                "key": "revenue", "now": rev_now, "prev": rev_prev,
                "delta": None if rev_prev == 0 else round((rev_now - rev_prev) / rev_prev * 100),
            })
            return ok({"items": items})

        # ── У кого заканчивается Premium ──────────────────────────────────
        if action == "expiring_soon":
            now_ts = int(time.time())
            cur.execute(
                f"SELECT id, name, COALESCE(phone, ''), COALESCE(avatar_url, ''), pro_until "
                f"FROM {SCHEMA}.users "
                f"WHERE COALESCE(pro_until, 0) > %s AND COALESCE(pro_until, 0) < %s "
                f"ORDER BY pro_until LIMIT 30",
                (now_ts, now_ts + 7 * 86400),
            )
            items = [{
                "id": r[0], "name": r[1], "phone": r[2], "avatar_url": r[3],
                "pro_until": int(r[4]),
                "days_left": max(0, (int(r[4]) - now_ts) // 86400),
            } for r in cur.fetchall()]
            return ok({"items": items, "count": len(items)})

        # ── Выгрузка базы пользователей ───────────────────────────────────
        if action == "users_export":
            now_ts = int(time.time())
            cur.execute(
                f"SELECT id, name, COALESCE(phone, ''), COALESCE(pro_until, 0), "
                f"COALESCE(wallet_balance, 0), COALESCE(verified, FALSE), "
                f"created_at, COALESCE(last_seen, 0), COALESCE(banned_until, 0), vk_id "
                f"FROM {SCHEMA}.users ORDER BY created_at DESC LIMIT 10000"
            )
            rows = [{
                "id": r[0], "name": r[1], "phone": r[2],
                "premium": "Да" if int(r[3] or 0) > now_ts else "Нет",
                "premium_until": int(r[3] or 0),
                "wallet": float(r[4] or 0),
                "verified": "Да" if r[5] else "Нет",
                "created_at": int(r[6] or 0),
                "last_seen": int(r[7] or 0),
                "banned": "Да" if int(r[8] or 0) > now_ts else "Нет",
                "vk": f"https://vk.com/id{r[9]}" if r[9] else "",
            } for r in cur.fetchall()]
            for x in rows:
                if str(x["phone"]).startswith("vk"):
                    x["phone"] = "без номера"
            audit(cur, admin, "users_export", f"Выгрузка базы: {len(rows)} строк", ip)
            return ok({"rows": rows, "count": len(rows)})

        # ── Массовые действия ─────────────────────────────────────────────
        if action == "bulk_action":
            ids = [int(x) for x in (body.get("ids") or []) if str(x).isdigit()][:200]
            what = (body.get("bulk") or "").strip()
            if not ids:
                return err("Не выбрано ни одного пользователя")
            now_ts = int(time.time())
            id_list = ",".join(str(i) for i in ids)

            cur.execute(
                f"SELECT id, COALESCE(banned_until, 0), COALESCE(pro_until, 0) "
                f"FROM {SCHEMA}.users WHERE id IN ({id_list})"
            )
            remember_undo(
                cur, admin, "bulk_action", f"Действие для {len(ids)} чел.",
                {"users": [{"id": r[0], "banned_until": int(r[1] or 0) or None,
                            "pro_until": int(r[2] or 0)} for r in cur.fetchall()]},
            )

            if what == "ban":
                days = int(body.get("days") or 7)
                until = now_ts + days * 86400
                reason = (body.get("reason") or "Нарушение правил")[:200]
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET banned_until = %s, banned_reason = %s, "
                    f"banned_at = %s WHERE id IN ({id_list})",
                    (until, reason, now_ts),
                )
                label = f"Блокировка на {days} дн."
            elif what == "unban":
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET banned_until = NULL, banned_reason = NULL "
                    f"WHERE id IN ({id_list})"
                )
                label = "Снятие блокировки"
            elif what == "premium":
                days = int(body.get("days") or 30)
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET pro_until = "
                    f"GREATEST(COALESCE(pro_until, 0), %s) + %s WHERE id IN ({id_list})",
                    (now_ts, days * 86400),
                )
                cur.execute(
                    f"INSERT INTO {SCHEMA}.user_notifications (user_id, kind, title, body) "
                    f"SELECT id, 'system', %s, %s FROM {SCHEMA}.users WHERE id IN ({id_list})",
                    (f"Premium продлён на {days} дн.",
                     (body.get("reason") or "Подарок от команды Nova")[:200]),
                )
                label = f"Продление Premium на {days} дн."
            elif what == "logout":
                cur.execute(f"DELETE FROM {SCHEMA}.user_sessions WHERE user_id IN ({id_list})")
                label = "Выход со всех устройств"
            else:
                return err("Неизвестное действие")

            audit(cur, admin, "bulk_action", f"{label} — {len(ids)} чел.", ip)
            return ok({"success": True, "affected": len(ids), "label": label})

        # ── Заготовки ответов поддержки ───────────────────────────────────
        if action == "canned_list":
            cur.execute(
                f"SELECT id, title, body FROM {SCHEMA}.canned_replies ORDER BY sort_order, id"
            )
            return ok({"items": [{"id": r[0], "title": r[1], "body": r[2]}
                                 for r in cur.fetchall()]})

        if action == "canned_save":
            rid = body.get("id")
            title = (body.get("title") or "").strip()
            text = (body.get("body") or "").strip()
            if not title or not text:
                return err("Заполните название и текст")
            if rid:
                cur.execute(
                    f"UPDATE {SCHEMA}.canned_replies SET title = %s, body = %s WHERE id = %s",
                    (title[:100], text[:2000], int(rid)),
                )
            else:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.canned_replies (title, body) VALUES (%s, %s)",
                    (title[:100], text[:2000]),
                )
            audit(cur, admin, "canned_save", f"Заготовка ответа: {title[:50]}", ip)
            return ok({"success": True})

        if action == "canned_delete":
            cur.execute(
                f"DELETE FROM {SCHEMA}.canned_replies WHERE id = %s",
                (int(body.get("id") or 0),),
            )
            return ok({"success": True})

        # ── Рассылка пользователям ────────────────────────────────────────
        if action in ("broadcast_preview", "broadcast_send"):
            audience = (body.get("audience") or "all").strip()
            now_ts = int(time.time())

            conds = [f"COALESCE(banned_until, 0) < {now_ts}"]
            if audience == "premium":
                conds.append(f"COALESCE(pro_until, 0) > {now_ts}")
            elif audience == "free":
                conds.append(f"COALESCE(pro_until, 0) <= {now_ts}")
            elif audience == "new_7d":
                conds.append(f"created_at > {now_ts - 7 * 86400}")
            elif audience == "inactive_30d":
                conds.append(f"COALESCE(last_seen, 0) < {now_ts - 30 * 86400}")
            elif audience == "expiring_7d":
                conds.append(
                    f"COALESCE(pro_until, 0) > {now_ts} "
                    f"AND COALESCE(pro_until, 0) < {now_ts + 7 * 86400}"
                )
            where_sql = "WHERE " + " AND ".join(conds)

            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users {where_sql}")
            total = int(cur.fetchone()[0] or 0)

            if action == "broadcast_preview":
                return ok({"count": total})

            title = (body.get("title") or "").strip()
            text = (body.get("body") or "").strip()
            if not title or not text:
                return err("Заполните заголовок и текст")
            if total == 0:
                return err("По выбранным условиям никого нет")

            cur.execute(
                f"INSERT INTO {SCHEMA}.user_notifications (user_id, kind, title, body) "
                f"SELECT id, 'system', %s, %s FROM {SCHEMA}.users {where_sql}",
                (title[:200], text[:1000]),
            )
            cur.execute(
                f"INSERT INTO {SCHEMA}.broadcasts "
                f"(title, body, audience, sent_count, admin_id, admin_email, created_at) "
                f"VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (title[:200], text[:1000], audience, total,
                 admin["id"], admin["email"], now_ts),
            )
            audit(cur, admin, "broadcast_send",
                  f"Рассылка «{title[:60]}» — {total} получателей ({audience})", ip)
            return ok({"success": True, "sent": total})

        if action == "broadcast_history":
            cur.execute(
                f"SELECT id, title, body, audience, sent_count, admin_email, created_at "
                f"FROM {SCHEMA}.broadcasts ORDER BY created_at DESC LIMIT 30"
            )
            items = [{
                "id": r[0], "title": r[1], "body": r[2], "audience": r[3],
                "sent": r[4], "admin": r[5], "created_at": r[6],
            } for r in cur.fetchall()]
            return ok({"items": items})

        # ── Автомодерация ─────────────────────────────────────────────────
        if action == "mod_rules":
            cur.execute(
                f"SELECT id, word, action, created_at FROM {SCHEMA}.moderation_rules "
                f"ORDER BY created_at DESC"
            )
            rules = [{"id": r[0], "word": r[1], "action": r[2], "created_at": r[3]}
                     for r in cur.fetchall()]
            cur.execute(
                f"SELECT key, value FROM {SCHEMA}.dev_settings "
                f"WHERE key IN ('moderation_enabled', 'antispam_enabled', 'antispam_max_per_min')"
            )
            cfg = {r[0]: r[1] for r in cur.fetchall()}
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.moderation_hits "
                f"WHERE created_at > {int(time.time()) - 86400}"
            )
            hits_24h = int(cur.fetchone()[0] or 0)
            return ok({
                "rules": rules,
                "settings": {
                    "moderation_enabled": cfg.get("moderation_enabled", "1") == "1",
                    "antispam_enabled": cfg.get("antispam_enabled", "1") == "1",
                    "antispam_max_per_min": int(cfg.get("antispam_max_per_min", "30") or 30),
                },
                "hits_24h": hits_24h,
            })

        if action == "mod_rule_add":
            word = (body.get("word") or "").strip().lower()
            act = (body.get("rule_action") or "block").strip()
            if len(word) < 2:
                return err("Слово должно быть не короче 2 символов")
            if act not in ("block", "flag"):
                act = "block"
            cur.execute(
                f"INSERT INTO {SCHEMA}.moderation_rules (word, action) VALUES (%s, %s) "
                f"ON CONFLICT (word) DO UPDATE SET action = EXCLUDED.action",
                (word[:100], act),
            )
            audit(cur, admin, "mod_rule_add", f"Добавлено стоп-слово: {word[:40]}", ip)
            return ok({"success": True})

        if action == "mod_rule_delete":
            rid = int(body.get("id") or 0)
            cur.execute(f"DELETE FROM {SCHEMA}.moderation_rules WHERE id = %s", (rid,))
            audit(cur, admin, "mod_rule_delete", f"Удалено стоп-слово #{rid}", ip)
            return ok({"success": True})

        if action == "mod_hits":
            cur.execute(
                f"SELECT h.id, h.user_id, COALESCE(u.name, ''), h.word, h.action, "
                f"COALESCE(h.snippet, ''), h.created_at "
                f"FROM {SCHEMA}.moderation_hits h "
                f"LEFT JOIN {SCHEMA}.users u ON u.id = h.user_id "
                f"ORDER BY h.created_at DESC LIMIT 60"
            )
            items = [{
                "id": r[0], "user_id": r[1], "user_name": r[2] or f"ID {r[1]}",
                "word": r[3], "action": r[4], "snippet": r[5], "created_at": r[6],
            } for r in cur.fetchall()]
            return ok({"items": items})

        if action == "mod_settings_save":
            now = int(time.time())
            vals = {
                "moderation_enabled": "1" if body.get("moderation_enabled") else "0",
                "antispam_enabled": "1" if body.get("antispam_enabled") else "0",
                "antispam_max_per_min": str(max(5, min(int(body.get("antispam_max_per_min") or 30), 300))),
            }
            for k, v in vals.items():
                cur.execute(
                    f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_at, updated_by) "
                    f"VALUES (%s, %s, %s, %s) ON CONFLICT (key) DO UPDATE "
                    f"SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at",
                    (k, v, now, admin["id"]),
                )
            audit(cur, admin, "mod_settings_save", "Изменены настройки автомодерации", ip)
            return ok({"success": True})

        # ── График доходов по дням ────────────────────────────────────────
        if action == "revenue_chart":
            days = min(int(body.get("days") or 30), 180)
            cur.execute(
                f"SELECT to_char(d.day, 'DD.MM') AS label, "
                f"COALESCE(SUM(o.amount), 0), COUNT(o.id) "
                f"FROM generate_series("
                f"  (CURRENT_DATE - INTERVAL '{days - 1} days'), CURRENT_DATE, INTERVAL '1 day'"
                f") AS d(day) "
                f"LEFT JOIN {SCHEMA}.orders o "
                f"  ON date_trunc('day', o.created_at) = d.day "
                f"  AND o.status IN ('paid', 'succeeded') "
                f"GROUP BY d.day ORDER BY d.day"
            )
            chart = [{"date": r[0], "sum": float(r[1] or 0), "count": int(r[2] or 0)}
                     for r in cur.fetchall()]
            best = max(chart, key=lambda x: x["sum"]) if chart else None
            total = sum(c["sum"] for c in chart)
            return ok({
                "chart": chart,
                "total": round(total, 2),
                "avg_per_day": round(total / max(len(chart), 1), 2),
                "best_day": best,
            })

        # ── Логи и события ────────────────────────────────────────────────
        if action == "errors":
            hours = max(1, min(int(body.get("hours") or 24), 24 * 7))
            since = int(time.time()) - hours * 3600
            cur.execute(
                f"SELECT source, action, kind, COUNT(*), MAX(created_at), "
                f"(ARRAY_AGG(message ORDER BY created_at DESC))[1], COUNT(DISTINCT user_id) "
                f"FROM {SCHEMA}.error_log WHERE created_at >= %s "
                f"GROUP BY source, action, kind ORDER BY COUNT(*) DESC LIMIT 100",
                (since,),
            )
            groups = [{"source": r[0], "action": r[1] or "", "kind": r[2], "count": int(r[3]), "last_at": int(r[4]),
                       "message": r[5] or "", "users": int(r[6] or 0)} for r in cur.fetchall()]
            cur.execute(
                f"SELECT feature, COUNT(*), COUNT(DISTINCT user_id), MAX(created_at) FROM {SCHEMA}.feature_events "
                f"WHERE created_at >= %s AND (feature LIKE 'e2e\\_%%' OR feature LIKE 'chat\\_crash%%') "
                f"GROUP BY feature ORDER BY COUNT(*) DESC LIMIT 50",
                (since,),
            )
            client = [{"code": r[0], "count": int(r[1]), "users": int(r[2] or 0), "last_at": int(r[3])} for r in cur.fetchall()]
            cur.execute(
                f"SELECT created_at / 3600 AS h, COUNT(*) FROM {SCHEMA}.error_log WHERE created_at >= %s GROUP BY h ORDER BY h",
                (since,),
            )
            hourly = [{"hour": int(r[0]) * 3600, "count": int(r[1])} for r in cur.fetchall()]
            return ok({"groups": groups, "client": client, "hourly": hourly, "total": sum(g["count"] for g in groups)})

        if action == "errors_clear":
            cur.execute(f"UPDATE {SCHEMA}.error_log SET created_at = 0 WHERE created_at > 0")
            audit(cur, admin, "errors_clear", "Журнал ошибок очищен", ip)
            return ok({"success": True})

        if action == "logs":
            limit = min(int(body.get("limit") or 100), 300)
            cur.execute(
                f"SELECT id, admin_email, action, details, ip_addr, created_at FROM {SCHEMA}.dev_audit "
                f"ORDER BY created_at DESC LIMIT %s",
                (limit,),
            )
            audit_rows = [{
                "id": r[0], "source": "panel", "who": r[1], "action": r[2],
                "details": r[3], "ip": r[4], "ts": r[5],
            } for r in cur.fetchall()]

            cur.execute(
                f"SELECT u.id, u.name, u.created_at FROM {SCHEMA}.users u "
                f"ORDER BY u.created_at DESC LIMIT 20"
            )
            signups = [{
                "id": f"u{r[0]}", "source": "app", "who": r[1] or f"ID {r[0]}",
                "action": "signup", "details": "Новая регистрация", "ip": "", "ts": r[2],
            } for r in cur.fetchall()]

            events = sorted(audit_rows + signups, key=lambda x: x["ts"] or 0, reverse=True)[:limit]
            return ok({"events": events})

        # ── Поддержка ─────────────────────────────────────────────────────
        if action == "support_tickets":
            cur.execute(
                f"SELECT t.id, t.user_id, u.name, t.subject, t.status, t.created_at "
                f"FROM {SCHEMA}.support_tickets t LEFT JOIN {SCHEMA}.users u ON u.id = t.user_id "
                f"ORDER BY t.created_at DESC LIMIT 100"
            )
            tickets = [{
                "id": r[0], "user_id": r[1], "user_name": r[2] or f"ID {r[1]}",
                "subject": r[3], "status": r[4], "created_at": r[5],
            } for r in cur.fetchall()]
            return ok({"tickets": tickets})

        if action == "support_messages":
            tid = int(body.get("ticket_id") or 0)
            cur.execute(
                f"SELECT id, ticket_id, is_admin, text, created_at FROM {SCHEMA}.support_messages "
                f"WHERE ticket_id = %s ORDER BY created_at ASC",
                (tid,),
            )
            msgs = [{"id": r[0], "ticket_id": r[1], "sender": "admin" if r[2] else "user",
                     "text": r[3], "created_at": r[4]}
                    for r in cur.fetchall()]
            return ok({"messages": msgs})

        if action == "support_reply":
            tid = int(body.get("ticket_id") or 0)
            text = (body.get("text") or "").strip()
            if not text:
                return err("Пустой ответ")
            cur.execute(f"SELECT user_id, subject FROM {SCHEMA}.support_tickets WHERE id = %s", (tid,))
            trow = cur.fetchone()
            if not trow:
                return err("Обращение не найдено", 404)
            now = int(time.time())
            cur.execute(
                f"INSERT INTO {SCHEMA}.support_messages (ticket_id, sender_id, is_admin, text, created_at) "
                f"VALUES (%s, NULL, true, %s, %s)",
                (tid, text[:4000], now),
            )
            cur.execute(
                f"UPDATE {SCHEMA}.support_tickets SET last_message_at = %s, unread_for_user = unread_for_user + 1, "
                f"unread_for_admin = 0, status = 'open', closed_at = NULL WHERE id = %s",
                (now, tid),
            )
            delivered = False
            try:
                subj = (trow[1] or "").strip()
                head = f"Поддержка Nova ответила на обращение #{tid}" + (f" «{subj[:60]}»" if subj else "")
                delivered = send_from_nova(cur, int(trow[0]), f"{head}:\n\n{text}\n\nОтветить можно в Настройки → Поддержка.") is not None
            except Exception as e:
                print(f"[support_reply] deliver: {e}")
            audit(cur, admin, "support_reply", f"Ответ в обращение #{tid}", ip)
            return ok({"success": True, "delivered": delivered})

        if action == "support_close":
            tid = int(body.get("ticket_id") or 0)
            cur.execute(
                f"UPDATE {SCHEMA}.support_tickets SET status = 'closed', closed_at = %s WHERE id = %s",
                (int(time.time()), tid),
            )
            audit(cur, admin, "support_close", f"Закрыто обращение #{tid}", ip)
            return ok({"success": True})

        # ── Статус сервисов ───────────────────────────────────────────────
        if action == "services":
            services = []
            t0 = time.time()
            cur.execute("SELECT 1")
            cur.fetchone()
            db_ms = int((time.time() - t0) * 1000)
            services.append({"name": "База данных", "status": "up", "latency_ms": db_ms,
                             "detail": "PostgreSQL отвечает"})

            checks = [
                ("Хранилище файлов", bool(os.environ.get("AWS_ACCESS_KEY_ID"))),
                ("Push-уведомления", bool(os.environ.get("VAPID_PRIVATE_KEY"))),
                ("SMS-сервис", bool(os.environ.get("SMSC_LOGIN"))),
                ("TURN для звонков", bool(os.environ.get("TURN_HOST"))),
            ]
            for name, configured in checks:
                services.append({
                    "name": name,
                    "status": "up" if configured else "off",
                    "latency_ms": None,
                    "detail": "Настроено и работает" if configured else "Не настроено",
                })

            now = int(time.time())
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE created_at > %s", (now - 3600,))
            load_hour = cur.fetchone()[0]
            return ok({"services": services, "load_last_hour": load_hour, "checked_at": now})

        # ── Приглашения ───────────────────────────────────────────────────
        if action == "invites":
            cur.execute(
                f"SELECT i.code, i.created_at, i.used_by, i.used_at, i.note, a.email, i.role "
                f"FROM {SCHEMA}.dev_invites i LEFT JOIN {SCHEMA}.dev_admins a ON a.id = i.used_by "
                f"ORDER BY i.created_at DESC LIMIT 50"
            )
            invites = [{
                "code": r[0], "created_at": r[1], "used_by": r[2],
                "used_at": r[3], "note": r[4], "used_email": r[5],
                "role": r[6], "role_label": ROLES.get(r[6] or "", {}).get("label", ""),
            } for r in cur.fetchall()]
            return ok({"invites": invites})

        if action == "create_invite":
            note = (body.get("note") or "").strip()
            role = (body.get("role") or "moderator").strip()
            if role not in ROLES or role == "owner":
                role = "moderator"
            code = "NOVA-" + secrets.token_hex(4).upper()
            cur.execute(
                f"INSERT INTO {SCHEMA}.dev_invites (code, created_by, note, role) VALUES (%s, %s, %s, %s)",
                (code, admin["id"], note, role),
            )
            audit(cur, admin, "create_invite", f"Создан код {code} ({ROLES[role]['label']})", ip)
            return ok({"code": code, "role": role})

        return err(f"Неизвестное действие: {action}")
    finally:
        cur.close()
        conn.close()