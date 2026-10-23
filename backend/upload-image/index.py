import os
import errlog
import json
import time
import uuid
import base64
import boto3
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
