import json
import os
import time
import traceback

import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67547116_messenger_app_develo")
CORS = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}


def _action(event):
    try:
        body = json.loads(event.get("body") or "{}")
        if isinstance(body, dict) and body.get("action"):
            return str(body.get("action"))[:60]
    except Exception:
        pass
    q = event.get("queryStringParameters") or {}
    return str(q.get("action") or event.get("httpMethod") or "")[:60]


def _uid(event):
    h = event.get("headers") or {}
    v = h.get("X-User-Id") or h.get("x-user-id") or ""
    return int(v) if str(v).isdigit() else None


def record(source, event, exc):
    """Записывает сбой в error_log. Никогда не бросает исключений."""
    kind = type(exc).__name__
    msg = str(exc)[:300]
    if "rate limit" in msg.lower():
        kind = "DbBusy"
    tb = traceback.format_exc().strip().splitlines()
    where = ""
    for line in reversed(tb):
        line = line.strip()
        if line.startswith('File "/function/code/'):
            where = line.replace('File "/function/code/', "").replace('"', "")[:120]
            break
    try:
        c = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=2)
        c.autocommit = True
        with c.cursor() as cur:
            cur.execute(
                f"INSERT INTO {SCHEMA}.error_log (source, action, kind, message, user_id, created_at) "
                f"VALUES (%s, %s, %s, %s, %s, %s)",
                (source[:40], _action(event), kind[:80], (msg + (" @ " + where if where else ""))[:500],
                 _uid(event), int(time.time())),
            )
        c.close()
    except Exception:
        pass


def guard(source, fn, event, context):
    try:
        return fn(event, context)
    except Exception as e:
        traceback.print_exc()
        record(source, event, e)
        busy = "rate limit" in str(e).lower()
        return {
            "statusCode": 503 if busy else 500,
            "headers": CORS,
            "body": json.dumps({"error": "Сервер перегружен, повторите" if busy else "Ошибка сервера, повторите позже"},
                               ensure_ascii=False),
        }
