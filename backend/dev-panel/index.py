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

PUBLIC_ACTIONS = {"login", "register", "check_setup"}


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
        f"SELECT a.id, a.email, a.name, a.role FROM {SCHEMA}.dev_sessions s "
        f"JOIN {SCHEMA}.dev_admins a ON a.id = s.admin_id "
        f"WHERE s.token = %s AND s.expires_at > %s AND a.disabled = false",
        (token, now),
    )
    row = cur.fetchone()
    if not row:
        return None
    cur.execute(f"UPDATE {SCHEMA}.dev_sessions SET expires_at = %s WHERE token = %s", (now + SESSION_TTL, token))
    return {"id": row[0], "email": row[1], "name": row[2], "role": row[3]}


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

            cur.execute(f"SELECT code, used_by FROM {SCHEMA}.dev_invites WHERE code = %s", (code,))
            inv = cur.fetchone()
            if not inv:
                return err("Код-приглашение не найден")
            if inv[1]:
                return err("Этот код уже использован")

            cur.execute(f"SELECT id FROM {SCHEMA}.dev_admins WHERE email = %s", (email,))
            if cur.fetchone():
                return err("Аккаунт с такой почтой уже существует")

            cur.execute(
                f"INSERT INTO {SCHEMA}.dev_admins (email, password_hash, name, role) "
                f"VALUES (%s, %s, %s, %s) RETURNING id",
                (email, hash_password(password), name or email.split("@")[0], "owner"),
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
            new_admin = {"id": admin_id, "email": email, "name": name, "role": "owner"}
            audit(cur, new_admin, "register", f"Регистрация по коду {code}", ip)
            return ok({"token": token, "admin": new_admin})

        # ── Вход ──────────────────────────────────────────────────────────
        if action == "login":
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""

            cur.execute(
                f"SELECT id, email, name, role, password_hash, disabled FROM {SCHEMA}.dev_admins WHERE email = %s",
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
            cur_admin = {"id": row[0], "email": row[1], "name": row[2], "role": row[3]}
            audit(cur, cur_admin, "login", "Вход в панель", ip)
            return ok({"token": token, "admin": cur_admin})

        if action == "check_setup":
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.dev_admins")
            return ok({"has_admins": cur.fetchone()[0] > 0})

        if action == "me":
            return ok({"admin": admin})

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
                "content": {"chats": total_chats, "groups": total_groups, "stories": active_stories, "calls_24h": calls_24h},
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
                    f"SELECT id, name, phone, created_at, last_seen, avatar_url FROM {SCHEMA}.users "
                    f"WHERE name ILIKE %s OR phone ILIKE %s ORDER BY last_seen DESC NULLS LAST LIMIT %s OFFSET %s",
                    (like, like, limit, offset),
                )
            else:
                cur.execute(
                    f"SELECT id, name, phone, created_at, last_seen, avatar_url FROM {SCHEMA}.users "
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
                "online": bool(r[4] and r[4] > now - 300),
            } for r in rows]
            return ok({"users": users, "total": total})

        if action == "user_detail":
            uid = int(body.get("user_id") or 0)
            cur.execute(
                f"SELECT id, name, phone, created_at, last_seen, avatar_url, about, banned_until, banned_reason "
                f"FROM {SCHEMA}.users WHERE id = %s",
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
                "banned_until": r[7], "banned_reason": r[8],
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
            else:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET banned_until = NULL, banned_reason = NULL WHERE id = %s",
                    (uid,),
                )
                audit(cur, admin, "unban_user", f"Разблокировка ID {uid}", ip)
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
                f"SELECT i.code, i.created_at, i.used_by, i.used_at, i.note, a.email "
                f"FROM {SCHEMA}.dev_invites i LEFT JOIN {SCHEMA}.dev_admins a ON a.id = i.used_by "
                f"ORDER BY i.created_at DESC LIMIT 50"
            )
            invites = [{
                "code": r[0], "created_at": r[1], "used_by": r[2],
                "used_at": r[3], "note": r[4], "used_email": r[5],
            } for r in cur.fetchall()]
            return ok({"invites": invites})

        if action == "create_invite":
            note = (body.get("note") or "").strip()
            code = "NOVA-" + secrets.token_hex(4).upper()
            cur.execute(
                f"INSERT INTO {SCHEMA}.dev_invites (code, created_by, note) VALUES (%s, %s, %s)",
                (code, admin["id"], note),
            )
            audit(cur, admin, "create_invite", f"Создан код {code}", ip)
            return ok({"code": code})

        return err(f"Неизвестное действие: {action}")
    finally:
        cur.close()
        conn.close()