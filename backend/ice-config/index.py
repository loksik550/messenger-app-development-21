import os
import json
import urllib.request

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
}


def handler(event: dict, context) -> dict:
    """
    Возвращает список ICE-серверов (STUN + TURN) для звонков WebRTC.

    TURN-сервер критичен: без рабочего relay голос не проходит, когда оба
    собеседника за NAT (мобильный интернет). Если задан секрет METERED_API_KEY —
    берём свежие рабочие TURN-креды у Metered.ca. Иначе отдаём набор публичных
    релеев на :443 (проходят через мобильных операторов) + STUN.
    """
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    ice_servers = [
        {"urls": "stun:stun.l.google.com:19302"},
        {"urls": "stun:stun1.l.google.com:19302"},
        {"urls": "stun:stun.cloudflare.com:3478"},
    ]

    metered_key = os.environ.get("METERED_API_KEY", "").strip()
    metered_domain = os.environ.get("METERED_DOMAIN", "").strip()
    if metered_key and metered_domain:
        try:
            url = f"https://{metered_domain}/api/v1/turn/credentials?apiKey={metered_key}"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list) and data:
                ice_servers = data
        except Exception:
            pass

    # ВСЕГДА добавляем резервные публичные TURN (не вместо, а В ДОПОЛНЕНИЕ).
    # Диагностика показала: relay Metered пропускает ICE-пробы, но режет DTLS/медиа
    # (звук=0 при relay/udp). Поэтому даём браузеру ещё несколько независимых
    # ретрансляторов — он сам выберет тот, через который реально пойдёт звук.
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
        {
            "urls": [
                "turn:relay1.expressturn.com:3478",
                "turn:relay1.expressturn.com:3478?transport=tcp",
            ],
            "username": "ef2X8ODBQZ8PXHNXQL",
            "credential": "ymS3tZmVQ0kR6Xt3",
        },
    ]

    return {
        "statusCode": 200,
        "headers": CORS,
        "body": json.dumps({"iceServers": ice_servers}, ensure_ascii=False),
    }