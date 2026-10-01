import os
import json
import time

import psycopg2
import requests

from rustore import PACKAGE, RuStoreError, configured, token, fresh_token, rs, page_items
import reviews
import screens

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67547116_messenger_app_develo")
REPO = "loksik550/messenger-app-development-21"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Dev-Token",
}

PUBLISH_ROLES = ("owner", "admin", "developer")
REVIEW_ROLES = ("owner", "admin", "moderator", "developer")

STATUS_RU = {
    "ACTIVE": "Опубликована",
    "PARTIAL_ACTIVE": "Опубликована для части пользователей",
    "ALPHA_ACTIVE": "Закрытый тест (альфа)",
    "BETA_ACTIVE": "Открытый тест (бета)",
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
    headers = event.get("headers") or {}
    token_ = headers.get("X-Dev-Token") or headers.get("x-dev-token") or ""
    if not token_:
        return None
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        f"SELECT a.id, a.email, a.role FROM {SCHEMA}.dev_sessions s "
        f"JOIN {SCHEMA}.dev_admins a ON a.id = s.admin_id "
        f"WHERE s.token = %s AND s.expires_at > %s AND a.disabled = false",
        (token_, int(time.time())),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "role": row[2]}


def audit(admin, action, details, ip):
    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.dev_audit (admin_id, admin_email, action, details, ip_addr) "
            f"VALUES (%s, %s, %s, %s, %s)",
            (admin["id"], admin["email"], action, details[:500], ip),
        )
        conn.close()
    except Exception as e:
        print(f"[audit] {e}")


def list_versions(tok, size=10):
    d = rs("GET", f"/public/v1/application/{PACKAGE}/version?page=0&size={size}&filterTestingType=ALL", tok)
    items = page_items(d.get("body"))
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


def store_screens(tok, versions):
    active = next((v for v in versions if v["status"] in ("ACTIVE", "PARTIAL_ACTIVE")), None) \
        or next((v for v in versions if v["status"] in ("ALPHA_ACTIVE", "BETA_ACTIVE")), None)
    if not active:
        return []
    try:
        return screens.current_in_store(tok, active["version_id"])
    except RuStoreError as e:
        print(f"[screens] store: {e}")
        return []


def do_publish(body, admin, ip):
    if not configured():
        return err("Сначала добавьте ключи RuStore")
    rel = latest_release()
    if not rel.get("aab_url"):
        return err(f"В релизе {rel.get('tag')} нет файла .aab — дождитесь окончания сборки")
    tok = token()

    versions = list_versions(tok, 20)
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

    saved = screens.list_saved()
    if 0 < len(saved) < screens.MIN_SCREENS:
        return err(f"В панели загружено {len(saved)} скриншота, а RuStore нужно минимум {screens.MIN_SCREENS}. "
                   f"Добавьте ещё или удалите все — тогда останутся прежние.")

    for v in versions:
        if v["status"] == "DRAFT":
            rs("DELETE", f"/public/v1/application/{PACKAGE}/version/{v['version_id']}", tok)

    whats_new = (body.get("whats_new") or "").strip()[:5000] or "Исправления и улучшения."
    draft = rs("POST", f"/public/v1/application/{PACKAGE}/version", tok, json={
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

    rs("POST", f"/public/v1/application/{PACKAGE}/version/{version_id}/aab", tok,
       files={"file": (rel["aab_name"], file_resp.content, "application/octet-stream")}, timeout=60)

    shots = screens.push_to_draft(tok, version_id)

    rs("POST", f"/public/v1/application/{PACKAGE}/version/{version_id}/commit", tok)

    audit(admin, "rustore_publish",
          f"Отправлена {rel['tag']} в RuStore (версия {version_id}, скриншотов: {shots or 'прежние'})", ip)
    return ok({"ok": True, "tag": rel["tag"], "version_id": version_id, "screens": shots})


def handler(event: dict, context) -> dict:
    """RuStore для Nova: отправка сборки на модерацию, рейтинг, отзывы с ответами и скриншоты карточки."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return err("Неверный формат запроса")
    if not isinstance(body, dict):
        return err("Неверный формат запроса")
    action = body.get("action") or ""
    ip = ((event.get("requestContext") or {}).get("identity") or {}).get("sourceIp") or ""

    if action == "health":
        if not configured():
            return ok({"configured": False, "auth": False, "message": "Ключи не заданы"})
        kid = (os.environ.get("RUSTORE_KEY_ID") or "").strip()
        diag = {"key_id_len": len(kid), "key_id_digits_only": kid.isdigit()}
        try:
            fresh_token()
            return ok({"configured": True, "auth": True, **diag})
        except RuStoreError as e:
            return ok({"configured": True, "auth": False, "message": str(e), **diag})

    admin = auth_admin(event)
    if not admin:
        return err("Требуется вход", 401)

    is_review = action.startswith("reviews") or action.startswith("reply")
    allowed = REVIEW_ROLES if is_review else PUBLISH_ROLES
    if admin["role"] not in allowed:
        return err("Недостаточно прав для этого раздела", 403)

    try:
        if action == "status":
            rel = None
            try:
                rel = latest_release()
            except RuStoreError as e:
                rel = {"error": str(e)}
            saved = screens.public_list()
            if not configured():
                return ok({"configured": False, "release": rel, "versions": [], "rating": None,
                           "screens": saved, "store_screens": []})
            tok = token()
            versions = list_versions(tok)
            rating = None
            try:
                rating = reviews.rating(tok)
            except RuStoreError as e:
                rating = {"error": str(e)}
            return ok({"configured": True, "release": rel, "versions": versions, "rating": rating,
                       "screens": saved, "store_screens": store_screens(tok, versions)})

        if action == "publish":
            return do_publish(body, admin, ip)

        if action == "screens_add":
            new_id = screens.add(body.get("data") or "")
            audit(admin, "rustore_screens", f"Добавлен скриншот #{new_id}", ip)
            return ok({"ok": True, "id": new_id, "screens": screens.public_list()})

        if action == "screens_delete":
            sid = body.get("id")
            if sid is None:
                return err("Не указан скриншот")
            screens.remove(int(sid))
            audit(admin, "rustore_screens", f"Удалён скриншот #{sid}", ip)
            return ok({"ok": True, "screens": screens.public_list()})

        if action == "screens_reorder":
            ids = body.get("ids") or []
            if not isinstance(ids, list):
                return err("Неверный порядок")
            screens.reorder(ids)
            return ok({"ok": True, "screens": screens.public_list()})

        if not configured():
            return err("Сначала добавьте ключи RuStore")

        if action == "reviews":
            tok = token()
            data = reviews.list_reviews(tok, body.get("page") or 0, body.get("size") or 50)
            rating = None
            if not body.get("page"):
                try:
                    rating = reviews.rating(tok)
                except RuStoreError as e:
                    rating = {"error": str(e)}
            return ok({**data, "rating": rating})

        if action == "reply":
            cid = body.get("comment_id")
            if not cid:
                return err("Не указан отзыв")
            new_id = reviews.reply(token(), cid, body.get("text"))
            audit(admin, "rustore_reply", f"Ответ на отзыв {cid}", ip)
            return ok({"ok": True, "id": new_id})

        if action == "reply_edit":
            fid = body.get("feedback_id")
            if not fid:
                return err("Не указан ответ")
            new_id = reviews.edit_reply(token(), fid, body.get("text"))
            audit(admin, "rustore_reply", f"Изменён ответ {fid}", ip)
            return ok({"ok": True, "id": new_id})

        if action == "reply_delete":
            fid = body.get("feedback_id")
            if not fid:
                return err("Не указан ответ")
            reviews.delete_reply(token(), fid)
            audit(admin, "rustore_reply", f"Удалён ответ {fid}", ip)
            return ok({"ok": True})

        return err("Неизвестное действие", 404)
    except RuStoreError as e:
        print(f"[rustore] {action}: {e}")
        return err(str(e), 502)
    except (ValueError, TypeError) as e:
        print(f"[rustore] {action} bad input: {e}")
        return err("Неверные данные запроса")