import os
import io
import time
import base64
import uuid

import boto3
import psycopg2
import requests
from PIL import Image

from rustore import PACKAGE, rs, page_items, RuStoreError

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67547116_messenger_app_develo")
MAX_SCREENS = 10
MIN_SCREENS = 3
MAX_BYTES = 5 * 1024 * 1024


def _db():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    return conn


def _s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def list_saved():
    conn = _db()
    cur = conn.cursor()
    cur.execute(
        f"SELECT id, url, s3_key, orientation, ordinal, width, height, mime FROM {SCHEMA}.rustore_screens "
        f"ORDER BY ordinal, id"
    )
    rows = cur.fetchall()
    conn.close()
    return [{"id": r[0], "url": r[1], "s3_key": r[2], "orientation": r[3], "ordinal": r[4],
             "width": r[5], "height": r[6], "mime": r[7]} for r in rows]


def public_list():
    return [{k: v for k, v in s.items() if k != "s3_key"} for s in list_saved()]


def _orientation(w, h):
    if w < 320 or h < 320 or w > 3840 or h > 3840:
        raise RuStoreError(f"Размер {w}×{h} не подходит: каждая сторона должна быть от 320 до 3840 пикселей")
    ratio = max(w, h) / min(w, h)
    if abs(ratio - 16 / 9) > 0.05:
        raise RuStoreError(f"Пропорции {w}×{h} не подходят: RuStore принимает только 9:16 (вертикально) "
                           f"или 16:9 (горизонтально), например 1080×1920")
    return "PORTRAIT" if h > w else "LANDSCAPE"


def add(data_b64: str):
    if not data_b64:
        raise RuStoreError("Файл не получен")
    if "," in data_b64[:100]:
        data_b64 = data_b64.split(",", 1)[1]
    try:
        raw = base64.b64decode(data_b64, validate=True)
    except Exception:
        raise RuStoreError("Файл повреждён — попробуйте выбрать его ещё раз")
    if len(raw) > MAX_BYTES:
        raise RuStoreError("Файл больше 5 МБ — RuStore такой не примет")
    try:
        img = Image.open(io.BytesIO(raw))
        fmt = (img.format or "").upper()
        w, h = img.size
    except Exception:
        raise RuStoreError("Это не картинка — нужен файл PNG или JPG")
    if fmt not in ("PNG", "JPEG"):
        raise RuStoreError("Нужен файл PNG или JPG")
    orientation = _orientation(w, h)

    saved = list_saved()
    if len(saved) >= MAX_SCREENS:
        raise RuStoreError("В RuStore можно не больше 10 скриншотов — сначала удалите лишний")
    if saved and saved[0]["orientation"] != orientation:
        need = "вертикальные" if saved[0]["orientation"] == "PORTRAIT" else "горизонтальные"
        raise RuStoreError(f"Все скриншоты должны быть одной ориентации — у вас уже {need}")

    mime = "image/png" if fmt == "PNG" else "image/jpeg"
    ext = "png" if fmt == "PNG" else "jpg"
    key = f"rustore/screens/{int(time.time())}-{uuid.uuid4().hex[:8]}.{ext}"
    _s3().put_object(Bucket="files", Key=key, Body=raw, ContentType=mime)
    url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

    ordinal = (max(s["ordinal"] for s in saved) + 1) if saved else 0
    conn = _db()
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.rustore_screens (url, s3_key, orientation, ordinal, width, height, mime) "
        f"VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
        (url, key, orientation, ordinal, w, h, mime),
    )
    new_id = cur.fetchone()[0]
    conn.close()
    return new_id


def remove(screen_id: int):
    conn = _db()
    cur = conn.cursor()
    cur.execute(f"SELECT s3_key FROM {SCHEMA}.rustore_screens WHERE id = %s", (int(screen_id),))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise RuStoreError("Скриншот уже удалён")
    cur.execute(f"DELETE FROM {SCHEMA}.rustore_screens WHERE id = %s", (int(screen_id),))
    conn.close()
    try:
        _s3().delete_object(Bucket="files", Key=row[0])
    except Exception as e:
        print(f"[screens] s3 delete: {e}")
    _renumber()


def reorder(ids):
    saved = {s["id"] for s in list_saved()}
    clean = [int(i) for i in ids if int(i) in saved]
    rest = [i for i in saved if i not in clean]
    conn = _db()
    cur = conn.cursor()
    for pos, sid in enumerate(clean + sorted(rest)):
        cur.execute(f"UPDATE {SCHEMA}.rustore_screens SET ordinal = %s WHERE id = %s", (pos, sid))
    conn.close()


def _renumber():
    reorder([s["id"] for s in list_saved()])


def current_in_store(tok, version_id):
    if not version_id:
        return []
    d = rs("GET", f"/public/v2/application/{PACKAGE}/version/{int(version_id)}/image/screenshot?page=0&size=20", tok)
    items = [i for i in page_items(d.get("body")) if (i.get("type") or "SCREENSHOT") == "SCREENSHOT"]
    items.sort(key=lambda i: i.get("ordinal") or 0)
    return [{"id": i.get("id"), "url": i.get("fileUrl"), "ordinal": i.get("ordinal"),
             "orientation": i.get("orientation")} for i in items]


def push_to_draft(tok, version_id):
    """Загружает сохранённые скриншоты в черновик. Возвращает число загруженных (0 — оставлены прежние)."""
    saved = list_saved()
    if len(saved) < MIN_SCREENS:
        return 0
    try:
        old = current_in_store(tok, version_id)
    except RuStoreError as e:
        print(f"[screens] list draft: {e}")
        old = []
    files = []
    for pos, s in enumerate(saved[:MAX_SCREENS]):
        r = requests.get(s["url"], timeout=20)
        if r.status_code != 200 or not r.content:
            raise RuStoreError(f"Не удалось взять скриншот №{pos + 1} из хранилища")
        files.append((pos, s, r.content))
    for o in old:
        if o.get("id"):
            try:
                rs("DELETE", f"/public/v2/application/{PACKAGE}/version/{int(version_id)}/image/screenshot/{int(o['id'])}", tok)
            except RuStoreError as e:
                print(f"[screens] delete old {o.get('id')}: {e}")
    for pos, s, content in files:
        ext = "png" if s["mime"] == "image/png" else "jpg"
        rs("POST",
           f"/public/v2/application/{PACKAGE}/version/{int(version_id)}/image/screenshot/"
           f"{s['orientation']}/{pos}/SCREENSHOT",
           tok, files={"file": (f"screen{pos}.{ext}", content, s["mime"])}, timeout=40)
    return len(files)