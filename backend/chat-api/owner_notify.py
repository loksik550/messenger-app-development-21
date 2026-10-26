"""Дублирование служебных уведомлений владельцу в приложение Nova (чат с аккаунтом Nova)."""
import os
import json
import time
import hashlib
import urllib.request

PUSH_URL = "https://functions.poehali.dev/c9d141ca-3552-433f-a968-ac1e92da00af"


def _push(payload: dict, timeout: float = 3.0) -> None:
    key = hashlib.sha256((os.environ.get("DATABASE_URL", "") + "|nova-internal").encode()).hexdigest()
    req = urllib.request.Request(
        PUSH_URL, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Internal-Key": key},
    )
    try:
        urllib.request.urlopen(req, timeout=timeout)
    except Exception as e:
        print(f"[owner_notify] push: {e}")


def notify_owners(cur, schema: str, kind: str, title: str, body_text: str, push=None) -> int:
    """Пишет сообщение от Nova всем активным владельцам панели с привязанным аккаунтом.
    kind: report | support | pay. Возвращает число получателей."""
    s = f"{schema}." if schema and not schema.endswith(".") else (schema or "")
    try:
        cur.execute(f"SELECT value FROM {s}dev_settings WHERE key = 'tg_events'")
        r = cur.fetchone()
        events = ((r[0] if r else None) or "report,support,pay").split(",")
        if kind not in events:
            return 0
        cur.execute(f"SELECT id FROM {s}users WHERE phone = '00000000000'")
        r = cur.fetchone()
        if not r:
            return 0
        nova = int(r[0])
        cur.execute(
            f"SELECT DISTINCT nova_user_id FROM {s}dev_admins "
            f"WHERE role = 'owner' AND COALESCE(disabled, FALSE) = FALSE AND nova_user_id IS NOT NULL"
        )
        owners = [int(x[0]) for x in cur.fetchall() if int(x[0]) != nova]
        text = f"{title}\n\n{body_text}"[:4000]
        now = int(time.time())
        for uid in owners:
            a, b = sorted([nova, uid])
            cur.execute(
                f"INSERT INTO {s}chats (user1_id, user2_id, created_at) VALUES (%s, %s, %s) "
                f"ON CONFLICT (user1_id, user2_id) DO UPDATE SET user1_id = EXCLUDED.user1_id RETURNING id",
                (a, b, now),
            )
            chat_id = cur.fetchone()[0]
            cur.execute(
                f"INSERT INTO {s}messages (chat_id, sender_id, text, created_at) VALUES (%s, %s, %s, %s)",
                (chat_id, nova, text, now),
            )
            cur.execute(
                f"UPDATE {s}chats SET last_message = %s, last_message_at = %s WHERE id = %s",
                (text[:100], now, chat_id),
            )
            payload = {"action": "send", "recipient_id": uid, "sender_name": "Nova",
                       "message": text[:100], "chat_id": chat_id}
            (push or _push)(payload)
        return len(owners)
    except Exception as e:
        print(f"[owner_notify] {type(e).__name__}: {e}")
        return 0
