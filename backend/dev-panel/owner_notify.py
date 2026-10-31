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
        if kind != "daily" and kind not in events:
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


SUMMARY_HOUR_MSK = 21


def daily_summary_due(cur, schema: str, push=None) -> bool:
    """Раз в день после 21:00 по Москве шлёт владельцам сводку за сегодня.
    Отметка дня ставится атомарно, поэтому сводка уходит один раз."""
    s = f"{schema}." if schema and not schema.endswith(".") else (schema or "")
    msk = time.gmtime(time.time() + 3 * 3600)
    if msk.tm_hour < SUMMARY_HOUR_MSK:
        return False
    day = time.strftime("%Y-%m-%d", msk)
    cur.execute(
        f"INSERT INTO {s}dev_settings (key, value, updated_at) VALUES ('daily_summary_day', %s, %s) "
        f"ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at "
        f"WHERE {s}dev_settings.value IS DISTINCT FROM EXCLUDED.value RETURNING key",
        (day, int(time.time())),
    )
    if not cur.fetchone():
        return False
    return send_daily_summary(cur, schema, push) > 0


def send_daily_summary(cur, schema: str, push=None) -> int:
    """Считает итоги текущих суток по Москве и отправляет их владельцам."""
    s = f"{schema}." if schema and not schema.endswith(".") else (schema or "")
    now = time.time()
    msk = time.gmtime(now + 3 * 3600)
    start = int(now) - (msk.tm_hour * 3600 + msk.tm_min * 60 + msk.tm_sec)
    cur.execute(f"SELECT COUNT(*) FROM {s}users WHERE created_at >= %s AND phone <> '00000000000'", (start,))
    new_users = int(cur.fetchone()[0] or 0)
    cur.execute(
        f"SELECT COALESCE(SUM(amount), 0), COUNT(*) FROM {s}orders "
        f"WHERE status = 'paid' AND paid_at >= %s::timestamp",
        (time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(start)),),
    )
    revenue, pays = cur.fetchone()
    cur.execute(f"SELECT COUNT(*) FROM {s}reports WHERE status = 'open'")
    open_reports = int(cur.fetchone()[0] or 0)
    rub = f"{float(revenue or 0):,.0f}".replace(",", " ")
    body = (f"Новых пользователей: {new_users}\n"
            f"Выручка: {rub} ₽ (оплат: {int(pays or 0)})\n"
            f"Открытых жалоб: {open_reports}")
    return notify_owners(cur, schema, "daily", f"Итоги дня, {time.strftime('%d.%m', msk)}", body, push)
