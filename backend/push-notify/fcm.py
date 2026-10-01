import json
import os
import time
import threading
import urllib.request
import urllib.error

from google.oauth2 import service_account
from google.auth.transport.requests import Request

_SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]
_cache = {"creds": None, "project": None}
_lock = threading.Lock()


def _parse(raw: str):
    raw = (raw or "").strip().lstrip("\ufeff")
    if not raw:
        return None
    if raw[:1] in ("'", '"') and raw[-1:] == raw[:1]:
        raw = raw[1:-1].strip()
    if "{" in raw and "}" in raw:
        raw = raw[raw.index("{"):raw.rindex("}") + 1]
    for candidate in (raw, raw.replace("\\n", "\n"), raw.replace("\n", "\\n")):
        try:
            data = json.loads(candidate, strict=False)
            if isinstance(data, str):
                data = json.loads(data, strict=False)
            if isinstance(data, dict):
                pk = data.get("private_key")
                if isinstance(pk, str) and "\\n" in pk:
                    data["private_key"] = pk.replace("\\n", "\n")
                return data
        except Exception:
            continue
    try:
        import base64
        return _parse(base64.b64decode(raw).decode("utf-8"))
    except Exception:
        return None


def _service_info():
    return _parse(os.environ.get("FIREBASE_SERVICE_ACCOUNT") or "")


def diagnose() -> dict:
    raw = (os.environ.get("FIREBASE_SERVICE_ACCOUNT") or "")
    s = raw.strip()
    info = _parse(raw)
    return {
        "length": len(s),
        "starts_with_brace": s.startswith("{"),
        "ends_with_brace": s.endswith("}"),
        "parsed": info is not None,
        "has_keys": sorted(k for k in (info or {}).keys() if k in ("type", "project_id", "private_key", "client_email")),
        "type": (info or {}).get("type"),
    }


def enabled() -> bool:
    return _service_info() is not None


def _token():
    with _lock:
        if _cache["creds"] is None:
            info = _service_info()
            if not info:
                return None, None
            _cache["creds"] = service_account.Credentials.from_service_account_info(info, scopes=_SCOPES)
            _cache["project"] = info.get("project_id")
        creds = _cache["creds"]
        if not creds.valid:
            creds.refresh(Request())
        return creds.token, _cache["project"]


def send_one(token: str, title: str, body: str, data: dict, is_call: bool = False) -> str:
    """Возвращает ok, stale (токен мёртв) или error."""
    access, project = _token()
    if not access or not project:
        return "error"
    str_data = {k: str(v) for k, v in (data or {}).items() if v is not None}
    str_data.setdefault("title", title)
    str_data.setdefault("body", body)
    message = {
        "token": token,
        "notification": {"title": title, "body": body},
        "data": str_data,
        "android": {
            "priority": "HIGH",
            "ttl": "30s" if is_call else "86400s",
            "notification": {
                "channel_id": "calls" if is_call else "messages",
                "sound": "default",
                "default_vibrate_timings": True,
                "visibility": "PUBLIC",
                "notification_priority": "PRIORITY_MAX" if is_call else "PRIORITY_HIGH",
                "tag": str_data.get("tag", ""),
                "color": "#8b5cf6",
            },
        },
    }
    req = urllib.request.Request(
        f"https://fcm.googleapis.com/v1/projects/{project}/messages:send",
        data=json.dumps({"message": message}).encode("utf-8"),
        headers={"Authorization": f"Bearer {access}", "Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=5)
        return "ok"
    except urllib.error.HTTPError as e:
        if e.code in (404, 410):
            return "stale"
        try:
            detail = e.read().decode("utf-8", "ignore")
        except Exception:
            detail = ""
        if "UNREGISTERED" in detail or "registration-token-not-registered" in detail:
            return "stale"
        print(f"[fcm] error {e.code}: {detail[:300]}")
        return "error"
    except Exception as e:
        print(f"[fcm] error: {e}")
        return "error"


def send_many(tokens, title, body, data, is_call=False):
    """Параллельная отправка. Возвращает (sent, stale_tokens)."""
    if not tokens or not enabled():
        return 0, []
    results = {}

    def _one(t):
        results[t] = send_one(t, title, body, data, is_call)

    threads = [threading.Thread(target=_one, args=(t,), daemon=True) for t in tokens]
    for th in threads:
        th.start()
    deadline = time.time() + 6
    for th in threads:
        th.join(timeout=max(0.1, deadline - time.time()))
    sent = sum(1 for r in results.values() if r == "ok")
    stale = [t for t, r in results.items() if r == "stale"]
    return sent, stale