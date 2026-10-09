"""Проверка, что запрос пришёл от владельца аккаунта: секретный ключ сессии."""
import hashlib
import json
import os
import secrets
import time

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67547116_messenger_app_develo")
_strict_cache = {"value": False, "at": 0.0}


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def internal_key() -> str:
    """Ключ для вызовов между своими функциями (не уходит наружу)."""
    base = os.environ.get("DATABASE_URL", "") + "|nova-internal"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def is_internal(event: dict) -> bool:
    h = event.get("headers") or {}
    got = h.get("X-Internal-Key") or h.get("x-internal-key") or ""
    return bool(got) and secrets.compare_digest(got, internal_key())


def issue_token(cur, uid: int, device_name: str = "", device_info: str = "", ip: str = "") -> str:
    raw = f"{int(uid)}.{secrets.token_urlsafe(32)}"
    now = int(time.time())
    cur.execute(
        f"INSERT INTO {SCHEMA}.user_sessions "
        f"(user_id, device_name, device_info, ip_addr, created_at, last_active_at, token_hash) "
        f"VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (int(uid), device_name[:100], device_info[:300], ip[:64], now, now, hash_token(raw)),
    )
    return raw


def revoke_token(cur, token: str) -> None:
    if token:
        cur.execute(
            f"UPDATE {SCHEMA}.user_sessions SET revoked = TRUE WHERE token_hash = %s",
            (hash_token(token),),
        )


def get_token(event: dict) -> str:
    h = event.get("headers") or {}
    t = h.get("X-Auth-Token") or h.get("x-auth-token") or ""
    if not t:
        t = (event.get("queryStringParameters") or {}).get("token") or ""
    return str(t).strip()


def is_strict(cur) -> bool:
    now = time.time()
    if now - _strict_cache["at"] < 30:
        return _strict_cache["value"]
    try:
        cur.execute(f"SELECT value FROM {SCHEMA}.dev_settings WHERE key = 'auth_strict'")
        r = cur.fetchone()
        _strict_cache["value"] = bool(r and r[0] == "1")
    except Exception:
        _strict_cache["value"] = False
    _strict_cache["at"] = now
    return _strict_cache["value"]


def current_session_id(cur, event: dict, uid) -> int | None:
    token = get_token(event)
    if not token:
        return None
    cur.execute(
        f"SELECT id FROM {SCHEMA}.user_sessions WHERE token_hash = %s AND user_id = %s AND revoked = FALSE",
        (hash_token(token), int(uid)),
    )
    r = cur.fetchone()
    return int(r[0]) if r else None


def check(cur, event: dict, user_id) -> bool:
    """True — запрос можно выполнять. Без user_id проверка не нужна."""
    if user_id in (None, "", "0", 0):
        return True
    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        return False
    token = get_token(event)
    if not token:
        if is_strict(cur):
            return False
        print(f"[auth] legacy request without token uid={uid}")
        return True
    if not token.startswith(f"{uid}."):
        return False
    sid = current_session_id(cur, event, uid)
    if not sid:
        return False
    now = int(time.time())
    cur.execute(
        f"UPDATE {SCHEMA}.user_sessions SET last_active_at = %s WHERE id = %s AND last_active_at < %s",
        (now, sid, now - 300),
    )
    return True


def denied(cors: dict) -> dict:
    return {
        "statusCode": 401,
        "headers": cors,
        "body": json.dumps({"error": "Сессия устарела, войдите заново", "auth_required": True}, ensure_ascii=False),
    }
