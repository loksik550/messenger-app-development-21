import os
import time
import base64
import datetime

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

PACKAGE = "ru.nova.messenger"
API = "https://public-api.rustore.ru"

_token_cache = {"token": "", "exp": 0.0}


class RuStoreError(Exception):
    pass


def configured() -> bool:
    return bool(os.environ.get("RUSTORE_KEY_ID") and os.environ.get("RUSTORE_PRIVATE_KEY"))


def fresh_token() -> str:
    key_id = (os.environ.get("RUSTORE_KEY_ID") or "").strip()
    raw = (os.environ.get("RUSTORE_PRIVATE_KEY") or "").strip()
    if not key_id or not raw:
        raise RuStoreError("Не заданы ключи RuStore — добавьте RUSTORE_KEY_ID и RUSTORE_PRIVATE_KEY")
    raw = raw.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "")
    raw = "".join(raw.split())
    try:
        key = serialization.load_der_private_key(base64.b64decode(raw), password=None)
    except Exception:
        raise RuStoreError("Приватный ключ RuStore не читается — скопируйте его заново целиком")
    ts = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds")
    sig = key.sign((key_id + ts).encode(), padding.PKCS1v15(), hashes.SHA512())
    r = requests.post(
        f"{API}/public/auth/",
        json={"keyId": key_id, "timestamp": ts, "signature": base64.b64encode(sig).decode()},
        timeout=15,
    )
    try:
        data = r.json() if r.content else {}
    except Exception:
        data = {}
    jwe = ((data or {}).get("body") or {}).get("jwe")
    if not jwe:
        raise RuStoreError(f"RuStore не принял ключ: {(data or {}).get('message') or r.status_code}")
    return jwe


def token() -> str:
    now = time.time()
    if _token_cache["token"] and _token_cache["exp"] > now:
        return _token_cache["token"]
    t = fresh_token()
    _token_cache["token"] = t
    _token_cache["exp"] = now + 600
    return t


def rs(method, path, tok, **kw):
    timeout = kw.pop("timeout", 30)
    r = requests.request(method, f"{API}{path}", headers={"Public-Token": tok}, timeout=timeout, **kw)
    try:
        data = r.json()
    except Exception:
        data = {"code": "error", "message": r.text[:300]}
    if not isinstance(data, dict):
        data = {"body": data}
    if r.status_code == 403:
        raise RuStoreError("У ключа RuStore нет доступа к этому действию — проверьте галочки методов в консоли RuStore")
    if r.status_code >= 400 or (data.get("code") not in (None, "OK")):
        raise RuStoreError(data.get("message") or f"Ошибка RuStore ({r.status_code})")
    return data


def page_items(body):
    if isinstance(body, list):
        return body
    if isinstance(body, dict):
        return body.get("content") or []
    return []
