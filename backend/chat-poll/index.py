import os
import json
import time
import random
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67547116_messenger_app_develo")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
}


def ok(data):
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(msg, code=400):
    return {"statusCode": code, "headers": CORS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def handler(event: dict, context) -> dict:
    """
    Лёгкий polling-эндпоинт для Nova: typing-индикатор, опрос звонков и доспевших отложенных сообщений.
    Вынесен из chat-api ради скорости и снижения compute-секунд.
    Actions: get_typing, get_call_signals, poll_incoming_call, scheduled_run_due, ping
    """
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body = json.loads(event.get("body") or "{}")
    params = event.get("queryStringParameters") or {}
    action = body.get("action") or params.get("action", "")
    user_id = event.get("headers", {}).get("X-User-Id") or params.get("user_id")

    if action == "ping":
        return ok({"pong": int(time.time())})

    if not user_id:
        return err("Нужен X-User-Id")

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    cur = conn.cursor()

    # ── get_typing ───────────────────────────────────────────────────────────
    if action == "get_typing":
        chat_id = body.get("chat_id") or params.get("chat_id")
        if not chat_id:
            conn.close()
            return err("Укажите chat_id")
        now = int(time.time())
        # Раз в ~50 запросов чистим устаревшие typing (старше 30 сек) —
        # таблица не растёт и не нужен отдельный cron.
        if random.random() < 0.02:
            try:
                cur.execute(
                    f"DELETE FROM {SCHEMA}.typing_status WHERE updated_at < %s",
                    (now - 30,)
                )
            except Exception:
                pass
        cur.execute(
            f"""SELECT user_id FROM {SCHEMA}.typing_status
                WHERE chat_id = %s AND user_id != %s AND updated_at > %s""",
            (int(chat_id), int(user_id), now - 4),
        )
        rows = cur.fetchall()
        conn.close()
        return ok({"typing": len(rows) > 0})

    # ── get_call_signals ─────────────────────────────────────────────────────
    if action == "get_call_signals":
        call_id = (body.get("call_id") or params.get("call_id") or "").strip()
        if not call_id:
            conn.close()
            return err("Укажите call_id")
        since_id_raw = body.get("since_id")
        if since_id_raw is None:
            since_id_raw = params.get("since_id")
        if since_id_raw is not None:
            cur.execute(
                f"""SELECT id, from_user_id, type, payload, created_at
                    FROM {SCHEMA}.call_signals
                    WHERE call_id = %s AND to_user_id = %s AND id > %s AND type <> 'diag'
                    ORDER BY id ASC LIMIT 50""",
                (call_id, int(user_id), int(since_id_raw)),
            )
        else:
            since = int(body.get("since") or params.get("since") or 0)
            cur.execute(
                f"""SELECT id, from_user_id, type, payload, created_at
                    FROM {SCHEMA}.call_signals
                    WHERE call_id = %s AND to_user_id = %s AND created_at > %s AND type <> 'diag'
                    ORDER BY id ASC LIMIT 50""",
                (call_id, int(user_id), since),
            )
        rows = cur.fetchall()
        cur.execute(
            f"""SELECT 1 FROM {SCHEMA}.call_signals
                WHERE call_id = %s AND to_user_id = %s
                  AND type IN ('hangup','decline','end','cancel') LIMIT 1""",
            (call_id, int(user_id)),
        )
        ended = cur.fetchone() is not None
        conn.close()
        signals = [
            {"id": r[0], "from_user_id": r[1], "type": r[2], "payload": json.loads(r[3]) if r[3] else None, "created_at": r[4]}
            for r in rows
        ]
        return ok({"signals": signals, "ended": ended})

    # ── poll_incoming_call ───────────────────────────────────────────────────
    if action == "poll_incoming_call":
        since = int(body.get("since") or params.get("since") or (int(time.time()) - 30))
        cur.execute(
            f"""SELECT cs.call_id, cs.from_user_id, u.name, cs.created_at
                FROM {SCHEMA}.call_signals cs
                JOIN {SCHEMA}.users u ON u.id = cs.from_user_id
                WHERE cs.to_user_id = %s AND cs.type = 'offer' AND cs.created_at > %s
                ORDER BY cs.created_at DESC LIMIT 1""",
            (int(user_id), since),
        )
        row = cur.fetchone()
        conn.close()
        if row:
            return ok({"call": {"call_id": row[0], "from_user_id": row[1], "from_name": row[2], "created_at": row[3]}})
        return ok({"call": None})

    # ── scheduled_run_due ────────────────────────────────────────────────────
    if action == "scheduled_run_due":
        now = int(time.time())
        cur.execute(
            f"""SELECT id, chat_id, text, media_url, media_type, file_name, file_size, duration
                FROM {SCHEMA}.scheduled_messages
                WHERE sender_id=%s AND sent_at IS NULL AND cancelled_at IS NULL AND scheduled_at <= %s
                ORDER BY scheduled_at ASC LIMIT 20""",
            (int(user_id), now),
        )
        due = cur.fetchall()
        sent_ids = []
        for row in due:
            sid, chat_id, text, media_url, media_type, file_name, file_size, duration = row
            try:
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.messages
                        (chat_id, sender_id, text, image_url, media_type, media_url, file_name, file_size, duration, created_at, kind)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                    (
                        int(chat_id), int(user_id), text or "",
                        media_url if media_type == "image" else None,
                        media_type, media_url, file_name, file_size, duration, now, "text",
                    ),
                )
                msg_id = int(cur.fetchone()[0])
                preview = (text or {"image": "📷 Фото", "video": "📹 Видео", "audio": "🎵 Аудио", "file": "📎 Файл"}.get(media_type or "", "Сообщение"))[:100]
                cur.execute(
                    f"UPDATE {SCHEMA}.chats SET last_message=%s, last_message_at=%s WHERE id=%s",
                    (preview, now, int(chat_id)),
                )
                cur.execute(
                    f"UPDATE {SCHEMA}.scheduled_messages SET sent_at=%s, sent_message_id=%s WHERE id=%s",
                    (now, msg_id, sid),
                )
                sent_ids.append(sid)
            except Exception:
                conn.rollback()
                cur = conn.cursor()
                continue
        conn.close()
        return ok({"sent": len(sent_ids), "ids": sent_ids})

    conn.close()
    return err(f"Неизвестное действие: {action}", 404)