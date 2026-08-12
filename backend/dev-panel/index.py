import os
import json
import time
import hashlib
import secrets
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
                f"SELECT id, email, name, role, password_hash, disabled, title, avatar_url "
                f"FROM {SCHEMA}.dev_admins WHERE email = %s",
                (email,),
            )
            row = cur.fetchone()
            if not row or not verify_password(password, row[4]):
                return err("Неверная почта или пароль", 401)
            if row[5]:
                return err("Доступ заблокирован", 403)

            now = int(time.time())
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
            return ok({"token": token, "admin": cur_admin})

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
                    (str(key)[:50], str(value)[:200], now, admin["id"]),
                )
            audit(cur, admin, "settings_save", "Изменены настройки панели", ip)
            return ok({"success": True})

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