import os
import json
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

PUBLIC_ACTIONS = {"login", "register", "check_setup", "panel_info"}

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
    "delete_user", "delete_chat", "bulk_action", "team_update", "team_remove",
    "wallet_set", "payment_refund", "settings_save", "broadcast_send",
    "channel_delete", "create_invite",
}

ACTION_PERMS = {
    "dashboard": "dashboard",
    "users": "users", "user_detail": "users", "user_devices": "users",
    "ban_user": "user_write", "force_logout": "user_write", "delete_user": "user_write",
    "rename_user": "user_write",
    "topup_wallet": "wallet",
    "user_chats": "chats", "chat_messages": "chats", "delete_message": "chats",
    "delete_chat": "chats", "export_chat": "chats",
    "media_list": "media", "delete_media": "media",
    "reports": "reports", "report_resolve": "reports",
    "support_tickets": "support", "support_messages": "support",
    "support_reply": "support", "support_close": "support",
    "logs": "logs",
    "services": "services", "invites": "services", "create_invite": "services",
    "channels": "channels", "channel_update": "channels", "channel_delete": "channels",
    "team": "team", "team_update": "team", "team_remove": "team",
    "settings_get": "dashboard", "settings_save": "settings",
    "change_password": "dashboard", "change_email": "dashboard",
    "update_me": "dashboard",
    "verifications": "reports", "verify_decide": "reports", "set_verified": "reports",
    "set_channel_verified": "channels",
    "notifications": "dashboard", "notifications_read": "dashboard",
    "moderation_summary": "dashboard",
    "plans": "dashboard", "plan_save": "settings", "plan_delete": "settings",
    "broadcast_send": "settings", "broadcast_history": "dashboard",
    "broadcast_preview": "settings",
    "mod_rules": "dashboard", "mod_rule_add": "settings", "mod_rule_delete": "settings",
    "mod_hits": "dashboard", "mod_settings_save": "settings",
    "revenue_chart": "dashboard",
    "payments": "dashboard", "payments_summary": "dashboard",
    "payments_export": "dashboard",
    "user_billing": "users", "wallet_set": "settings",
    "twofa_get": "dashboard", "twofa_save": "dashboard",
    "trends": "dashboard", "expiring_soon": "dashboard",
    "live_feed": "dashboard", "system_health": "dashboard", "spark": "dashboard",
    "funnel": "dashboard", "retention": "dashboard",
    "auto_rules": "dashboard", "auto_rule_save": "settings", "auto_rule_delete": "settings",
    "auto_rule_run": "settings", "auto_rule_hits": "dashboard",
    "global_search": "users", "filters_list": "users", "filter_save": "users",
    "filter_delete": "users", "users_filtered": "users",
    "undo_list": "dashboard", "undo_apply": "user_write",
    "backup_export": "settings", "user_full": "users",
    "tg_get": "settings", "tg_save": "settings", "tg_test": "settings",
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
        with urlopen(req, timeout=4) as r:
            return json.loads(r.read()).get("ok", False)
    except Exception:
        return False


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


def handler(event: dict, context) -> dict:
    """Nova Dev Panel — вход по коду-приглашению, статистика, пользователи, логи, поддержка."""
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
            if need and not has_perm(admin, need):
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

        # ── Регистрация по коду-приглашению ──────────────────────────────
        if action == "register":
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""
            name = (body.get("name") or "").strip()
            code = (body.get("invite_code") or "").strip().upper()

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
            if row[8] and row[9]:
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
                f"INSERT INTO {SCHEMA}.dev_notifications (kind, title, body, link_section) "
                f"VALUES (%s, %s, %s, %s)",
                ("login", f"Вход в панель: {cur_admin['name'] or cur_admin['email']}",
                 f"{cur_admin['role_label']} · {device} · IP {ip} · {when}", "logs"),
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
                    f"SELECT id, name, phone, created_at, last_seen, avatar_url, COALESCE(verified, FALSE) "
                    f"FROM {SCHEMA}.users "
                    f"WHERE name ILIKE %s OR phone ILIKE %s ORDER BY last_seen DESC NULLS LAST LIMIT %s OFFSET %s",
                    (like, like, limit, offset),
                )
            else:
                cur.execute(
                    f"SELECT id, name, phone, created_at, last_seen, avatar_url, COALESCE(verified, FALSE) "
                    f"FROM {SCHEMA}.users "
                    f"ORDER BY last_seen DESC NULLS LAST LIMIT %s OFFSET %s",
                    (limit, offset),
                )
            rows = cur.fetchall()
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
            total = cur.fetchone()[0]

            now = int(time.time())
            users = [{
                "id": r[0], "name": r[1], "phone": r[2],
                "created_at": r[3], "last_seen": r[4], "avatar_url": r[5],
                "verified": bool(r[6]) if len(r) > 6 else False,
                "online": bool(r[4] and r[4] > now - 60),
            } for r in rows]
            return ok({"users": users, "total": total})

        if action == "user_detail":
            uid = int(body.get("user_id") or 0)
            cur.execute(
                f"SELECT id, name, phone, created_at, last_seen, avatar_url, about, banned_until, banned_reason, "
                f"COALESCE(wallet_balance, 0), COALESCE(verified, FALSE) FROM {SCHEMA}.users WHERE id = %s",
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
                f"UPDATE {SCHEMA}.users SET name = %s, phone = %s, avatar_url = NULL, about = NULL, "
                f"banned_until = %s, banned_reason = %s, banned_at = %s, last_seen = 0 WHERE id = %s",
                ("Удалённый аккаунт", f"deleted_{uid}_{now}", now + 3650 * 86400,
                 "Аккаунт удалён администратором", now, uid),
            )
            cur.execute(f"UPDATE {SCHEMA}.messages SET removed_at = %s WHERE sender_id = %s", (now, uid))
            cur.execute(f"DELETE FROM {SCHEMA}.push_subscriptions WHERE user_id = %s", (uid,))
            audit(cur, admin, "delete_user", f"Удалён аккаунт ID {uid} ({row[0]}, {row[1]})", ip)
            return ok({"success": True})

        # ── Каналы и группы ───────────────────────────────────────────────
        if action == "channels":
            cur.execute(
                f"SELECT g.id, g.name, g.description, g.avatar_url, g.is_channel, g.owner_id, "
                f"u.name, g.created_at, g.last_message_at, g.invite_link, "
                f"(SELECT COUNT(*) FROM {SCHEMA}.group_members m WHERE m.group_id = g.id), "
                f"(SELECT COUNT(*) FROM {SCHEMA}.group_messages gm WHERE gm.group_id = g.id), "
                f"COALESCE(g.verified, FALSE) "
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
            } for r in cur.fetchall()]
            return ok({"channels": channels})

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
            for r in cur.fetchall():
                read = me in (r[5] or "").split(",")
                if not read:
                    unread += 1
                items.append({
                    "id": r[0], "kind": r[1], "title": r[2], "body": r[3],
                    "section": r[4], "read": read, "created_at": r[6],
                })
            return ok({"items": items, "unread": unread})

        if action == "notifications_read":
            me = str(admin["id"])
            cur.execute(
                f"UPDATE {SCHEMA}.dev_notifications "
                f"SET read_by = CASE WHEN read_by = '' THEN %s ELSE read_by || ',' || %s END "
                f"WHERE POSITION(%s IN read_by) = 0",
                (me, me, me),
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
            sms_ready = bool(os.environ.get("SMSC_LOGIN") and os.environ.get("SMSC_PASSWORD"))
            return ok({"enabled": bool(r[0]), "phone": r[1], "sms_ready": sms_ready})

        if action == "twofa_save":
            enabled = bool(body.get("enabled"))
            phone = "".join(c for c in str(body.get("phone") or "") if c.isdigit())
            if enabled:
                if len(phone) < 11:
                    return err("Укажите номер телефона полностью, например 79991234567")
                if not (os.environ.get("SMSC_LOGIN") and os.environ.get("SMSC_PASSWORD")):
                    return err("SMS не настроены. Добавьте доступы SMSC в секреты проекта.")
            cur.execute(
                f"UPDATE {SCHEMA}.dev_admins SET twofa_enabled = %s, phone = %s WHERE id = %s",
                (enabled, phone[:20], admin["id"]),
            )
            audit(cur, admin, "twofa_save",
                  "Включена защита входа кодом" if enabled else "Отключена защита входа", ip)
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
                pairs["tg_bot_token"] = (body.get("token") or "").strip()
            if body.get("chat_id") is not None:
                pairs["tg_chat_id"] = (body.get("chat_id") or "").strip()
            if body.get("events") is not None:
                pairs["tg_events"] = ",".join(body.get("events") or [])
            pairs["tg_enabled"] = "1" if body.get("enabled") else "0"

            for k, v in pairs.items():
                cur.execute(
                    f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_by) "
                    f"VALUES (%s, %s, %s) ON CONFLICT (key) DO UPDATE "
                    f"SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by",
                    (k, v, admin["email"]),
                )
            audit(cur, admin, "tg_save", "Настроены уведомления в Telegram", ip)
            return ok({"success": True})

        if action == "tg_test":
            cur.execute(
                f"SELECT key, value FROM {SCHEMA}.dev_settings "
                f"WHERE key IN ('tg_bot_token', 'tg_chat_id')"
            )
            st = {r[0]: r[1] for r in cur.fetchall()}
            token, chat = st.get("tg_bot_token"), st.get("tg_chat_id")
            if not token or not chat:
                return err("Сначала укажите ключ бота и получателя")
            sent = _tg_send(token, chat,
                            "Проверка связи\n\nУведомления Nova настроены — сообщения будут приходить сюда.")
            if not sent:
                return err("Не удалось отправить. Проверьте ключ бота и что вы написали ему первым")
            return ok({"success": True})

        # ── Карточка пользователя целиком ─────────────────────────────────
        if action == "user_full":
            uid = int(body.get("user_id") or 0)
            now_ts = int(time.time())

            cur.execute(
                f"SELECT id, name, COALESCE(phone, ''), created_at, COALESCE(last_seen, 0), "
                f"COALESCE(avatar_url, ''), COALESCE(about, ''), COALESCE(banned_until, 0), "
                f"COALESCE(banned_reason, ''), COALESCE(wallet_balance, 0), "
                f"COALESCE(verified, FALSE), COALESCE(pro_until, 0) "
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
                f"OR CAST(id AS TEXT) = %s LIMIT 8",
                (like, like, digits or "0"),
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
            where, params = ["1=1"], []

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

            sql = (f"SELECT id, name, COALESCE(phone, ''), created_at, last_seen, "
                   f"COALESCE(avatar_url, ''), COALESCE(verified, FALSE), "
                   f"COALESCE(pro_until, 0), COALESCE(banned_until, 0) "
                   f"FROM {SCHEMA}.users WHERE " + " AND ".join(where) +
                   " ORDER BY created_at DESC LIMIT 200")
            cur.execute(sql, tuple(params))
            users = [{
                "id": r[0], "name": r[1], "phone": r[2], "created_at": r[3],
                "last_seen": r[4], "avatar_url": r[5], "verified": bool(r[6]),
                "online": bool(r[4] and r[4] > now_ts - 300),
                "premium": int(r[7] or 0) > now_ts,
                "banned": int(r[8] or 0) > now_ts,
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
                f"created_at, COALESCE(last_seen, 0), COALESCE(banned_until, 0) "
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
            } for r in cur.fetchall()]
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
            cur.execute(
                f"INSERT INTO {SCHEMA}.support_messages (ticket_id, sender_id, is_admin, text) "
                f"VALUES (%s, NULL, true, %s)",
                (tid, text),
            )
            audit(cur, admin, "support_reply", f"Ответ в обращение #{tid}", ip)
            return ok({"success": True})

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