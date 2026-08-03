import os
import json
import time
import hmac
import hashlib
import base64
import urllib.request

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
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


def _own_turn():
    """Свой TURN-сервер turn.novaa.pro на coturn с use-auth-secret.
    Логин/пароль временные: username = unixtime истечения, пароль = HMAC-SHA1
    от username на static-auth-secret (стандарт coturn REST API)."""
    host = os.environ.get("TURN_HOST", "").strip()
    secret = os.environ.get("TURN_SECRET", "").strip()
    if not host or not secret:
        return None
    expiry = int(time.time()) + 24 * 3600
    username = str(expiry)
    digest = hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()
    credential = base64.b64encode(digest).decode()
    return {
        "urls": [
            f"turn:{host}:3478?transport=udp",
            f"turn:{host}:3478?transport=tcp",
            f"turns:{host}:5349?transport=tcp",
        ],
        "username": username,
        "credential": credential,
    }


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
    metered_key = os.environ.get("METERED_API_KEY", "").strip()
    metered_domain = os.environ.get("METERED_DOMAIN", "").strip()
    if metered_key and metered_domain:
        try:
            url = f"https://{metered_domain}/api/v1/turn/credentials?apiKey={metered_key}"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list) and data:
                ice_servers += data
        except Exception:
            pass

    # 4. Резервные публичные TURN
    ice_servers += [
        {
            "urls": [
                "turn:openrelay.metered.ca:443",
                "turn:openrelay.metered.ca:443?transport=tcp",
                "turns:openrelay.metered.ca:443",
            ],
            "username": "openrelayproject",
            "credential": "openrelayproject",
        },
    ]

    return {
        "statusCode": 200,
        "headers": CORS,
        "body": json.dumps({"iceServers": ice_servers}, ensure_ascii=False),
    }