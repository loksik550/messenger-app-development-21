import io
import os
import base64
import time
import uuid

import requests
from PIL import Image

from rustore import PACKAGE, rs, RuStoreError
from screens import _db, _s3, SCHEMA

ICON_SIZE = 512
MAX_BYTES = 3 * 1024 * 1024


def get_saved():
    conn = _db()
    cur = conn.cursor()
    cur.execute(f"SELECT id, url, s3_key, mime, created_at FROM {SCHEMA}.rustore_icon ORDER BY id DESC LIMIT 1")
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {"id": row[0], "url": row[1], "s3_key": row[2], "mime": row[3], "created_at": row[4]}


def public():
    s = get_saved()
    if not s:
        return None
    return {"id": s["id"], "url": s["url"], "created_at": s["created_at"]}


def _clear():
    conn = _db()
    cur = conn.cursor()
    cur.execute(f"SELECT s3_key FROM {SCHEMA}.rustore_icon")
    keys = [r[0] for r in cur.fetchall()]
    cur.execute(f"DELETE FROM {SCHEMA}.rustore_icon")
    conn.close()
    for k in keys:
        try:
            _s3().delete_object(Bucket="files", Key=k)
        except Exception as e:
            print(f"[icon] s3 delete: {e}")


def save(data_b64: str):
    if not data_b64:
        raise RuStoreError("Файл не получен")
    if "," in data_b64[:100]:
        data_b64 = data_b64.split(",", 1)[1]
    try:
        raw = base64.b64decode(data_b64, validate=True)
    except Exception:
        raise RuStoreError("Файл повреждён — попробуйте выбрать его ещё раз")
    if len(raw) > MAX_BYTES:
        raise RuStoreError("Иконка больше 3 МБ — RuStore такую не примет")
    try:
        img = Image.open(io.BytesIO(raw))
        fmt = (img.format or "").upper()
        w, h = img.size
    except Exception:
        raise RuStoreError("Это не картинка — нужен файл PNG или JPG")
    if fmt not in ("PNG", "JPEG"):
        raise RuStoreError("Нужен файл PNG или JPG")
    if (w, h) != (ICON_SIZE, ICON_SIZE):
        raise RuStoreError(f"Иконка {w}×{h}, а RuStore нужна ровно {ICON_SIZE}×{ICON_SIZE}")

    mime = "image/png" if fmt == "PNG" else "image/jpeg"
    ext = "png" if fmt == "PNG" else "jpg"
    key = f"rustore/icon/{int(time.time())}-{uuid.uuid4().hex[:8]}.{ext}"
    _s3().put_object(Bucket="files", Key=key, Body=raw, ContentType=mime)
    url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

    _clear()
    conn = _db()
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.rustore_icon (url, s3_key, mime) VALUES (%s, %s, %s)",
        (url, key, mime),
    )
    conn.close()
    return public()


def remove():
    _clear()


def push_to_draft(tok, version_id):
    """Загружает сохранённую иконку в черновик. True — загружена, False — иконки нет (останется прежняя)."""
    s = get_saved()
    if not s:
        return False
    r = requests.get(s["url"], timeout=20)
    if r.status_code != 200 or not r.content:
        raise RuStoreError("Не удалось взять иконку из хранилища")
    ext = "png" if s["mime"] == "image/png" else "jpg"
    rs("POST", f"/public/v1/application/{PACKAGE}/version/{int(version_id)}/image/icon", tok,
       files={"file": (f"icon.{ext}", r.content, s["mime"])}, timeout=40)
    return True
