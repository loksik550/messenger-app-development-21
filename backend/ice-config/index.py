import os
import json
import time
import hmac
import hashlib
import base64
import socket
import urllib.request
import psycopg2
import nova_auth

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token",
}


def _cloudflare_turn():
    """Временные TURN-креды Cloudflare. Промышленный relay, реально пропускает
    медиа между разными сетями (в отличие от перегруженных бесплатных TURN)."""
    token_id = os.environ.get("CLOUDFLARE_TURN_TOKEN_ID", "").strip()
    api_token = os.environ.get("CLOUDFLARE_TURN_API_TOKEN", "").strip()
    if not token_id or not api_token:
        return None
    try:
        url = f"https://rtc.live.cloudflare.com/v1/turn/keys/{token_id}/credentials/generate"
        body = json.dumps({"ttl": 86400}).encode("utf-8")
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Authorization", f"Bearer {api_token}")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        ice = data.get("iceServers")
        if isinstance(ice, dict):
            return [ice]
        if isinstance(ice, list) and ice:
            return ice
    except Exception:
        pass
    return None


OWN_TURN_IP = "159.194.235.102"


def _own_turn():
    """Свой TURN-сервер turn.novaa.pro на coturn с use-auth-secret.
    Логин/пароль временные: username = unixtime истечения, пароль = HMAC-SHA1
    от username на static-auth-secret (стандарт coturn REST API)."""
    host = os.environ.get("TURN_HOST", "").strip()
    secret = os.environ.get("TURN_SECRET", "").strip()
    if not host or not secret:
        return None
    is_ip = host.replace(".", "").isdigit()
    if not is_ip:
        try:
            socket.getaddrinfo(host, 3478)
        except Exception:
            print(f"[ice] TURN host {host} не найден в DNS — используем IP {OWN_TURN_IP}")
            host, is_ip = OWN_TURN_IP, True
    expiry = int(time.time()) + 24 * 3600
    username = str(expiry)
    digest = hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()
    credential = base64.b64encode(digest).decode()
    urls = [f"turn:{host}:3478?transport=udp", f"turn:{host}:3478?transport=tcp"]
    if not is_ip:
        urls.append(f"turns:{host}:5349?transport=tcp")
    return {
        "urls": urls,
        "username": username,
        "credential": credential,
    }


_METERED_CACHE = {"at": 0.0, "data": []}


def _metered():
    """Креды Metered кэшируются на 10 минут — чтобы выдача серверов была мгновенной."""
    if _METERED_CACHE["data"] and time.time() - _METERED_CACHE["at"] < 600:
        return _METERED_CACHE["data"]
    key = os.environ.get("METERED_API_KEY", "").strip()
    domain = os.environ.get("METERED_DOMAIN", "").strip()
    if not key or not domain:
        return []
    try:
        url = f"https://{domain}/api/v1/turn/credentials?apiKey={key}"
        with urllib.request.urlopen(urllib.request.Request(url), timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if isinstance(data, list) and data:
            _METERED_CACHE.update(at=time.time(), data=data)
            return data
    except Exception as e:
        print(f"[ice] metered: {e}")
    return _METERED_CACHE["data"]


def handler(event: dict, context) -> dict:
    """
    Возвращает список ICE-серверов (STUN + TURN) для звонков WebRTC.

    TURN-сервер критичен: без рабочего relay голос не проходит, когда
    собеседники в разных сетях (мобильный интернет). Приоритет — Cloudflare
    (надёжный промышленный relay). Затем свежие креды Metered и публичные
    резервные TURN как запас.
    """
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    user_id = (event.get("headers") or {}).get("X-User-Id") or ""
    try:
        if int(user_id) <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return nova_auth.denied(CORS)
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    try:
        allowed = nova_auth.check(conn.cursor(), event, user_id)
    finally:
        conn.close()
    if not allowed:
        return nova_auth.denied(CORS)

    ice_servers = []

    # 0. Свой TURN turn.novaa.pro — приоритетный
    own = _own_turn()
    if own:
        ice_servers.append(own)

    # 1. Cloudflare — резервный промышленный relay
    cf = _cloudflare_turn()
    if cf:
        ice_servers += cf

    # 2. STUN (для прямого пути в одной сети)
    ice_servers += [
        {"urls": "stun:stun.l.google.com:19302"},
        {"urls": "stun:stun.cloudflare.com:3478"},
    ]

    # 3. Metered — свежие креды, если задан ключ
    ice_servers += _metered()

    return {
        "statusCode": 200,
        "headers": CORS,
        "body": json.dumps({"iceServers": ice_servers}, ensure_ascii=False),
    }