import os
import json
import time
import base64
import boto3

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
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


def handler(event: dict, context) -> dict:
    """Загрузка медиа файлов (фото/видео/аудио/файлы) в S3, возврат CDN-ссылки и типа."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    user_id = event.get("headers", {}).get("X-User-Id", "0")
    body = json.loads(event.get("body") or "{}")
    data_b64 = body.get("data", "")
    mime = body.get("mime", "image/jpeg")
    file_name = body.get("file_name", "")
    file_size = body.get("file_size", 0)

    if not data_b64:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нет данных"})}

    try:
        file_data = base64.b64decode(data_b64)
    except Exception:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Неверный base64"})}

    # Очищаем mime от codecs: "video/mp4;codecs=avc1" -> "video/mp4"
    mime_clean = mime.split(";")[0].strip().lower()
    mime_main = mime_clean.split("/")[0]
    ext = EXT_MAP.get(mime_clean, mime_clean.split("/")[-1] or "bin")
    media_type = MEDIA_TYPE_MAP.get(mime_main, "file")

    # Для голосовых сообщений — всегда audio
    if "audio" in mime:
        media_type = "audio"

    folder = media_type  # image / video / audio / file
    ts = int(time.time())
    key = f"chat/{user_id}/{folder}/{ts}.{ext}"

    s3 = boto3.client("s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    s3.put_object(Bucket="files", Key=key, Body=file_data, ContentType=mime_clean or mime)
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

    return {
        "statusCode": 200,
        "headers": CORS,
        "body": json.dumps({
            "url": cdn_url,
            "media_type": media_type,
            "file_name": file_name or f"file.{ext}",
            "file_size": file_size or len(file_data),
        })
    }