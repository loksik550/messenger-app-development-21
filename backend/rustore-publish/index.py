import os
import json
import time
import base64
import datetime

import psycopg2
import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67547116_messenger_app_develo")
PACKAGE = "ru.nova.messenger"
REPO = "loksik550/messenger-app-development-21"
API = "https://public-api.rustore.ru"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Dev-Token",
}

STATUS_RU = {
    "ACTIVE": "Опубликована",
    "PARTIAL_ACTIVE": "Опубликована для части пользователей",
    "READY_FOR_PUBLICATION": "Одобрена, ждёт публикации",
    "PREVIOUS_ACTIVE": "Предыдущая версия",
    "ARCHIVED": "В архиве",
    "REJECTED_BY_MODERATOR": "Отклонена модератором",
    "TAKEN_FOR_MODERATION": "Принята на модерацию",
    "MODERATION": "На модерации",
    "AUTO_CHECK": "Автопроверка антивирусом",
    "AUTO_CHECK_FAILED": "Не прошла автопроверку",
    "DRAFT": "Черновик",
    "DELETED_DRAFT": "Черновик удалён",
    "REJECTED_BY_SECURITY": "Отклонена службой безопасности",
}


def ok(data):
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(msg, code=400):
    return {"statusCode": code, "headers": CORS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def auth_admin(event):
    token = (event.get("headers") or {}).get("X-Dev-Token") or ""
    if not token:
        return None
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        f"SELECT a.id, a.email, a.role FROM {SCHEMA}.dev_sessions s "
        f"JOIN {SCHEMA}.dev_admins a ON a.id = s.admin_id "
        f"WHERE s.token = %s AND s.expires_at > %s AND a.disabled = false",
        (token, int(time.time())),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "role": row[2]}


def audit(admin, details, ip):
    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.dev_audit (admin_id, admin_email, action, details, ip_addr) "
            f"VALUES (%s, %s, %s, %s, %s)",
            (admin["id"], admin["email"], "rustore_publish", details[:500], ip),
        )
        conn.close()
    except Exception as e:
        print(f"[audit] {e}")


class RuStoreError(Exception):
    pass


def rustore_token() -> str:
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
    data = r.json() if r.content else {}
    jwe = ((data or {}).get("body") or {}).get("jwe")
    if not jwe:
        raise RuStoreError(f"RuStore не принял ключ: {(data or {}).get('message') or r.status_code}")
    return jwe


def rs(method, path, token, **kw):
    r = requests.request(method, f"{API}{path}", headers={"Public-Token": token}, timeout=kw.pop("timeout", 30), **kw)
    try:
        data = r.json()
    except Exception:
        data = {"code": "error", "message": r.text[:300]}
    if r.status_code >= 400 or (data.get("code") not in (None, "OK")):
        raise RuStoreError(data.get("message") or f"Ошибка RuStore ({r.status_code})")
    return data


def list_versions(token, size=10):
    d = rs("GET", f"/public/v1/application/{PACKAGE}/version?page=0&size={size}&filterTestingType=ALL", token)
    items = ((d.get("body") or {}).get("content")) or []
    return [{
        "version_id": v.get("versionId"),
        "name": v.get("versionName"),
        "code": v.get("versionCode"),
        "status": v.get("versionStatus"),
        "status_ru": STATUS_RU.get(v.get("versionStatus"), v.get("versionStatus")),
        "published_at": v.get("publishDateTime"),
        "sent_at": v.get("sendDateForModer"),
    } for v in items]


def latest_release():
    r = requests.get(f"https://api.github.com/repos/{REPO}/releases/latest", timeout=15,
                     headers={"Accept": "application/vnd.github+json"})
    if r.status_code != 200:
        raise RuStoreError("Не удалось получить последний релиз из GitHub")
    rel = r.json()
    aab = next((a for a in rel.get("assets", []) if a.get("name", "").endswith(".aab")), None)
    return {
        "tag": rel.get("tag_name"),
        "published_at": rel.get("published_at"),
        "aab_name": aab.get("name") if aab else None,
        "aab_url": aab.get("browser_download_url") if aab else None,
        "aab_size": aab.get("size") if aab else 0,
    }


def handler(event: dict, context) -> dict:
    """Отправка последней сборки Nova из GitHub в RuStore на модерацию и просмотр статуса версий."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body = json.loads(event.get("body") or "{}")
    action = body.get("action") or ""
    ip = ((event.get("requestContext") or {}).get("identity") or {}).get("sourceIp") or ""

    if action == "health":
        have = bool(os.environ.get("RUSTORE_KEY_ID") and os.environ.get("RUSTORE_PRIVATE_KEY"))
        if not have:
            return ok({"configured": False, "auth": False, "message": "Ключи не заданы"})
        kid = (os.environ.get("RUSTORE_KEY_ID") or "").strip()
        pk = "".join((os.environ.get("RUSTORE_PRIVATE_KEY") or "").split())
        diag = {
            "key_id_len": len(kid),
            "key_id_digits_only": kid.isdigit(),
            "key_id_looks_like_private_key": kid.startswith("MII") or len(kid) > 40,
            "private_key_len": len(pk),
            "private_key_starts_ok": pk.startswith("MII") or "BEGIN" in pk,
        }
        try:
            rustore_token()
            return ok({"configured": True, "auth": True, **diag})
        except RuStoreError as e:
            return ok({"configured": True, "auth": False, "message": str(e), **diag})

    admin = auth_admin(event)
    if not admin:
        return err("Требуется вход", 401)
    if admin["role"] not in ("owner", "admin", "developer"):
        return err("Недостаточно прав для публикации", 403)

    configured = bool(os.environ.get("RUSTORE_KEY_ID") and os.environ.get("RUSTORE_PRIVATE_KEY"))

    try:
        if action == "status":
            rel = None
            try:
                rel = latest_release()
            except RuStoreError as e:
                rel = {"error": str(e)}
            if not configured:
                return ok({"configured": False, "release": rel, "versions": []})
            token = rustore_token()
            return ok({"configured": True, "release": rel, "versions": list_versions(token)})

        if action == "publish":
            if not configured:
                return err("Сначала добавьте ключи RuStore")
            rel = latest_release()
            if not rel.get("aab_url"):
                return err(f"В релизе {rel.get('tag')} нет файла .aab — дождитесь окончания сборки")
            token = rustore_token()

            versions = list_versions(token, 20)
            busy = [v for v in versions if v["status"] in ("MODERATION", "TAKEN_FOR_MODERATION", "AUTO_CHECK")]
            if busy and not body.get("force"):
                return err(f"Версия {busy[0]['name']} уже на проверке ({busy[0]['status_ru']}). "
                           f"Дождитесь решения RuStore, затем отправляйте новую.", 409)

            tag_name = (rel.get("tag") or "").lstrip("v")
            same = next((v for v in versions if str(v.get("name") or "") == tag_name
                         and v["status"] not in ("DRAFT", "DELETED_DRAFT")), None)
            if same and not body.get("force"):
                return err(f"Версия {tag_name} уже отправлялась в RuStore ({same['status_ru']}). "
                           f"Соберите новый релиз в GitHub и отправьте его.", 409)

            for v in versions:
                if v["status"] == "DRAFT":
                    rs("DELETE", f"/public/v1/application/{PACKAGE}/version/{v['version_id']}", token)

            whats_new = (body.get("whats_new") or "").strip()[:5000] or "Исправления и улучшения."
            draft = rs("POST", f"/public/v1/application/{PACKAGE}/version", token, json={
                "whatsNew": whats_new,
                "publishType": "INSTANTLY" if body.get("auto_publish", True) else "MANUAL",
            })
            version_id = draft.get("body")
            if isinstance(version_id, dict):
                version_id = version_id.get("versionId")
            if not version_id:
                raise RuStoreError("RuStore не создал черновик версии")

            file_resp = requests.get(rel["aab_url"], timeout=25)
            if file_resp.status_code != 200 or len(file_resp.content) < 100000:
                raise RuStoreError("Не удалось скачать .aab из GitHub")

            rs("POST", f"/public/v1/application/{PACKAGE}/version/{version_id}/aab", token,
               files={"file": (rel["aab_name"], file_resp.content, "application/octet-stream")}, timeout=60)
            rs("POST", f"/public/v1/application/{PACKAGE}/version/{version_id}/commit", token)

            audit(admin, f"Отправлена {rel['tag']} в RuStore (версия {version_id})", ip)
            return ok({"ok": True, "tag": rel["tag"], "version_id": version_id})

        return err("Неизвестное действие", 404)
    except RuStoreError as e:
        print(f"[rustore] {action}: {e}")
        return err(str(e), 502)