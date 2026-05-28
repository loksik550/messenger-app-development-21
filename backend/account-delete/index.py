"""
Полное удаление аккаунта пользователя.
Требование RuStore (информационная безопасность):
пользователь должен иметь возможность удалить свой аккаунт прямо из приложения,
а все его персональные данные должны быть безвозвратно стёрты.
"""
import os
import json
import time
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67547116_messenger_app_develo")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
}


def ok(data):
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(data, ensure_ascii=False)}


def err(msg, code=400):
    return {"statusCode": code, "headers": CORS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def get_conn():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    return conn


# Все таблицы, в которых хранятся данные пользователя.
# Порядок важен: сначала зависимые, потом сам users.
USER_DATA_TABLES = [
    ("message_reactions", "user_id"),
    ("group_message_reactions", "user_id"),
    ("group_message_views", "user_id"),
    ("favorite_messages", "user_id"),
    ("message_drafts", "user_id"),
    ("scheduled_messages", "user_id"),
    ("typing_status", "user_id"),
    ("story_views", "viewer_id"),
    ("story_reactions", "user_id"),
    ("stories", "user_id"),
    ("close_friends", "user_id"),
    ("close_friends", "friend_id"),
    ("contacts", "user_id"),
    ("contacts", "contact_id"),
    ("user_blocks", "blocker_id"),
    ("user_blocks", "blocked_id"),
    ("user_sessions", "user_id"),
    ("user_badges", "user_id"),
    ("user_sticker_packs", "user_id"),
    ("push_subscriptions", "user_id"),
    ("xp_daily_counters", "user_id"),
    ("xp_events", "user_id"),
    ("rate_limits", "user_id"),
    ("group_mute", "user_id"),
    ("group_members", "user_id"),
    ("chat_settings", "user_id"),
    ("call_signals", "from_user_id"),
    ("call_signals", "to_user_id"),
    ("saved_notes", "user_id"),
    ("payment_requests", "from_user_id"),
    ("payment_requests", "to_user_id"),
    ("payments", "user_id"),
    ("lightning_transactions", "from_user_id"),
    ("lightning_transactions", "to_user_id"),
    ("wallet_transactions", "user_id"),
    ("pro_subscriptions", "user_id"),
    ("sms_codes", "user_id"),
    ("support_messages", "user_id"),
    ("support_tickets", "user_id"),
    ("fundraiser_payments", "user_id"),
    ("fundraisers", "user_id"),
    ("orders", "user_id"),
]


def handler(event: dict, context) -> dict:
    """Удаляет аккаунт пользователя и все его данные.

    Метод: POST
    Заголовок: X-User-Id — ID пользователя (числовой)
    Тело: {"confirm": "DELETE", "phone": "+7..."}
        Двойное подтверждение защищает от случайного нажатия.
    Ответ: {"deleted": true, "user_id": 123}
    """
    method = event.get("httpMethod", "POST")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if method not in ("POST", "DELETE"):
        return err("Method not allowed", 405)

    headers = event.get("headers") or {}
    user_id_raw = (
        headers.get("X-User-Id")
        or headers.get("x-user-id")
        or headers.get("X-USER-ID")
    )
    if not user_id_raw:
        return err("Не передан X-User-Id", 401)

    try:
        user_id = int(user_id_raw)
    except (TypeError, ValueError):
        return err("Некорректный X-User-Id", 401)

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return err("Некорректный JSON")

    if body.get("confirm") != "DELETE":
        return err("Требуется явное подтверждение (confirm=DELETE)")

    confirm_phone = (body.get("phone") or "").strip()
    if not confirm_phone:
        return err("Введите свой номер телефона для подтверждения")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id, phone FROM {SCHEMA}.users WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                conn.rollback()
                return err("Пользователь не найден", 404)

            db_phone = (row[1] or "").strip()
            if db_phone != confirm_phone:
                conn.rollback()
                return err("Номер телефона не совпадает с привязанным к аккаунту")

            stats = {}

            for table, col in USER_DATA_TABLES:
                try:
                    cur.execute(
                        f"DELETE FROM {SCHEMA}.{table} WHERE {col} = %s",
                        (user_id,),
                    )
                    stats[f"{table}.{col}"] = cur.rowcount
                except psycopg2.errors.UndefinedTable:
                    conn.rollback()
                    cur.execute("BEGIN")
                except psycopg2.errors.UndefinedColumn:
                    conn.rollback()
                    cur.execute("BEGIN")
                except Exception:
                    conn.rollback()
                    cur.execute("BEGIN")

            try:
                cur.execute(
                    f"UPDATE {SCHEMA}.messages SET text = '[удалено]', sender_id = 0 "
                    f"WHERE sender_id = %s",
                    (user_id,),
                )
                stats["messages.anonymized"] = cur.rowcount
            except Exception:
                pass

            try:
                cur.execute(
                    f"UPDATE {SCHEMA}.group_messages SET text = '[удалено]', sender_id = 0 "
                    f"WHERE sender_id = %s",
                    (user_id,),
                )
                stats["group_messages.anonymized"] = cur.rowcount
            except Exception:
                pass

            try:
                cur.execute(
                    f"DELETE FROM {SCHEMA}.chats WHERE user1_id = %s OR user2_id = %s",
                    (user_id, user_id),
                )
                stats["chats"] = cur.rowcount
            except Exception:
                pass

            cur.execute(
                f"DELETE FROM {SCHEMA}.users WHERE id = %s",
                (user_id,),
            )
            stats["users"] = cur.rowcount

        conn.commit()
        return ok({
            "deleted": True,
            "user_id": user_id,
            "deleted_at": int(time.time()),
            "stats": stats,
        })
    except Exception as e:
        conn.rollback()
        return err(f"Ошибка удаления: {str(e)[:200]}", 500)
    finally:
        conn.close()
