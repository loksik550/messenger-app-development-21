import os
import errlog
import json
import time
import uuid
import base64
import boto3
from botocore.config import Config
import psycopg2
import nova_auth

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token, X-Dev-Token",
}

# Расширения по MIME
EXT_MAP = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/gif": "gif", "image/webp": "webp",
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
    "audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3",
    "audio/wav": "wav", "audio/mp4": "m4a",
    "application/pdf": "pdf",
}

# Тип медиа по MIME
MEDIA_TYPE_MAP = {
    "image": "image",
    "video": "video",
    "audio": "audio",
    "application": "file",
    "text": "file",
}


DEFAULT_FREE_MB = 50
DEFAULT_PRO_MB = 1024
CHUNK_MAX = 2 * 1024 * 1024 + 1024


def _resp(code: int, data: dict) -> dict:
    return {"statusCode": code, "headers": CORS, "body": json.dumps(data, ensure_ascii=False)}


def _s3():
    return boto3.client("s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def _limits(user_id: str) -> dict:
    """Лимит размера файла для пользователя: из настроек Dev-панели и активного Pro."""
    free_mb, pro_mb, is_pro = DEFAULT_FREE_MB, DEFAULT_PRO_MB, False
    c = psycopg2.connect(os.environ["DATABASE_URL"])
    c.autocommit = True
    try:
        cur = c.cursor()
        cur.execute(
            f"SELECT key, value FROM {nova_auth.SCHEMA}.dev_settings "
            f"WHERE key IN ('file_limit_free_mb', 'file_limit_pro_mb')"
        )
        cfg = {k: v for k, v in cur.fetchall()}
        try:
            free_mb = max(1, int(cfg.get("file_limit_free_mb") or DEFAULT_FREE_MB))
        except ValueError:
            pass
        try:
            pro_mb = max(free_mb, int(cfg.get("file_limit_pro_mb") or DEFAULT_PRO_MB))
        except ValueError:
            pass
        if user_id == "admin":
            is_pro = True
        else:
            cur.execute(f"SELECT COALESCE(pro_until, 0) FROM {nova_auth.SCHEMA}.users WHERE id = %s", (int(user_id),))
            r = cur.fetchone()
            is_pro = bool(r and int(r[0] or 0) > int(time.time()))
    finally:
        c.close()
    return {"free_mb": free_mb, "pro_mb": pro_mb, "is_pro": is_pro, "max_mb": pro_mb if is_pro else free_mb}


def _upload_id_ok(upload_id: str) -> bool:
    return bool(upload_id) and len(upload_id) <= 40 and all(ch.isalnum() for ch in upload_id)


def _chunked(body: dict, user_id: str) -> dict:
    """Загрузка больших файлов частями по 2 МБ и сборка в один файл."""
    action = body.get("action")
    if action == "limits":
        return _resp(200, _limits(user_id))

    upload_id = str(body.get("upload_id") or "")
    if not _upload_id_ok(upload_id):
        return _resp(400, {"error": "Неверный upload_id"})
    prefix = f"tmp-upload/{user_id}/{upload_id}"
    s3 = _s3()

    if action == "chunk":
        try:
            idx = int(body.get("index"))
        except (TypeError, ValueError):
            return _resp(400, {"error": "Неверный номер части"})
        if idx < 0 or idx > 1100:
            return _resp(400, {"error": "Неверный номер части"})
        raw = "".join(str(body.get("data") or "").split())
        pad = len(raw) % 4
        if pad:
            raw += "=" * (4 - pad)
        try:
            chunk = base64.b64decode(raw, validate=True)
        except Exception:
            return _resp(400, {"error": "Неверный base64"})
        if not chunk or len(chunk) > CHUNK_MAX:
            return _resp(400, {"error": "Неверный размер части"})
        if idx == 0:
            lim = _limits(user_id)
            total = int(body.get("total_size") or 0)
            if total > lim["max_mb"] * 1024 * 1024:
                return _resp(413, {
                    "error": f"Файл больше {lim['max_mb']} МБ" + ("" if lim["is_pro"] else f". С Nova Pro — до {lim['pro_mb']} МБ"),
                    "limit_mb": lim["max_mb"], "pro_mb": lim["pro_mb"], "is_pro": lim["is_pro"],
                })
        s3.put_object(Bucket="files", Key=f"{prefix}/{idx:05d}", Body=chunk)
        return _resp(200, {"ok": True, "index": idx})

    # finish
    try:
        parts = int(body.get("parts") or 0)
    except (TypeError, ValueError):
        parts = 0
    if parts < 1 or parts > 1100:
        return _resp(400, {"error": "Неверное число частей"})
    keys = [f"{prefix}/{i:05d}" for i in range(parts)]
    sizes = []
    for k in keys:
        try:
            sizes.append(int(s3.head_object(Bucket="files", Key=k)["ContentLength"]))
        except Exception:
            return _resp(400, {"error": "Часть файла потерялась, попробуйте ещё раз"})
    total = sum(sizes)
    lim = _limits(user_id)
    if total > lim["max_mb"] * 1024 * 1024:
        for k in keys:
            try: s3.delete_object(Bucket="files", Key=k)
            except Exception: pass
        return _resp(413, {"error": f"Файл больше {lim['max_mb']} МБ", "limit_mb": lim["max_mb"]})

    mime = str(body.get("mime") or "application/octet-stream")
    file_name = str(body.get("file_name") or "")
    mime_clean = mime.split(";")[0].strip().lower()
    mime_main = mime_clean.split("/")[0]
    if mime_clean in EXT_MAP:
        ext = EXT_MAP[mime_clean]
        store_mime = mime_clean
    else:
        ext = "bin"
        store_mime = "application/octet-stream"
        mime_main = "application"
    media_type = "audio" if mime_main == "audio" else MEDIA_TYPE_MAP.get(mime_main, "file")
    key = f"chat/{user_id}/{media_type}/{int(time.time())}-{uuid.uuid4().hex[:12]}.{ext}"

    class _Joined:
        def __init__(self):
            self.i, self.cur, self.pos = 0, None, 0
        def read(self, amt=-1):
            out = bytearray()
            want = amt if amt and amt > 0 else 1 << 62
            while len(out) < want and self.i < len(keys):
                if self.cur is None:
                    self.cur = s3.get_object(Bucket="files", Key=keys[self.i])["Body"]
                part = self.cur.read(min(want - len(out), 1 << 20))
                if not part:
                    self.cur = None
                    self.i += 1
                    continue
                out += part
            self.pos += len(out)
            return bytes(out)
        def tell(self):
            return self.pos
        def seek(self, off, whence=0):
            if whence == 0 and off == 0:
                self.i, self.cur, self.pos = 0, None, 0
                return 0
            return total if whence == 2 else self.pos

    s3w = boto3.client("s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        config=Config(request_checksum_calculation="when_required"),
    )
    extra = {"ContentDisposition": "attachment"} if store_mime == "application/octet-stream" else {}
    s3w.put_object(Bucket="files", Key=key, Body=_Joined(), ContentLength=total, ContentType=store_mime, **extra)
    for k in keys:
        try:
            s3.delete_object(Bucket="files", Key=k)
        except Exception:
            pass
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    return _resp(200, {
        "url": cdn_url, "media_type": media_type,
        "file_name": (file_name[:120] or f"file.{ext}"), "file_size": total,
    })


def _entry(event: dict, context) -> dict:
    """Загрузка медиа файлов (фото/видео/аудио/файлы) в S3, возврат CDN-ссылки и типа."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    user_id = (event.get("headers", {}) or {}).get("X-User-Id", "0")
    try:
        user_id = str(int(user_id))
    except (TypeError, ValueError):
        user_id = "0"
    dev_token = (event.get("headers", {}) or {}).get("X-Dev-Token") or ""
    if user_id == "0":
        if not dev_token:
            return nova_auth.denied(CORS)
        _c = psycopg2.connect(os.environ["DATABASE_URL"])
        _c.autocommit = True
        try:
            _cur = _c.cursor()
            _cur.execute(
                f"SELECT admin_id FROM {nova_auth.SCHEMA}.dev_sessions WHERE token = %s AND expires_at > %s",
                (dev_token, int(time.time())),
            )
            _adm = _cur.fetchone()
        finally:
            _c.close()
        if not _adm:
            return nova_auth.denied(CORS)
        user_id = "admin"
    else:
        _c = psycopg2.connect(os.environ["DATABASE_URL"])
        _c.autocommit = True
        try:
            _ok = nova_auth.check(_c.cursor(), event, user_id)
        finally:
            _c.close()
        if not _ok:
            return nova_auth.denied(CORS)
    body = json.loads(event.get("body") or "{}")
    if body.get("action") in ("limits", "chunk"):
        return _chunked(body, user_id)
    data_b64 = body.get("data", "")
    mime = body.get("mime", "image/jpeg")
    file_name = body.get("file_name", "")
    file_size = body.get("file_size", 0)

    if not data_b64:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нет данных"})}

    if "base64," in data_b64:
        data_b64 = data_b64.split("base64,", 1)[1]
    data_b64 = "".join(data_b64.split())
    pad = len(data_b64) % 4
    if pad:
        data_b64 += "=" * (4 - pad)

    try:
        file_data = base64.b64decode(data_b64, validate=True)
    except Exception:
        print(f"[upload] bad base64 mime={mime} len={len(data_b64)} head={data_b64[:30]!r}")
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Неверный base64"})}

    # Лимит размера файла: 5 МБ. Даёт понятную ошибку вместо обрыва на прокси.
    MAX_BYTES = 5 * 1024 * 1024
    if len(file_data) > MAX_BYTES:
        mb = len(file_data) / 1024 / 1024
        return {"statusCode": 413, "headers": CORS,
                "body": json.dumps({"error": f"Файл слишком большой ({mb:.1f} МБ). Максимум 5 МБ."}, ensure_ascii=False)}

    # Очищаем mime от codecs: "video/mp4;codecs=avc1" -> "video/mp4"
    mime_clean = str(mime or "").split(";")[0].strip().lower()
    mime_main = mime_clean.split("/")[0]
    # Опасные типы (html, svg, js и т.п.) не сохраняем как есть: браузер мог бы
    # выполнить их код. Такие файлы отдаём как обычное вложение для скачивания.
    if mime_clean in EXT_MAP:
        ext = EXT_MAP[mime_clean]
        store_mime = mime_clean
    else:
        ext = "bin"
        store_mime = "application/octet-stream"
        mime_main = "application"
    media_type = MEDIA_TYPE_MAP.get(mime_main, "file")

    # Для голосовых сообщений — всегда audio
    if mime_main == "audio":
        media_type = "audio"

    folder = media_type  # image / video / audio / file
    ts = int(time.time())
    key = f"chat/{user_id}/{folder}/{ts}-{uuid.uuid4().hex[:12]}.{ext}"

    s3 = boto3.client("s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    extra = {}
    if store_mime == "application/octet-stream":
        extra["ContentDisposition"] = "attachment"
    s3.put_object(Bucket="files", Key=key, Body=file_data, ContentType=store_mime, **extra)
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

    return {
        "statusCode": 200,
        "headers": CORS,
        "body": json.dumps({
            "url": cdn_url,
            "media_type": media_type,
            "file_name": (str(file_name or "")[:120] or f"file.{ext}"),
            "file_size": len(file_data),
        })
    }

def handler(event: dict, context) -> dict:
    """Точка входа: выполняет запрос и записывает сбои в журнал ошибок."""
    return errlog.guard("upload-image", _entry, event, context)
