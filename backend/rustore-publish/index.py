import os
import json
import time

import psycopg2
import requests

from rustore import PACKAGE, RuStoreError, configured, token, fresh_token, rs, page_items
import reviews
import screens
import icon

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
        "testing": (v.get("testingType") or "RELEASE").upper(),
        "whats_new": v.get("whatsNew") or "",
    } for v in items]


REJECT_HINTS = {
    "REJECTED_BY_MODERATOR": "RuStore не отдаёт текст замечаний через API — он приходит письмом на почту аккаунта разработчика и виден в консоли RuStore на странице версии.",
    "REJECTED_BY_SECURITY": "Служба безопасности RuStore нашла проблему в сборке. Подробности — в письме на почту аккаунта и в консоли RuStore.",
    "AUTO_CHECK_FAILED": "Антивирусная проверка не пропустила файл. Обычно помогает пересобрать приложение без лишних разрешений и сторонних SDK.",
}


def load_notes(ids):
    ids = [int(i) for i in ids if i]
    if not ids:
        return {}
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        f"SELECT version_id, note, admin_email, updated_at FROM {SCHEMA}.rustore_version_notes "
        f"WHERE version_id = ANY(%s)", (ids,),
    )
    rows = cur.fetchall()
    conn.close()
    return {r[0]: {"note": r[1], "by": r[2], "at": r[3]} for r in rows}


def save_note(version_id, note, admin):
    note = (note or "").strip()[:3000]
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    cur = conn.cursor()
    if note:
        cur.execute(
            f"INSERT INTO {SCHEMA}.rustore_version_notes (version_id, note, admin_email, updated_at) "
            f"VALUES (%s, %s, %s, NOW()) ON CONFLICT (version_id) DO UPDATE "
            f"SET note = EXCLUDED.note, admin_email = EXCLUDED.admin_email, updated_at = NOW()",
            (int(version_id), note, admin["email"]),
        )
    else:
        cur.execute(f"DELETE FROM {SCHEMA}.rustore_version_notes WHERE version_id = %s", (int(version_id),))
    conn.close()


def enrich(versions):
    notes = {}
    try:
        notes = load_notes([v["version_id"] for v in versions])
    except Exception as e:
        print(f"[notes] {e}")
    for v in versions:
        v["reject_hint"] = REJECT_HINTS.get(v["status"])
        n = notes.get(v["version_id"])
        v["note"] = n["note"] if n else ""
        v["note_by"] = n["by"] if n else ""
    return versions


def has_release(versions):
    return any(v["status"] in ("ACTIVE", "PARTIAL_ACTIVE", "PREVIOUS_ACTIVE", "READY_FOR_PUBLICATION")
               and v.get("testing") == "RELEASE" for v in versions)


def latest_release():
    r = requests.get(f"https://api.github.com/repos/{REPO}/releases/latest", timeout=15,
                     headers=_gh_headers())
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


def _gh_headers():
    tok = (os.environ.get("GITHUB_RELEASE_TOKEN") or "").strip()
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    return h


def _parse_ver(name):
    name = str(name or "").strip().lstrip("vV")
    parts = name.split(".")
    if not parts or not all(p.isdigit() for p in parts):
        return None
    nums = [int(p) for p in parts][:3]
    while len(nums) < 3:
        nums.append(0)
    return tuple(nums)


def next_version(rustore_names=()):
    r = requests.get(f"https://api.github.com/repos/{REPO}/tags?per_page=100", timeout=10, headers=_gh_headers())
    tags = [t.get("name") for t in (r.json() if r.status_code == 200 else [])]
    known = [v for v in (_parse_ver(t) for t in list(tags) + list(rustore_names)) if v]
    top = max(known) if known else (1, 1, 1)
    return f"{top[0]}.{top[1]}.{top[2] + 1}", set(tags)


def gh_diagnose():
    tok = (os.environ.get("GITHUB_RELEASE_TOKEN") or "").strip()
    if not tok:
        return {"ok": False, "reason": "no_token", "text": "Ключ GITHUB_RELEASE_TOKEN не добавлен в секреты проекта"}
    h = _gh_headers()
    me = requests.get("https://api.github.com/user", timeout=10, headers=h)
    if me.status_code == 401:
        return {"ok": False, "reason": "bad_token",
                "text": "GitHub не принял ключ: он неверный или истёк. Создайте новый и замените GITHUB_RELEASE_TOKEN"}
    login = (me.json() or {}).get("login", "") if me.status_code == 200 else ""
    repo = requests.get(f"https://api.github.com/repos/{REPO}", timeout=10, headers=h)
    if repo.status_code == 404:
        return {"ok": False, "reason": "no_repo", "login": login,
                "text": f"Ключ не видит репозиторий {REPO}. В настройках ключа: Repository access → "
                        f"Only select repositories → выберите {REPO.split('/')[1]}"}
    perms = (repo.json() or {}).get("permissions") or {}
    if perms and not perms.get("push"):
        return {"ok": False, "reason": "read_only", "login": login,
                "text": "У ключа есть только чтение. В настройках ключа: Permissions → Repository permissions → "
                        "Contents → выберите «Read and write», затем нажмите Update"}
    return {"ok": True, "login": login, "text": "Ключ видит репозиторий"}


def bump_release(admin, ip):
    if not (os.environ.get("GITHUB_RELEASE_TOKEN") or "").strip():
        return err("Добавьте ключ GITHUB_RELEASE_TOKEN в секреты проекта — без него панель не может запустить сборку")
    names = []
    if configured():
        try:
            names = [v.get("name") for v in list_versions(token(), 20)]
        except RuStoreError as e:
            print(f"[bump] versions: {e}")
    ver, tags = next_version(names)
    while f"v{ver}" in tags:
        a, b, c = _parse_ver(ver)
        ver = f"{a}.{b}.{c + 1}"
    h = _gh_headers()
    repo = requests.get(f"https://api.github.com/repos/{REPO}", timeout=10, headers=h)
    if repo.status_code != 200:
        return err("GitHub не пускает: проверьте ключ GITHUB_RELEASE_TOKEN (доступ к репозиторию)", 502)
    branch = repo.json().get("default_branch") or "main"
    ref = requests.get(f"https://api.github.com/repos/{REPO}/git/ref/heads/{branch}", timeout=10, headers=h)
    if ref.status_code != 200:
        return err("Не удалось получить последнюю версию кода из GitHub", 502)
    sha = ref.json()["object"]["sha"]
    cr = requests.post(f"https://api.github.com/repos/{REPO}/git/refs", timeout=10, headers=h,
                       json={"ref": f"refs/tags/v{ver}", "sha": sha})
    if cr.status_code not in (200, 201):
        msg = (cr.json() or {}).get("message", "") if cr.headers.get("content-type", "").startswith("application/json") else ""
        print(f"[bump] create tag {cr.status_code}: {cr.text[:300]}")
        if cr.status_code in (401, 403, 404):
            d = gh_diagnose()
            if not d["ok"]:
                return err(d["text"], 502)
            if "not accessible by personal access token" in (msg or "").lower():
                return err("У ключа GitHub только право чтения. Откройте github.com/settings/personal-access-tokens → "
                           "ваш ключ → Edit → Repository permissions → Contents → «Read and write» → Update. "
                           "Ключ в секретах менять не нужно — после Update нажмите «Собрать» ещё раз.", 502)
            if "workflow" in (msg or "").lower():
                return err("GitHub требует право Workflows. В настройках ключа: Permissions → Workflows → «Read and write»", 502)
            return err(f"GitHub отказал в создании версии: {msg or cr.status_code}. "
                       f"Проверьте, что у ключа Contents = Read and write и нет защиты тегов в репозитории", 502)
        return err(f"GitHub не создал версию v{ver}: {msg or cr.status_code}", 502)
    audit(admin, "rustore_bump", f"Запущена сборка версии v{ver}", ip)
    return ok({"ok": True, "tag": f"v{ver}", "version": ver})


def build_state(tag):
    r = requests.get(f"https://api.github.com/repos/{REPO}/actions/runs?event=push&per_page=15",
                     timeout=10, headers=_gh_headers())
    if r.status_code != 200:
        return {"state": "unknown"}
    for run in r.json().get("workflow_runs", []):
        if run.get("head_branch") == tag:
            if run.get("status") != "completed":
                return {"state": "building", "url": run.get("html_url")}
            return {"state": "success" if run.get("conclusion") == "success" else "failed",
                    "url": run.get("html_url")}
    return {"state": "queued"}


def sync_live_version(versions):
    live = next((v for v in versions if v["status"] in ("ACTIVE", "PARTIAL_ACTIVE")
                 and v.get("testing") == "RELEASE" and v.get("name")), None)
    if not live:
        return
    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(f"SELECT value FROM {SCHEMA}.dev_settings WHERE key = 'app_latest_version'")
        r = cur.fetchone()
        if not r or r[0] != str(live["name"]):
            now = int(time.time())
            for k, v in (("app_latest_version", str(live["name"])), ("app_whats_new", (live.get("whats_new") or "")[:1000])):
                cur.execute(
                    f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_at) VALUES (%s, %s, %s) "
                    f"ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at",
                    (k, v, now),
                )
        conn.close()
    except Exception as e:
        print(f"[live_version] {e}")


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
        if v["status"] == "DRAFT" and _up_state(v["version_id"]) == "done":
            res = do_commit({"version_id": v["version_id"], "tag": rel.get("tag") or ""}, admin, ip)
            try:
                data = json.loads(res.get("body") or "{}")
            except Exception:
                data = {}
            if res.get("statusCode") == 200 and data.get("ok"):
                print(f"[publish] черновик {v['version_id']} с загруженным файлом отправлен на модерацию")
                return ok({"ok": True, "stage": "done", "already_done": True, "tag": rel.get("tag"),
                           "version_id": v["version_id"], "screens": data.get("screens", 0), "icon": data.get("icon", False)})
    for v in versions:
        if v["status"] == "DRAFT":
            rs("DELETE", f"/public/v1/application/{PACKAGE}/version/{v['version_id']}", tok)

    whats_new = (body.get("whats_new") or "").strip()[:5000]
    if len(whats_new) < 10:
        return err("Заполните «Что нового» — хотя бы одно предложение")
    try:
        draft = rs("POST", f"/public/v1/application/{PACKAGE}/version", tok, json={
        "whatsNew": whats_new,
            "publishType": "INSTANTLY" if body.get("auto_publish", True) else "MANUAL",
        })
    except RuStoreError as e:
        if "active version" in str(e).lower():
            raise RuStoreError("У приложения ещё нет одобренной релизной версии в RuStore, а через API можно отправлять "
                               "только обновления. Первую публичную версию нужно один раз загрузить вручную в консоли "
                               "RuStore — после этого кнопка в панели будет отправлять обновления сама.")
        raise
    version_id = draft.get("body")
    if isinstance(version_id, dict):
        version_id = version_id.get("versionId")
    if not version_id:
        raise RuStoreError("RuStore не создал черновик версии")
    return ok({"ok": True, "stage": "draft", "tag": rel["tag"], "version_id": version_id})


def do_preflight(body):
    checks = []

    def add(ok_, title, hint=""):
        checks.append({"ok": bool(ok_), "title": title, "hint": hint})
    add(configured(), "Ключи RuStore добавлены", "Добавьте ключи RuStore в секреты проекта")
    rel = latest_release()
    tag = (rel.get("tag") or "").lstrip("v")
    add(bool(rel.get("aab_url")), f"Файл приложения {rel.get('aab_name') or '.aab'} собран",
        "Нажмите «Собрать» и дождитесь окончания сборки")
    size_mb = round((rel.get("aab_size") or 0) / 1048576, 1)
    add(0 < size_mb < 1000, f"Размер файла {size_mb} МБ", "Файл пустой или слишком большой")
    whats = (body.get("whats_new") or "").strip()
    add(len(whats) >= 10, "Заполнено «Что нового»", "Напишите хотя бы одно предложение — его увидят в RuStore")
    add(len(whats) <= 5000, "«Что нового» не длиннее 5000 символов", "Сократите текст")
    if configured():
        tok = token()
        versions = list_versions(tok, 20)
        busy = [v for v in versions if v["status"] in ("MODERATION", "TAKEN_FOR_MODERATION", "AUTO_CHECK")]
        add(not busy, "Нет версии на проверке",
            f"Версия {busy[0]['name']} ещё на модерации — дождитесь решения" if busy else "")
        same = next((v for v in versions if str(v.get("name") or "") == tag
                     and v["status"] not in ("DRAFT", "DELETED_DRAFT")), None)
        add(not same, f"Версия {tag} ещё не отправлялась", "Нажмите «Собрать», чтобы получить новую версию")
        live = next((v for v in versions if v["status"] in ("ACTIVE", "PARTIAL_ACTIVE")), None)
        if live:
            add((_parse_ver(tag) or (0,)) > (_parse_ver(live["name"]) or (0,)), f"Версия {tag} новее опубликованной {live['name']}",
                "RuStore примет только версию выше опубликованной")
        drafts = [v for v in versions if v["status"] == "DRAFT"]
        if drafts:
            checks.append({"ok": True, "title": f"Старый черновик ({len(drafts)}) будет удалён автоматически", "hint": ""})
    saved = screens.list_saved()
    add(not (0 < len(saved) < screens.MIN_SCREENS),
        f"Скриншоты: {len(saved) if saved else 'прежние из RuStore'}",
        f"Нужно минимум {screens.MIN_SCREENS} скриншота или ни одного")
    return ok({"checks": checks, "ready": all(c["ok"] for c in checks), "tag": rel.get("tag")})


def _up_state(version_id, value=None):
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    cur = conn.cursor()
    key = f"rustore_upload_{int(version_id)}"
    if value is None:
        cur.execute(f"SELECT value FROM {SCHEMA}.dev_settings WHERE key = %s", (key,))
        r = cur.fetchone()
        conn.close()
        return r[0] if r else ""
    cur.execute(
        f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_at) VALUES (%s, %s, %s) "
        f"ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at",
        (key, value[:500], int(time.time())),
    )
    conn.close()
    return value


def _auto_commit(version_id, tag, admin, ip, budget):
    """После загрузки файла сразу пробуем отправить версию на модерацию прямо на сервере."""
    t_end = time.time() + budget
    first = True
    while time.time() < t_end:
        if _up_state(version_id) == "committed":
            return True
        res = do_commit({"version_id": version_id, "tag": tag, "skip_media": not first}, admin, ip)
        first = False
        try:
            data = json.loads(res.get("body") or "{}")
        except Exception:
            data = {}
        if res.get("statusCode") == 200 and data.get("ok"):
            print(f"[auto_commit] {version_id}: отправлено на модерацию")
            return True
        print(f"[auto_commit] {version_id}: {data.get('message') or data.get('error')}")
        if res.get("statusCode") != 200:
            return False
        time.sleep(10)
    return False


def do_upload(body, admin=None, ip=""):
    version_id = int(body.get("version_id") or 0)
    if not version_id:
        return err("Не указана версия")
    rel = latest_release()
    if not rel.get("aab_url"):
        return err("В релизе нет файла .aab")
    tok = token()
    cur_state = _up_state(version_id)
    if cur_state.startswith("uploading") or cur_state in ("done", "committed"):
        return ok({"ok": True, "stage": "uploaded", "pending": cur_state.startswith("uploading")})
    _up_state(version_id, f"uploading:{int(time.time())}")
    t0 = time.time()
    try:
        file_resp = requests.get(rel["aab_url"], timeout=(10, 25))
        if file_resp.status_code != 200 or len(file_resp.content) < 100000:
            raise RuStoreError("Не удалось скачать .aab из GitHub")
        rs("POST", f"/public/v1/application/{PACKAGE}/version/{version_id}/aab", tok,
           files={"file": (rel["aab_name"], file_resp.content, "application/octet-stream")}, timeout=(10, 55))
    except requests.exceptions.ReadTimeout:
        print(f"[upload] {version_id}: RuStore не ответил за {int(time.time() - t0)} сек, файл обрабатывается")
        _up_state(version_id, "done")
        if admin:
            _auto_commit(version_id, rel.get("tag") or "", admin, ip, 20)
        return ok({"ok": True, "stage": "uploaded", "pending": True})
    except (RuStoreError, requests.exceptions.RequestException) as e:
        print(f"[upload] {version_id}: {e}")
        _up_state(version_id, f"error:{e}")
        try:
            rs("DELETE", f"/public/v1/application/{PACKAGE}/version/{version_id}", tok)
        except Exception:
            pass
        raise RuStoreError(f"RuStore не принял файл приложения: {e}. Черновик удалён — попробуйте ещё раз.")
    print(f"[upload] {version_id}: загружено за {int(time.time() - t0)} сек")
    _up_state(version_id, "done")
    if admin:
        _auto_commit(version_id, rel.get("tag") or "", admin, ip, 20)
    return ok({"ok": True, "stage": "uploaded", "pending": False})


def do_cancel(body):
    version_id = int(body.get("version_id") or 0)
    if version_id:
        try:
            rs("DELETE", f"/public/v1/application/{PACKAGE}/version/{version_id}", token())
        except Exception as e:
            print(f"[cancel] {version_id}: {e}")
    return ok({"ok": True})


def do_commit(body, admin, ip):
    version_id = int(body.get("version_id") or 0)
    if not version_id:
        return err("Не указана версия")
    st = _up_state(version_id)
    if st == "committed":
        return ok({"ok": True, "stage": "done", "tag": str(body.get("tag") or ""), "version_id": version_id,
                   "screens": 0, "icon": False})
    if st.startswith("uploading"):
        started = int(st.split(":")[1]) if ":" in st else 0
        if time.time() - started < 150:
            return ok({"ok": False, "retry": True, "message": "Файл ещё загружается в RuStore"})
    if st.startswith("error:"):
        return err(f"RuStore не принял файл приложения: {st[6:]}. Нажмите «Отправить» ещё раз.", 502)
    tok = token()
    shots, icon_sent = 0, False
    if not body.get("skip_media"):
        shots = screens.push_to_draft(tok, version_id)
        icon_sent = icon.push_to_draft(tok, version_id)
    try:
        rs("POST", f"/public/v1/application/{PACKAGE}/version/{version_id}/commit", tok, timeout=(10, 40))
    except RuStoreError as e:
        print(f"[commit] {version_id}: {e}")
        return ok({"ok": False, "retry": True, "message": str(e)[:200], "screens": shots, "icon": icon_sent})
    except requests.exceptions.ReadTimeout:
        return ok({"ok": False, "retry": True, "message": "RuStore долго отвечает", "screens": shots, "icon": icon_sent})
    tag = str(body.get("tag") or "")
    _up_state(version_id, "committed")
    audit(admin, "rustore_publish",
          f"Отправлена {tag} в RuStore (версия {version_id}, скриншотов: {shots or 'прежние'}, "
          f"иконка: {'новая' if icon_sent else 'прежняя'})", ip)
    return ok({"ok": True, "stage": "done", "tag": tag, "version_id": version_id, "screens": shots, "icon": icon_sent})


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
            saved_icon = icon.public()
            has_token = bool((os.environ.get("GITHUB_RELEASE_TOKEN") or "").strip())
            if not configured():
                return ok({"configured": False, "release": rel, "versions": [], "rating": None,
                           "screens": saved, "store_screens": [], "icon": saved_icon, "has_release": False,
                           "has_token": has_token})
            tok = token()
            versions = enrich(list_versions(tok))
            sync_live_version(versions)
            rating = None
            try:
                rating = reviews.rating(tok)
            except RuStoreError as e:
                rating = {"error": str(e)}
            return ok({"configured": True, "release": rel, "versions": versions, "rating": rating,
                       "screens": saved, "store_screens": store_screens(tok, versions),
                       "icon": saved_icon, "has_release": has_release(versions),
                       "has_token": has_token})

        if action == "publish":
            return do_publish(body, admin, ip)

        if action == "publish_check":
            return do_preflight(body)

        if action == "publish_cancel":
            return do_cancel(body)

        if action == "publish_upload":
            return do_upload(body, admin, ip)

        if action == "publish_commit":
            return do_commit(body, admin, ip)

        if action == "bump":
            return bump_release(admin, ip)

        if action == "gh_check":
            return ok(gh_diagnose())

        if action == "build_status":
            tag = str(body.get("tag") or "")
            st = build_state(tag) if tag else {"state": "unknown"}
            rel = None
            try:
                rel = latest_release()
            except RuStoreError as e:
                rel = {"error": str(e)}
            ready = bool(rel and rel.get("tag") == tag and rel.get("aab_name"))
            return ok({**st, "ready": ready, "release": rel,
                       "has_token": bool((os.environ.get("GITHUB_RELEASE_TOKEN") or "").strip())})

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

        if action == "icon_set":
            saved_icon = icon.save(body.get("data") or "")
            audit(admin, "rustore_icon", "Загружена новая иконка", ip)
            return ok({"ok": True, "icon": saved_icon})

        if action == "icon_delete":
            icon.remove()
            audit(admin, "rustore_icon", "Удалена новая иконка", ip)
            return ok({"ok": True, "icon": None})

        if action == "version_note":
            vid = body.get("version_id")
            if not vid:
                return err("Не указана версия")
            save_note(vid, body.get("note"), admin)
            return ok({"ok": True})

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
    except requests.exceptions.Timeout:
        print(f"[rustore] {action}: timeout")
        return err("RuStore или GitHub слишком долго отвечают. Попробуйте ещё раз через пару минут.", 504)
    except requests.exceptions.RequestException as e:
        print(f"[rustore] {action}: network {e}")
        return err("Не удалось связаться с RuStore. Попробуйте ещё раз через пару минут.", 502)
    except (ValueError, TypeError) as e:
        print(f"[rustore] {action} bad input: {e}")
        return err("Неверные данные запроса")