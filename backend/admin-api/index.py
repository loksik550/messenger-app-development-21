import os
import json
import time
import urllib.request
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67547116_messenger_app_develo")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
}


def get_conn():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    return conn


def ok(data):
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(data, ensure_ascii=False)}


def err(msg, code=400):
    return {"statusCode": code, "headers": CORS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def check_auth(event):
    token = event.get("headers", {}).get("X-Admin-Token", "")
    password = os.environ.get("ADMIN_PASSWORD", "")
    return token == password and password != ""


def handler(event: dict, context) -> dict:
    """Панель администратора Nova — статистика, пользователи, управление."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if not check_auth(event):
        return err("Нет доступа", 403)

    body = json.loads(event.get("body") or "{}")
    params = event.get("queryStringParameters") or {}
    action = body.get("action") or params.get("action", "")

    conn = get_conn()
    cur = conn.cursor()

    # ── stats — общая статистика и нагрузка ──────────────────────────────────
    if action == "stats":
        now = int(time.time())

        # Пользователи
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
        total_users = cur.fetchone()[0]

        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE last_seen > %s", (now - 300,))
        online_users = cur.fetchone()[0]

        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE created_at > %s", (now - 86400,))
        new_users_24h = cur.fetchone()[0]

        # Сообщения
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages")
        total_messages = cur.fetchone()[0]

        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE created_at > %s", (now - 3600,))
        messages_1h = cur.fetchone()[0]

        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE created_at > %s", (now - 86400,))
        messages_24h = cur.fetchone()[0]

        # Чаты
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.chats")
        total_chats = cur.fetchone()[0]

        # Push подписки
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.push_subscriptions")
        push_subs = cur.fetchone()[0]

        # Сигналы звонков за последний час
        cur.execute(f"SELECT COUNT(DISTINCT call_id) FROM {SCHEMA}.call_signals WHERE created_at > %s", (now - 3600,))
        calls_1h = cur.fetchone()[0]

        # Нагрузка: сообщений в минуту за последние 5 минут
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE created_at > %s", (now - 300,))
        msg_5min = cur.fetchone()[0]
        msg_per_min = round(msg_5min / 5, 1)

        # DAU / WAU / MAU — уникальные пользователи активные за период (по last_seen)
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE last_seen > %s", (now - 86400,))
        dau = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE last_seen > %s", (now - 86400 * 7,))
        wau = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE last_seen > %s", (now - 86400 * 30,))
        mau = cur.fetchone()[0]
        # Stickiness DAU/MAU
        stickiness = round((dau / mau * 100), 1) if mau > 0 else 0

        conn.close()

        # Оценка нагрузки
        if msg_per_min > 10:
            load_level = "high"
            load_tip = "Высокая нагрузка. Рассмотри кэширование запросов и индексы БД."
        elif msg_per_min > 3:
            load_level = "medium"
            load_tip = "Умеренная нагрузка. Всё работает хорошо."
        else:
            load_level = "low"
            load_tip = "Низкая нагрузка. Сервер работает спокойно."

        return ok({
            "users": {
                "total": total_users,
                "online": online_users,
                "new_24h": new_users_24h,
                "dau": dau,
                "wau": wau,
                "mau": mau,
                "stickiness": stickiness,
            },
            "messages": {
                "total": total_messages,
                "last_1h": messages_1h,
                "last_24h": messages_24h,
                "per_min": msg_per_min,
            },
            "chats": total_chats,
            "push_subs": push_subs,
            "calls_1h": calls_1h,
            "load": {
                "level": load_level,
                "tip": load_tip,
                "msg_per_min": msg_per_min,
            },
            "timestamp": now,
        })

    # ── activity_chart — данные для графика DAU и сообщений за N дней ────────
    if action == "activity_chart":
        days = max(1, min(int(body.get("days") or params.get("days") or 30), 90))
        now = int(time.time())
        # Группируем по UTC-дате, считаем уникальных активных юзеров и сообщения
        cur.execute(
            f"""SELECT to_char(to_timestamp(last_seen), 'YYYY-MM-DD') AS d,
                       COUNT(DISTINCT id)::int AS active
                FROM {SCHEMA}.users
                WHERE last_seen > %s
                GROUP BY d
                ORDER BY d ASC""",
            (now - days * 86400,)
        )
        active_by_day = {r[0]: r[1] for r in cur.fetchall()}
        cur.execute(
            f"""SELECT to_char(to_timestamp(created_at), 'YYYY-MM-DD') AS d,
                       COUNT(*)::int AS cnt
                FROM {SCHEMA}.messages
                WHERE created_at > %s
                GROUP BY d
                ORDER BY d ASC""",
            (now - days * 86400,)
        )
        messages_by_day = {r[0]: r[1] for r in cur.fetchall()}
        cur.execute(
            f"""SELECT to_char(to_timestamp(created_at), 'YYYY-MM-DD') AS d,
                       COUNT(*)::int AS cnt
                FROM {SCHEMA}.users
                WHERE created_at > %s
                GROUP BY d
                ORDER BY d ASC""",
            (now - days * 86400,)
        )
        new_by_day = {r[0]: r[1] for r in cur.fetchall()}
        conn.close()
        # Заполняем пропуски нулями
        from datetime import datetime, timedelta, timezone
        out = []
        today = datetime.now(timezone.utc).date()
        for i in range(days - 1, -1, -1):
            d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
            out.append({
                "date": d,
                "active": active_by_day.get(d, 0),
                "messages": messages_by_day.get(d, 0),
                "new_users": new_by_day.get(d, 0),
            })
        return ok({"days": out})

    # ── users — список пользователей ─────────────────────────────────────────
    if action == "users":
        limit = int(body.get("limit") or params.get("limit") or 50)
        offset = int(body.get("offset") or params.get("offset") or 0)
        search = (body.get("search") or params.get("search") or "").strip()

        if search:
            cur.execute(
                f"""SELECT id, phone, name, avatar_url, last_seen, created_at
                    FROM {SCHEMA}.users
                    WHERE name ILIKE %s OR phone LIKE %s
                    ORDER BY created_at DESC LIMIT %s OFFSET %s""",
                (f"%{search}%", f"%{search}%", limit, offset)
            )
        else:
            cur.execute(
                f"""SELECT id, phone, name, avatar_url, last_seen, created_at
                    FROM {SCHEMA}.users
                    ORDER BY created_at DESC LIMIT %s OFFSET %s""",
                (limit, offset)
            )
        rows = cur.fetchall()

        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users" + (f" WHERE name ILIKE %s OR phone LIKE %s" if search else ""),
                    *([( f"%{search}%", f"%{search}%")] if search else []))
        total = cur.fetchone()[0]
        conn.close()

        now = int(time.time())
        users = [{
            "id": r[0],
            "phone": r[1],
            "name": r[2],
            "avatar_url": r[3],
            "last_seen": r[4],
            "created_at": r[5],
            "online": (now - (r[4] or 0)) < 300,
        } for r in rows]
        return ok({"users": users, "total": total})

    # ── update_user — редактирование пользователя ─────────────────────────────
    if action == "update_user":
        user_id = body.get("user_id")
        new_name = (body.get("name") or "").strip()
        if not user_id or not new_name:
            conn.close()
            return err("Нужен user_id и name")
        cur.execute(
            f"UPDATE {SCHEMA}.users SET name = %s WHERE id = %s RETURNING id, phone, name, last_seen, created_at",
            (new_name, int(user_id))
        )
        row = cur.fetchone()
        conn.close()
        if not row:
            return err("Пользователь не найден", 404)
        return ok({"user": {"id": row[0], "phone": row[1], "name": row[2], "last_seen": row[3], "created_at": row[4]}})

    # ── delete_user — удаление пользователя ──────────────────────────────────
    if action == "delete_user":
        user_id = body.get("user_id")
        if not user_id:
            conn.close()
            return err("Нужен user_id")
        uid = int(user_id)
        # Каскадное удаление всех связанных данных, чтобы FK не ломали удаление.
        # Порядок важен: сначала реакции на сообщения (в т.ч. в чатах пользователя),
        # затем сами сообщения, только потом чаты и сам пользователь.
        safe_queries = [
            f"DELETE FROM {SCHEMA}.message_reactions WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.message_reactions WHERE message_id IN (SELECT id FROM {SCHEMA}.messages WHERE sender_id = %s)",
            f"DELETE FROM {SCHEMA}.message_reactions WHERE message_id IN (SELECT m.id FROM {SCHEMA}.messages m JOIN {SCHEMA}.chats c ON m.chat_id = c.id WHERE c.user1_id = %s OR c.user2_id = %s)",
            f"DELETE FROM {SCHEMA}.favorite_messages WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.typing_status WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.call_signals WHERE from_user_id = %s OR to_user_id = %s",
            f"DELETE FROM {SCHEMA}.user_blocks WHERE user_id = %s OR blocked_id = %s",
            f"DELETE FROM {SCHEMA}.chat_settings WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.messages WHERE chat_id IN (SELECT id FROM {SCHEMA}.chats WHERE user1_id = %s OR user2_id = %s)",
            f"DELETE FROM {SCHEMA}.messages WHERE sender_id = %s",
            f"DELETE FROM {SCHEMA}.chats WHERE user1_id = %s OR user2_id = %s",
            f"DELETE FROM {SCHEMA}.push_subscriptions WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.contacts WHERE user_id = %s OR contact_id = %s",
            f"DELETE FROM {SCHEMA}.pending_contacts WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.close_friends WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.message_drafts WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.saved_notes WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.scheduled_messages WHERE sender_id = %s",
            # Группы: реакции/просмотры/сообщения/участники, затем свои группы
            f"DELETE FROM {SCHEMA}.group_message_reactions WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.group_message_views WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.group_message_reactions WHERE message_id IN (SELECT id FROM {SCHEMA}.group_messages WHERE sender_id = %s)",
            f"DELETE FROM {SCHEMA}.group_message_views WHERE message_id IN (SELECT id FROM {SCHEMA}.group_messages WHERE sender_id = %s)",
            f"DELETE FROM {SCHEMA}.group_messages WHERE sender_id = %s",
            f"DELETE FROM {SCHEMA}.group_mute WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.group_members WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.group_message_reactions WHERE message_id IN (SELECT id FROM {SCHEMA}.group_messages WHERE group_id IN (SELECT id FROM {SCHEMA}.groups WHERE owner_id = %s))",
            f"DELETE FROM {SCHEMA}.group_message_views WHERE message_id IN (SELECT id FROM {SCHEMA}.group_messages WHERE group_id IN (SELECT id FROM {SCHEMA}.groups WHERE owner_id = %s))",
            f"DELETE FROM {SCHEMA}.group_messages WHERE group_id IN (SELECT id FROM {SCHEMA}.groups WHERE owner_id = %s)",
            f"DELETE FROM {SCHEMA}.group_members WHERE group_id IN (SELECT id FROM {SCHEMA}.groups WHERE owner_id = %s)",
            f"DELETE FROM {SCHEMA}.group_mute WHERE group_id IN (SELECT id FROM {SCHEMA}.groups WHERE owner_id = %s)",
            f"DELETE FROM {SCHEMA}.groups WHERE owner_id = %s",
            # Истории
            f"DELETE FROM {SCHEMA}.story_reactions WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.story_views WHERE viewer_id = %s",
            f"DELETE FROM {SCHEMA}.story_reactions WHERE story_id IN (SELECT id FROM {SCHEMA}.stories WHERE user_id = %s)",
            f"DELETE FROM {SCHEMA}.story_views WHERE story_id IN (SELECT id FROM {SCHEMA}.stories WHERE user_id = %s)",
            f"DELETE FROM {SCHEMA}.stories WHERE user_id = %s",
            # Финансы и подписки
            f"DELETE FROM {SCHEMA}.payment_requests WHERE from_user_id = %s OR to_user_id = %s",
            f"DELETE FROM {SCHEMA}.payments WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.wallet_transactions WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.lightning_transactions WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.pro_subscriptions WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.user_sticker_packs WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.fundraisers WHERE owner_id = %s",
            # Поддержка, жалобы, геймификация, сессии
            f"DELETE FROM {SCHEMA}.support_messages WHERE sender_id = %s",
            f"DELETE FROM {SCHEMA}.support_messages WHERE ticket_id IN (SELECT id FROM {SCHEMA}.support_tickets WHERE user_id = %s)",
            f"DELETE FROM {SCHEMA}.support_tickets WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.reports WHERE reporter_id = %s",
            f"DELETE FROM {SCHEMA}.user_badges WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.xp_daily_counters WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.xp_events WHERE user_id = %s",
            f"DELETE FROM {SCHEMA}.user_sessions WHERE user_id = %s",
            f"UPDATE {SCHEMA}.users SET bot_owner_id = NULL WHERE bot_owner_id = %s",
            f"DELETE FROM {SCHEMA}.sms_codes WHERE phone IN (SELECT phone FROM {SCHEMA}.users WHERE id = %s)",
        ]
        for q in safe_queries:
            try:
                ph_count = q.count("%s")
                cur.execute(q, tuple([uid] * ph_count))
            except Exception:
                # Если таблицы/колонки нет — пропускаем
                conn.rollback()
                cur = conn.cursor()

        # Финальное удаление пользователя — БЕЗ проглатывания ошибки,
        # иначе панель показывала «успех», а аккаунт оставался в базе.
        try:
            cur.execute(f"DELETE FROM {SCHEMA}.users WHERE id = %s", (uid,))
            deleted = cur.rowcount
        except Exception as e:
            conn.rollback()
            conn.close()
            return err(f"Не удалось удалить пользователя: {str(e)[:200]}")

        conn.close()
        if not deleted:
            return err("Пользователь не найден")
        return ok({"ok": True, "deleted": deleted})

    # ── user_detail — детальная информация ───────────────────────────────────
    if action == "user_detail":
        user_id = body.get("user_id") or params.get("user_id")
        if not user_id:
            conn.close()
            return err("Нужен user_id")
        cur.execute(
            f"""SELECT id, phone, name, avatar_url, last_seen, created_at,
                       about, gender, birthdate, wallet_balance, pro_until,
                       emoji_status, name_color, incognito, who_can_message, who_can_call,
                       lightning_balance, pro_trial_used, stickers_subscription_until,
                       xp, level, daily_streak, last_active_day,
                       is_bot, bot_owner_id, bot_username, bot_description, bot_webhook_url
                FROM {SCHEMA}.users WHERE id = %s""",
            (int(user_id),)
        )
        u = cur.fetchone()
        if not u:
            conn.close()
            return err("Не найден", 404)
        uid_int = int(user_id)
        # Метрики
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.messages WHERE sender_id = %s", (uid_int,))
        msg_count = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.chats WHERE user1_id = %s OR user2_id = %s", (uid_int, uid_int))
        chat_count = cur.fetchone()[0]
        try:
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.contacts WHERE user_id = %s", (uid_int,))
            contacts_count = cur.fetchone()[0]
        except Exception:
            conn.rollback(); cur = conn.cursor(); contacts_count = 0
        try:
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.stories WHERE user_id = %s AND expires_at > %s", (uid_int, int(time.time())))
            active_stories = cur.fetchone()[0]
        except Exception:
            conn.rollback(); cur = conn.cursor(); active_stories = 0
        try:
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.push_subscriptions WHERE user_id = %s", (uid_int,))
            push_count = cur.fetchone()[0]
        except Exception:
            conn.rollback(); cur = conn.cursor(); push_count = 0
        try:
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.user_blocks WHERE user_id = %s", (uid_int,))
            blocks_out = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.user_blocks WHERE blocked_id = %s", (uid_int,))
            blocks_in = cur.fetchone()[0]
        except Exception:
            conn.rollback(); cur = conn.cursor(); blocks_out = 0; blocks_in = 0
        # Последняя активность по сообщениям
        cur.execute(f"SELECT MAX(created_at) FROM {SCHEMA}.messages WHERE sender_id = %s", (uid_int,))
        last_msg_at = cur.fetchone()[0]
        # Боты, которыми владеет
        try:
            cur.execute(f"SELECT id, name, bot_username FROM {SCHEMA}.users WHERE bot_owner_id = %s ORDER BY id", (uid_int,))
            owned_bots = [{"id": r[0], "name": r[1], "username": r[2]} for r in cur.fetchall()]
        except Exception:
            conn.rollback(); cur = conn.cursor(); owned_bots = []
        conn.close()
        now = int(time.time())
        bd = u[8].isoformat() if u[8] else None
        return ok({"user": {
            "id": u[0], "phone": u[1], "name": u[2], "avatar_url": u[3],
            "last_seen": u[4], "created_at": u[5],
            "about": u[6], "gender": u[7], "birthdate": bd,
            "wallet_balance": float(u[9]) if u[9] is not None else 0.0,
            "pro_until": u[10],
            "is_pro": bool(u[10] and u[10] > now),
            "emoji_status": u[11], "name_color": u[12],
            "incognito": bool(u[13]),
            "who_can_message": u[14], "who_can_call": u[15],
            "lightning_balance": u[16] or 0,
            "pro_trial_used": bool(u[17]),
            "stickers_subscription_until": u[18],
            "xp": u[19] or 0, "level": u[20] or 1, "daily_streak": u[21] or 0,
            "last_active_day": u[22],
            "is_bot": bool(u[23]),
            "bot_owner_id": u[24], "bot_username": u[25],
            "bot_description": u[26], "bot_webhook_url": u[27],
            "msg_count": msg_count, "chat_count": chat_count,
            "contacts_count": contacts_count,
            "active_stories": active_stories,
            "push_subscriptions": push_count,
            "blocks_out": blocks_out, "blocks_in": blocks_in,
            "last_message_at": last_msg_at,
            "owned_bots": owned_bots,
            "online": bool(u[4] and (now - int(u[4])) < 300),
        }})

    # ── send_to_user — написать пользователю от имени разработчика ───────────
    if action == "send_to_user":
        target_user_id = body.get("user_id")
        text = (body.get("text") or "").strip()
        if not target_user_id or not text:
            conn.close()
            return err("Нужен user_id и text")

        # Находим или создаём системного пользователя "Nova Dev"
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE phone = '00000000000'")
        dev_user = cur.fetchone()
        if not dev_user:
            now = int(time.time())
            cur.execute(
                f"""INSERT INTO {SCHEMA}.users (phone, name, last_seen, created_at)
                    VALUES ('00000000000', 'Nova Dev', %s, %s)
                    RETURNING id""",
                (now, now)
            )
            dev_user_id = cur.fetchone()[0]
        else:
            dev_user_id = dev_user[0]

        # Создаём чат между dev и пользователем
        uid, pid = sorted([dev_user_id, int(target_user_id)])
        cur.execute(
            f"""INSERT INTO {SCHEMA}.chats (user1_id, user2_id, created_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (user1_id, user2_id) DO UPDATE SET user1_id = EXCLUDED.user1_id
                RETURNING id""",
            (uid, pid, int(time.time()))
        )
        chat_id = cur.fetchone()[0]

        # Отправляем сообщение
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text, created_at)
                VALUES (%s, %s, %s, %s) RETURNING id""",
            (chat_id, dev_user_id, text, now)
        )
        msg_id = cur.fetchone()[0]
        cur.execute(
            f"UPDATE {SCHEMA}.chats SET last_message = %s, last_message_at = %s WHERE id = %s",
            (text[:100], now, chat_id)
        )
        conn.close()

        # Push-уведомление пользователю
        push_url = os.environ.get("PUSH_NOTIFY_URL", "")
        if push_url:
            try:
                push_body = json.dumps({
                    "action": "send",
                    "recipient_id": int(target_user_id),
                    "sender_name": "Nova Dev",
                    "message": text[:100],
                    "chat_id": chat_id,
                }).encode("utf-8")
                req = urllib.request.Request(push_url, data=push_body, headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=5)
            except Exception:
                pass

        return ok({"ok": True, "msg_id": msg_id, "chat_id": chat_id})

    # ── broadcast — рассылка сообщения ВСЕМ пользователям ──────────────────────
    if action == "broadcast":
        text = (body.get("text") or "").strip()
        if not text:
            conn.close()
            return err("Нужен text")

        # Системный пользователь "Nova Dev"
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE phone = '00000000000'")
        dev_user = cur.fetchone()
        now = int(time.time())
        if not dev_user:
            cur.execute(
                f"""INSERT INTO {SCHEMA}.users (phone, name, last_seen, created_at)
                    VALUES ('00000000000', 'Nova Dev', %s, %s)
                    RETURNING id""",
                (now, now)
            )
            dev_user_id = cur.fetchone()[0]
        else:
            dev_user_id = dev_user[0]

        # Все реальные пользователи, кроме системного
        cur.execute(
            f"SELECT id FROM {SCHEMA}.users WHERE phone <> '00000000000'"
        )
        user_ids = [r[0] for r in cur.fetchall()]

        sent = 0
        for target_user_id in user_ids:
            uid, pid = sorted([dev_user_id, int(target_user_id)])
            cur.execute(
                f"""INSERT INTO {SCHEMA}.chats (user1_id, user2_id, created_at)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user1_id, user2_id) DO UPDATE SET user1_id = EXCLUDED.user1_id
                    RETURNING id""",
                (uid, pid, now)
            )
            chat_id = cur.fetchone()[0]
            cur.execute(
                f"""INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text, created_at)
                    VALUES (%s, %s, %s, %s)""",
                (chat_id, dev_user_id, text, now)
            )
            cur.execute(
                f"UPDATE {SCHEMA}.chats SET last_message = %s, last_message_at = %s WHERE id = %s",
                (text[:100], now, chat_id)
            )
            sent += 1
        conn.close()

        # Один общий push-вызов на массовую рассылку — push-notify сам разошлёт всем
        push_url = os.environ.get("PUSH_NOTIFY_URL", "")
        if push_url:
            try:
                push_body = json.dumps({
                    "action": "broadcast",
                    "sender_name": "Nova Dev",
                    "message": text[:140],
                }).encode("utf-8")
                req = urllib.request.Request(push_url, data=push_body, headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=15)
            except Exception:
                pass

        return ok({"ok": True, "sent": sent})

    # ── support: список тикетов ────────────────────────────────────────────────
    if action == "support_list_tickets":
        status_filter = (body.get("status") or "all").strip()
        where = ""
        params: list = []
        if status_filter in ("open", "closed"):
            where = "WHERE t.status=%s"
            params.append(status_filter)
        cur.execute(
            f"""SELECT t.id, t.user_id, u.name, u.phone, u.avatar_url,
                       t.subject, t.status, t.created_at, t.last_message_at, t.unread_for_admin,
                       (SELECT text FROM {SCHEMA}.support_messages m WHERE m.ticket_id=t.id ORDER BY m.created_at DESC LIMIT 1) AS last_text
                FROM {SCHEMA}.support_tickets t
                LEFT JOIN {SCHEMA}.users u ON u.id=t.user_id
                {where}
                ORDER BY t.unread_for_admin DESC, t.last_message_at DESC LIMIT 200""",
            tuple(params)
        )
        rows = cur.fetchall()
        # счётчик непрочитанных
        cur.execute(f"SELECT COALESCE(SUM(unread_for_admin),0) FROM {SCHEMA}.support_tickets")
        total_unread = int(cur.fetchone()[0] or 0)
        conn.close()
        return ok({
            "tickets": [{
                "id": r[0], "user_id": r[1], "user_name": r[2], "user_phone": r[3], "user_avatar": r[4],
                "subject": r[5], "status": r[6],
                "created_at": int(r[7]), "last_message_at": int(r[8]),
                "unread": int(r[9] or 0),
                "last_text": (r[10] or "")[:140],
            } for r in rows],
            "total_unread": total_unread,
        })

    if action == "support_admin_messages":
        ticket_id = body.get("ticket_id")
        if not ticket_id:
            conn.close(); return err("Нужен ticket_id")
        try:
            tid = int(ticket_id)
        except Exception:
            conn.close(); return err("Неверный ticket_id")
        cur.execute(
            f"""SELECT t.id, t.user_id, u.name, u.phone, u.avatar_url,
                       t.subject, t.status, t.created_at, t.last_message_at
                FROM {SCHEMA}.support_tickets t
                LEFT JOIN {SCHEMA}.users u ON u.id=t.user_id
                WHERE t.id=%s""",
            (tid,)
        )
        tt = cur.fetchone()
        if not tt:
            conn.close(); return err("Тикет не найден", 404)
        cur.execute(
            f"""SELECT id, sender_id, is_admin, text, created_at
                FROM {SCHEMA}.support_messages
                WHERE ticket_id=%s ORDER BY created_at ASC LIMIT 500""",
            (tid,)
        )
        rows = cur.fetchall()
        # сбрасываем unread_for_admin
        cur.execute(f"UPDATE {SCHEMA}.support_tickets SET unread_for_admin=0 WHERE id=%s", (tid,))
        conn.close()
        return ok({
            "ticket": {
                "id": tt[0], "user_id": tt[1], "user_name": tt[2], "user_phone": tt[3], "user_avatar": tt[4],
                "subject": tt[5], "status": tt[6],
                "created_at": int(tt[7]), "last_message_at": int(tt[8]),
            },
            "messages": [{
                "id": r[0], "sender_id": r[1], "is_admin": bool(r[2]),
                "text": r[3], "created_at": int(r[4]),
            } for r in rows],
        })

    if action == "support_admin_reply":
        ticket_id = body.get("ticket_id")
        text = (body.get("text") or "").strip()[:4000]
        if not ticket_id or not text:
            conn.close(); return err("Нужен ticket_id и text")
        try:
            tid = int(ticket_id)
        except Exception:
            conn.close(); return err("Неверный ticket_id")
        cur.execute(f"SELECT user_id FROM {SCHEMA}.support_tickets WHERE id=%s", (tid,))
        rr = cur.fetchone()
        if not rr:
            conn.close(); return err("Тикет не найден", 404)
        target_uid = int(rr[0])
        now = int(time.time())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.support_messages (ticket_id, sender_id, is_admin, text, created_at)
                VALUES (%s, NULL, TRUE, %s, %s) RETURNING id""",
            (tid, text, now)
        )
        mid = int(cur.fetchone()[0])
        cur.execute(
            f"UPDATE {SCHEMA}.support_tickets SET last_message_at=%s, unread_for_user=unread_for_user+1 WHERE id=%s",
            (now, tid)
        )
        conn.close()
        # Push юзеру
        push_url = os.environ.get("PUSH_NOTIFY_URL", "")
        if push_url:
            try:
                push_body = json.dumps({
                    "action": "send",
                    "recipient_id": target_uid,
                    "sender_name": "Поддержка Nova",
                    "message": "Ответ от поддержки: " + text[:100],
                }).encode("utf-8")
                req = urllib.request.Request(push_url, data=push_body, headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=5)
            except Exception:
                pass
        return ok({"id": mid, "created_at": now})

    if action == "support_admin_close":
        ticket_id = body.get("ticket_id")
        if not ticket_id:
            conn.close(); return err("Нужен ticket_id")
        try:
            tid = int(ticket_id)
        except Exception:
            conn.close(); return err("Неверный ticket_id")
        now = int(time.time())
        cur.execute(
            f"UPDATE {SCHEMA}.support_tickets SET status='closed', closed_at=%s WHERE id=%s",
            (now, tid)
        )
        conn.close()
        return ok({"ok": True})

    # ── clear_test_data — обезличить всех пользователей (имя, аватар, телефон) ──
    if action == "clear_test_data":
        cur.execute(
            f"""UPDATE {SCHEMA}.users
                SET name = '',
                    avatar_url = NULL,
                    last_seen = 0,
                    phone = 'cleared_' || id::text"""
        )
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
        cleared = cur.fetchone()[0]
        conn.close()
        return ok({"ok": True, "cleared": cleared})

    # ── nuke_all — снести всё одной кнопкой (юзеры + сообщения + чаты) ────────
    if action == "nuke_all":
        now = int(time.time())
        # 1. Сообщения
        cur.execute(
            f"""UPDATE {SCHEMA}.messages
                SET removed_at = %s,
                    text = '',
                    media_url = NULL,
                    media_type = NULL,
                    image_url = NULL,
                    file_name = NULL,
                    file_size = NULL,
                    duration = NULL,
                    reply_to_id = NULL
                WHERE removed_at IS NULL""",
            (now,)
        )
        msgs_cleared = cur.rowcount
        # 2. Реакции
        cur.execute(f"UPDATE {SCHEMA}.message_reactions SET emoji = '__removed__'")
        # 3. Превью чатов
        cur.execute(f"UPDATE {SCHEMA}.chats SET last_message = '', last_message_at = 0")
        # 4. Пользователи
        cur.execute(
            f"""UPDATE {SCHEMA}.users
                SET name = '',
                    avatar_url = NULL,
                    last_seen = 0,
                    phone = 'cleared_' || id::text"""
        )
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
        users_cleared = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.chats")
        chats_cleared = cur.fetchone()[0]
        conn.close()
        return ok({
            "ok": True,
            "users": users_cleared,
            "messages": msgs_cleared,
            "chats": chats_cleared,
        })

    # ── clear_all_messages — обнулить все сообщения и превью чатов ─────────────
    if action == "clear_all_messages":
        now = int(time.time())
        cur.execute(
            f"""UPDATE {SCHEMA}.messages
                SET removed_at = %s,
                    text = '',
                    media_url = NULL,
                    media_type = NULL,
                    image_url = NULL,
                    file_name = NULL,
                    file_size = NULL,
                    duration = NULL,
                    reply_to_id = NULL
                WHERE removed_at IS NULL""",
            (now,)
        )
        cleared_msgs = cur.rowcount
        cur.execute(
            f"UPDATE {SCHEMA}.chats SET last_message = '', last_message_at = 0"
        )
        cur.execute(f"UPDATE {SCHEMA}.message_reactions SET emoji = '__removed__'")
        conn.close()
        return ok({"ok": True, "cleared_messages": cleared_msgs})

    # ── reports_list — список жалоб ──────────────────────────────────────────
    if action == "reports_list":
        status_filter = (body.get("status") or params.get("status") or "all").strip()
        where = ""
        q_params: list = []
        if status_filter in ("open", "resolved"):
            where = "WHERE r.status = %s"
            q_params.append(status_filter)
        cur.execute(
            f"""SELECT r.id, r.reporter_id, ru.name, ru.phone,
                       r.reported_user_id, tu.name, tu.phone, tu.avatar_url,
                       r.chat_id, r.reason, r.comment, r.status, r.created_at
                FROM {SCHEMA}.reports r
                LEFT JOIN {SCHEMA}.users ru ON ru.id = r.reporter_id
                LEFT JOIN {SCHEMA}.users tu ON tu.id = r.reported_user_id
                {where}
                ORDER BY r.created_at DESC LIMIT 300""",
            tuple(q_params)
        )
        rows = cur.fetchall()
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.reports WHERE status = 'open'")
        open_count = int(cur.fetchone()[0] or 0)
        conn.close()
        return ok({
            "reports": [{
                "id": r[0],
                "reporter_id": r[1], "reporter_name": r[2], "reporter_phone": r[3],
                "reported_user_id": r[4], "reported_name": r[5], "reported_phone": r[6], "reported_avatar": r[7],
                "chat_id": r[8], "reason": r[9], "comment": r[10],
                "status": r[11], "created_at": int(r[12]),
            } for r in rows],
            "open_count": open_count,
        })

    # ── report_delete — удалить жалобу ───────────────────────────────────────
    if action == "report_delete":
        report_id = body.get("report_id")
        if not report_id:
            conn.close(); return err("Нужен report_id")
        try:
            rid = int(report_id)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный report_id")
        cur.execute(f"DELETE FROM {SCHEMA}.reports WHERE id = %s", (rid,))
        conn.close()
        return ok({"ok": True, "deleted": rid})

    # ── report_resolve — пометить жалобу обработанной ────────────────────────
    if action == "report_resolve":
        report_id = body.get("report_id")
        if not report_id:
            conn.close(); return err("Нужен report_id")
        try:
            rid = int(report_id)
        except (TypeError, ValueError):
            conn.close(); return err("Неверный report_id")
        cur.execute(f"UPDATE {SCHEMA}.reports SET status = 'resolved' WHERE id = %s", (rid,))
        conn.close()
        return ok({"ok": True, "resolved": rid})

    # ── topup_user — пополнить баланс пользователю (админ) ────────────────────
    if action == "topup_user":
        user_id = body.get("user_id")
        try:
            amount = float(body.get("amount") or 0)
        except (TypeError, ValueError):
            conn.close(); return err("Неверная сумма")
        if not user_id:
            conn.close(); return err("Нужен user_id")
        if amount == 0 or amount < -1000000 or amount > 1000000:
            conn.close(); return err("Сумма от -1000000 до 1000000, не 0")
        description = (body.get("description") or "Пополнение от администратора")[:200]
        cur.execute(
            f"UPDATE {SCHEMA}.users SET wallet_balance = COALESCE(wallet_balance,0) + %s WHERE id = %s RETURNING wallet_balance",
            (amount, int(user_id))
        )
        row = cur.fetchone()
        if not row:
            conn.close(); return err("Пользователь не найден", 404)
        new_balance = float(row[0])
        try:
            cur.execute(
                f"""INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, kind, description, balance_after, created_at)
                    VALUES (%s, %s, 'topup', %s, %s, %s)""",
                (int(user_id), amount, description, new_balance, int(time.time()))
            )
        except Exception:
            conn.rollback()
        conn.close()
        return ok({"ok": True, "balance": new_balance})

    conn.close()
    return err("Неизвестный action")